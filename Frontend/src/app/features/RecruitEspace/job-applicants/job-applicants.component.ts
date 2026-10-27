import { DatePipe } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import {
  APPLICANT_STATUS_LABELS,
  Applicant,
  ApplicantStatus,
  RecruiterDecision,
  RecruiterJob,
  RecruiterService,
  contractLabel,
  toRecruiterError,
} from '../../../core/services/recruiter.service';
import { sectorLabel } from '../../../core/models/sector.utils';
import { RECRUITER_BASE } from '../recruiter.routes';

export type ScoreTone = 'high' | 'mid' | 'low' | 'none';
type SortBy = 'score' | 'date' | 'name';

/** Même échelle de couleurs que le score affiché aux candidats */
export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'none';
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

const STATUS_ORDER: ApplicantStatus[] = ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];

/** Icône de chaque étape du recrutement */
const STATUS_ICONS: Record<ApplicantStatus, string> = {
  APPLIED: 'ti-inbox',
  INTERVIEW: 'ti-calendar-event',
  OFFER: 'ti-rosette-discount-check',
  REJECTED: 'ti-circle-x',
};

@Component({
  selector: 'app-job-applicants',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './job-applicants.component.html',
  styleUrl: './job-applicants.component.scss',
})
export class JobApplicantsComponent implements OnInit {
  private api = inject(RecruiterService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  readonly base = RECRUITER_BASE;
  readonly statusLabels = APPLICANT_STATUS_LABELS;
  readonly statusIcons = STATUS_ICONS;
  readonly statuses = STATUS_ORDER;
  readonly contractLabel = contractLabel;
  readonly scoreTone = scoreTone;

  /** Longueur des cercles de score (rayon 16 dans la liste, 30 dans le détail) */
  readonly ringSmall = 2 * Math.PI * 16;
  readonly ringLarge = 2 * Math.PI * 30;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly copied = signal<string | null>(null);
  readonly job = signal<RecruiterJob | null>(null);
  readonly applicants = signal<Applicant[]>([]);
  /** '' = tous */
  readonly statusFilter = signal<ApplicantStatus | ''>('');
  readonly query = signal('');
  readonly sortBy = signal<SortBy>('score');
  readonly selectedId = signal<number | null>(null);
  /** Candidature dont l'aperçu de la lettre est ouvert */
  readonly letterPreviewId = signal<number | null>(null);

  /** Adresse de l'aperçu PDF de la lettre du candidat ouvert (null si pas d'aperçu possible) */
  readonly letterPreviewUrl = computed<SafeResourceUrl | null>(() => {
    const a = this.selected();
    if (!a || this.letterPreviewId() !== a.applicationId) return null;
    const url = a.coverLetterUrl;
    // Seulement les PDF publics de Supabase Storage : jamais une adresse quelconque dans l'iframe
    if (!url || !this.isPdf(url) || !/^https:\/\/[^/]+\/storage\/v1\/object\/public\//.test(url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url + '#view=FitH&toolbar=0');
  });

  /** Candidature en cours de mise à jour */
  readonly busyId = signal<number | null>(null);

  readonly counts = computed(() => {
    const counts: Record<ApplicantStatus, number> = { APPLIED: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 };
    for (const a of this.applicants()) counts[a.status]++;
    return counts;
  });

  /** Rang de chaque candidat par score (1 = le plus compatible), toutes étapes confondues */
  readonly ranks = computed(() => {
    const sorted = [...this.applicants()].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
    return new Map(sorted.map((a, i) => [a.applicationId, i + 1]));
  });

  readonly visible = computed(() => {
    const f = this.statusFilter();
    const q = this.query().trim().toLowerCase();
    const list = this.applicants().filter(a =>
      (!f || a.status === f)
      && (!q || `${this.fullName(a)} ${a.city ?? ''} ${a.skills.join(' ')}`.toLowerCase().includes(q)));

    switch (this.sortBy()) {
      case 'date':
        return list.sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''));
      case 'name':
        return list.sort((a, b) => this.fullName(a).localeCompare(this.fullName(b), 'fr'));
      default:
        return list.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
    }
  });

  readonly selected = computed(() => this.applicants().find(a => a.applicationId === this.selectedId()) ?? null);

  /** Position du candidat ouvert dans la liste affichée (pour Précédent / Suivant) */
  readonly selectedIndex = computed(() => this.visible().findIndex(a => a.applicationId === this.selectedId()));

  readonly averageScore = computed(() => {
    const scores = this.applicants().map(a => a.matchScore).filter((s): s is number => s !== null);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) {
      this.error.set('Offre introuvable.');
      this.loading.set(false);
      return;
    }
    forkJoin({ job: this.api.getJob(id), applicants: this.api.applicants(id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ job, applicants }) => {
          this.job.set(job);
          this.applicants.set(applicants);
          // Sur grand écran, on ouvre directement le meilleur profil
          if (applicants.length && typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches) {
            this.selectedId.set(this.visible()[0]?.applicationId ?? null);
          }
          this.loading.set(false);
        },
        error: err => {
          this.error.set(toRecruiterError(err).message);
          this.loading.set(false);
        },
      });
  }

  // ── Clavier : Échap ferme, ↑ / ↓ passent au candidat précédent / suivant ──

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.key === 'Escape') this.closeDetail();
    else if (event.key === 'ArrowDown' && this.selected()) { event.preventDefault(); this.step(1); }
    else if (event.key === 'ArrowUp' && this.selected()) { event.preventDefault(); this.step(-1); }
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  step(delta: number): void {
    const list = this.visible();
    const next = list[this.selectedIndex() + delta];
    if (next) this.select(next, true);
  }

  select(a: Applicant, keepOpen = false): void {
    this.actionError.set(null);
    this.copied.set(null);
    this.letterPreviewId.set(null);
    this.selectedId.set(!keepOpen && this.selectedId() === a.applicationId ? null : a.applicationId);
  }

  setFilter(status: ApplicantStatus | ''): void {
    this.statusFilter.set(status);
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as SortBy);
  }

  decide(a: Applicant, status: RecruiterDecision): void {
    if (a.status === status) return;
    this.busyId.set(a.applicationId);
    this.actionError.set(null);
    this.api.decide(a.applicationId, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.applicants.update(list => list.map(x => (x.applicationId === updated.applicationId ? updated : x)));
        this.busyId.set(null);
      },
      error: err => {
        this.actionError.set(toRecruiterError(err).message);
        this.busyId.set(null);
      },
    });
  }

  /** Copie l'e-mail ou le téléphone (les liens mailto/tel ne marchent pas partout) */
  async copy(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(key);
      setTimeout(() => this.copied() === key && this.copied.set(null), 1800);
    } catch { /* presse-papiers refusé : l'utilisateur peut sélectionner le texte */ }
  }

  /** Affiche / masque l'aperçu de la lettre dans le dossier */
  toggleLetterPreview(a: Applicant): void {
    this.letterPreviewId.set(this.letterPreviewId() === a.applicationId ? null : a.applicationId);
  }

  // ── Affichage ───────────────────────────────────────────

  isPdf(url: string | null): boolean {
    return !!url && /\.pdf($|\?|#)/i.test(url);
  }

  /** « PDF », « DOCX »… d'après l'adresse du fichier */
  fileType(url: string | null): string {
    const m = url?.match(/\.(pdf|docx?)($|\?|#)/i);
    return m ? m[1].toUpperCase() : 'Fichier';
  }

  fullName(a: Applicant): string {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Candidat';
  }

  initials(a: Applicant): string {
    return ((a.firstName?.[0] ?? '') + (a.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  experience(a: Applicant): string {
    const y = a.yearsOfExperience;
    if (y === null) return 'Expérience non renseignée';
    if (y === 0) return 'Débutant';
    return `${y} an${y > 1 ? 's' : ''} d'expérience`;
  }

  sector(code: string | null): string {
    return code ? sectorLabel(code) : '';
  }

  /** « 3 / 5 compétences » : compétences de l'offre que le candidat possède */
  skillRatio(a: Applicant): { have: number; total: number; pct: number } {
    const have = a.matchedSkills.length;
    const total = have + a.missingSkills.length;
    return { have, total, pct: total ? Math.round((have / total) * 100) : 0 };
  }

  /** Décalage du trait pour dessiner un score de 0 à 100 sur un cercle */
  dashOffset(length: number, score: number | null): number {
    return length * (1 - Math.max(0, Math.min(100, score ?? 0)) / 100);
  }
}