import { DatePipe } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, HostListener, OnInit, computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import {
  APPLICANT_STATUS_LABELS,
  Applicant,
  ApplicationEvent,
  ApplicationStatusCode,
  ApplicantStatus,
  RecruiterDecision,
  RecruiterJob,
  RecruiterService,
  contractLabel,
  toRecruiterError,
} from '../../../core/services/recruiter.service';
import { sectorLabel } from '../../../core/models/sector.utils';
import { RECRUITER_BASE } from '../recruiter.routes';
import { InterviewSlotsService, SlotDraft, checkDrafts } from '../../../core/services/interview-slots.service';
import { SlotEditorComponent, newSlotDraft } from './slot-editor/slot-editor.component';
import { ApplicantInterviewComponent } from './applicant-interview/applicant-interview.component';
import { ApplicantInsightComponent } from './applicant-insight/applicant-insight.component';

export type ScoreTone = 'high' | 'mid' | 'low' | 'none';
type SortBy = 'score' | 'date' | 'name';

/** Même échelle de couleurs que le score affiché aux candidats */
export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'none';
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

const STATUS_ORDER: ApplicantStatus[] = [
  'APPLIED', 'UNDER_REVIEW', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN',
];

/** Icône de chaque étape du recrutement */
const STATUS_ICONS: Record<ApplicantStatus, string> = {
  APPLIED: 'ti-inbox',
  UNDER_REVIEW: 'ti-eye',
  INTERVIEW: 'ti-calendar-event',
  ASSESSMENT: 'ti-clipboard-check',
  OFFER: 'ti-rosette-discount-check',
  HIRED: 'ti-briefcase',
  REJECTED: 'ti-circle-x',
  WITHDRAWN: 'ti-arrow-back-up',
};

/** Libellés de l'historique (tous les statuts, y compris ceux du candidat) */
const EVENT_LABELS: Record<ApplicationStatusCode, string> = {
  TO_APPLY: 'Ajoutée au suivi',
  APPLIED: 'Candidature envoyée',
  UNDER_REVIEW: 'Candidature en cours d\'examen',
  INTERVIEW: 'Entretien proposé',
  ASSESSMENT: 'Évaluation demandée',
  OFFER: 'Proposition faite',
  HIRED: 'Embauché',
  REJECTED: 'Candidature refusée',
  WITHDRAWN: 'Candidature retirée',
};

/** Textes de la fenêtre de décision et messages proposés au recruteur */
const DECISIONS: Record<RecruiterDecision, { title: string; action: string; hint: string; templates: string[] }> = {
  UNDER_REVIEW: {
    title: 'Mettre en examen',
    action: 'Mettre en examen',
    hint: 'Le candidat sait que sa candidature est étudiée. Le message est facultatif.',
    templates: [
      'Merci pour votre candidature. Nous l\'étudions avec attention et revenons vers vous rapidement.',
    ],
  },
  ASSESSMENT: {
    title: 'Demander une évaluation',
    action: 'Envoyer l\'évaluation',
    hint: 'Test technique, cas pratique… Indiquez dans le message comment y accéder et le délai.',
    templates: [
      'Pour la suite du processus, nous vous proposons un test technique. Vous recevrez le lien par e-mail ; vous aurez 3 jours pour le réaliser.',
      'Nous aimerions vous confier un court cas pratique. Merci de nous indiquer le moment qui vous convient pour le recevoir.',
    ],
  },
  INTERVIEW: {
    title: 'Proposer un entretien',
    action: 'Envoyer les créneaux',
    hint: 'Le candidat choisit un créneau en un clic (ou propose un autre moment). Vous êtes prévenu dès qu\'il répond.',
    templates: [
      'Bonjour, votre profil nous intéresse. Nous aimerions échanger avec vous lors d\'un entretien : choisissez le créneau qui vous convient.',
      'Merci pour votre candidature. Voici quelques créneaux pour un premier échange. Si aucun ne vous convient, proposez-nous un autre moment.',
    ],
  },
  OFFER: {
    title: 'Faire une proposition',
    action: 'Envoyer la proposition',
    hint: 'Vous pourrez ensuite marquer le candidat comme embauché.',
    templates: [
      'Nous avons le plaisir de vous faire une proposition pour ce poste. Nous revenons vers vous avec les détails.',
    ],
  },
  HIRED: {
    title: 'Confirmer l\'embauche',
    action: 'Confirmer l\'embauche',
    hint: 'Décision définitive : la candidature sera close.',
    templates: ['Bienvenue dans l\'équipe ! Nous vous contactons pour préparer votre arrivée.'],
  },
  REJECTED: {
    title: 'Refuser la candidature',
    action: 'Refuser',
    hint: 'Vous aurez 10 secondes pour annuler avant l\'envoi au candidat.',
    templates: [
      'Merci pour votre candidature. Nous avons choisi un autre profil pour ce poste et vous souhaitons une bonne continuation.',
      'Votre profil ne correspond pas aux compétences recherchées pour ce poste. Nous gardons vos coordonnées pour de futures offres.',
    ],
  },
};

/** Délai pendant lequel un refus peut être annulé */
const UNDO_SECONDS = 10;

@Component({
  selector: 'app-job-applicants',
  standalone: true,
  imports: [RouterLink, DatePipe, SlotEditorComponent, ApplicantInterviewComponent, ApplicantInsightComponent],
  templateUrl: './job-applicants.component.html',
  styleUrl: './job-applicants.component.scss',
})
export class JobApplicantsComponent implements OnInit {
  private api = inject(RecruiterService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);
  private slotsApi = inject(InterviewSlotsService);

  readonly base = RECRUITER_BASE;
  readonly statusLabels = APPLICANT_STATUS_LABELS;
  readonly statusIcons = STATUS_ICONS;
  readonly statuses = STATUS_ORDER;
  readonly contractLabel = contractLabel;
  readonly scoreTone = scoreTone;
  readonly decisions = DECISIONS;
  readonly eventLabels = EVENT_LABELS;

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

  // ── Décision : fenêtre de confirmation, message, annulation du refus ──
  private decisionDialog = viewChild.required<ElementRef<HTMLDialogElement>>('decisionDialog');
  /** Décision en cours de préparation dans la fenêtre */
  readonly pending = signal<{ a: Applicant; status: RecruiterDecision } | null>(null);
  readonly decisionMessage = signal('');
  /** Créneaux saisis dans la fenêtre « Proposer un entretien » */
  readonly draftSlots = signal<SlotDraft[]>([newSlotDraft()]);
  readonly slotError = signal<string | null>(null);
  /** Refus confirmé, envoyé à la fin du compte à rebours sauf annulation */
  readonly undo = signal<{ a: Applicant; message: string; seconds: number } | null>(null);
  private undoTimer: ReturnType<typeof setInterval> | null = null;

  // ── Historique de la candidature ouverte ──
  readonly history = signal<ApplicationEvent[]>([]);
  readonly historyLoading = signal(false);

  readonly counts = computed(() => {
    const counts: Record<ApplicantStatus, number> = {
      APPLIED: 0, UNDER_REVIEW: 0, INTERVIEW: 0, ASSESSMENT: 0, OFFER: 0, HIRED: 0, REJECTED: 0, WITHDRAWN: 0,
    };
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

  constructor() {
    // Historique rechargé à chaque candidat ouvert
    effect(() => {
      const id = this.selectedId();
      untracked(() => this.loadHistory(id));
    }, { allowSignalWrites: true });

    // Page quittée pendant le compte à rebours : le refus est envoyé tout de suite
    this.destroyRef.onDestroy(() => {
      const u = this.undo();
      if (this.undoTimer) clearInterval(this.undoTimer);
      if (u) this.api.decide(u.a.applicationId, 'REJECTED', u.message).subscribe({ error: () => undefined });
    });
  }

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
    if (this.pending()) return; // la fenêtre de décision gère Échap
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

  /** Ouvre la fenêtre de décision (message facultatif, confirmation) */
  openDecision(a: Applicant, status: RecruiterDecision): void {
    // Déjà à l'étape Entretien : le bouton sert à proposer (de nouveaux) créneaux
    const reproposeInterview = status === 'INTERVIEW' && a.status === 'INTERVIEW';
    if ((a.status === status && !reproposeInterview) || this.isClosed(a) || this.busyId() === a.applicationId) return;
    this.actionError.set(null);
    this.pending.set({ a, status });
    this.decisionMessage.set('');
    this.draftSlots.set([newSlotDraft()]);
    this.slotError.set(null);
    this.decisionDialog().nativeElement.showModal();
  }

  closeDecision(): void {
    const el = this.decisionDialog().nativeElement;
    if (el.open) el.close();
    this.pending.set(null);
  }

  useTemplate(text: string): void {
    this.decisionMessage.set(text);
  }

  onMessage(event: Event): void {
    this.decisionMessage.set((event.target as HTMLTextAreaElement).value);
  }

  /** Bouton de confirmation : un refus attend 10 s (annulable), le reste part tout de suite */
  confirmDecision(): void {
    const p = this.pending();
    if (!p) return;
    const message = this.decisionMessage().trim();
    if (p.status === 'INTERVIEW') {
      // Entretien = créneaux obligatoires : la fenêtre reste ouverte tant qu'ils sont incomplets
      const problem = checkDrafts(this.draftSlots());
      this.slotError.set(problem);
      if (problem) return;
      const slots = this.draftSlots();
      this.closeDecision();
      this.proposeInterview(p.a, slots, message);
      return;
    }
    this.closeDecision();
    if (p.status === 'REJECTED') this.startUndo(p.a, message);
    else this.send(p.a, p.status, message);
  }

  /** Annule le refus pendant le compte à rebours : rien n'est envoyé */
  cancelUndo(): void {
    if (this.undoTimer) clearInterval(this.undoTimer);
    this.undoTimer = null;
    this.undo.set(null);
  }

  private startUndo(a: Applicant, message: string): void {
    // Un refus déjà en attente pour un autre candidat part immédiatement
    const previous = this.undo();
    if (previous) {
      this.cancelUndo();
      this.send(previous.a, 'REJECTED', previous.message);
    }
    this.undo.set({ a, message, seconds: UNDO_SECONDS });
    this.undoTimer = setInterval(() => {
      const u = this.undo();
      if (!u) return;
      if (u.seconds > 1) {
        this.undo.set({ ...u, seconds: u.seconds - 1 });
      } else {
        this.cancelUndo();
        this.send(u.a, 'REJECTED', u.message);
      }
    }, 1000);
  }

  private send(a: Applicant, status: RecruiterDecision, message: string): void {
    this.busyId.set(a.applicationId);
    this.actionError.set(null);
    this.api.decide(a.applicationId, status, message).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.applicants.update(list => list.map(x => (x.applicationId === updated.applicationId ? updated : x)));
        this.busyId.set(null);
        if (this.selectedId() === updated.applicationId) this.loadHistory(updated.applicationId);
      },
      error: err => {
        this.actionError.set(toRecruiterError(err).message);
        this.busyId.set(null);
      },
    });
  }

  /** Passe la candidature à « Entretien » avec les créneaux proposés (une seule notification au candidat) */
  private proposeInterview(a: Applicant, slots: SlotDraft[], message: string): void {
    this.busyId.set(a.applicationId);
    this.actionError.set(null);
    this.slotsApi.propose(a.applicationId, slots, message).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.onInterviewChanged(result.applicant);
        this.busyId.set(null);
      },
      error: err => {
        this.actionError.set(toRecruiterError(err).message);
        this.busyId.set(null);
      },
    });
  }

  /** Créneaux envoyés / entretien confirmé depuis le bloc « Rendez-vous » */
  onInterviewChanged(updated: Applicant | null): void {
    if (updated) {
      this.applicants.update(list => list.map(x => (x.applicationId === updated.applicationId ? updated : x)));
    }
    const id = this.selectedId();
    if (id !== null) this.loadHistory(id);
  }

  private loadHistory(applicationId: number | null): void {
    this.history.set([]);
    if (applicationId === null) return;
    this.historyLoading.set(true);
    this.api.history(applicationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: events => {
        if (this.selectedId() === applicationId) this.history.set(events);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  /** Embauché ou retiré : plus aucune décision possible */
  isClosed(a: Applicant): boolean {
    return a.status === 'HIRED' || a.status === 'WITHDRAWN';
  }

  /** Refus en attente d'envoi pour ce candidat */
  isUndoing(a: Applicant): boolean {
    return this.undo()?.a.applicationId === a.applicationId;
  }

  eventIcon(e: ApplicationEvent): string {
    switch (e.toStatus) {
      case 'APPLIED': return 'ti-send';
      case 'UNDER_REVIEW': return 'ti-eye';
      case 'INTERVIEW': return 'ti-calendar-event';
      case 'ASSESSMENT': return 'ti-clipboard-check';
      case 'OFFER': return 'ti-rosette-discount-check';
      case 'HIRED': return 'ti-briefcase';
      case 'REJECTED': return 'ti-circle-x';
      case 'WITHDRAWN': return 'ti-arrow-back-up';
      default: return 'ti-point';
    }
  }

  eventActor(e: ApplicationEvent): string {
    if (e.actorRole === 'CANDIDATE') return 'par le candidat';
    if (e.actorRole === 'SYSTEM') return 'automatique';
    return e.actorName ? `par ${e.actorName}` : 'par le recruteur';
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