import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { sectorLabel } from '../../../core/models/sector.utils';
import {
  Company,
  RecruiterJob,
  RecruiterService,
  contractLabel,
  toRecruiterError,
} from '../../../core/services/recruiter.service';
import { RECRUITER_BASE } from '../recruiter.routes';

type JobFilter = 'all' | 'active' | 'closed';
type JobSort = 'recent' | 'applicants' | 'title';

/** € et – écrits en code Unicode : s'affichent correctement quel que soit l'encodage de l'éditeur */
const EURO = '€';
const DASH = '–';

/** Message proposé aux candidats en attente quand l'offre est fermée */
const DEFAULT_CLOSE_MESSAGE =
  'Merci pour votre candidature. Ce poste est maintenant pourvu ; nous gardons votre profil pour de futures offres.';

@Component({
  selector: 'app-recruiter-jobs',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './recruiter-jobs.component.html',
  styleUrl: './recruiter-jobs.component.scss',
})
export class RecruiterJobsComponent implements OnInit {
  private api = inject(RecruiterService);
  private destroyRef = inject(DestroyRef);

  readonly base = RECRUITER_BASE;
  readonly contractLabel = contractLabel;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly company = signal<Company | null>(null);
  readonly jobs = signal<RecruiterJob[]>([]);
  readonly filter = signal<JobFilter>('all');
  readonly sortBy = signal<JobSort>('recent');
  readonly query = signal('');
  /** Offre en cours d'ouverture / fermeture */
  readonly busyId = signal<number | null>(null);

  // ── Fermeture d'une offre qui a des candidats ──
  private closeDialog = viewChild.required<ElementRef<HTMLDialogElement>>('closeDialog');
  readonly closing = signal<RecruiterJob | null>(null);
  /** Refuser en une fois les candidatures encore en attente (Nouvelle, Entretien) */
  readonly rejectRemaining = signal(true);
  readonly closeMessage = signal(DEFAULT_CLOSE_MESSAGE);

  readonly stats = computed(() => {
    const list = this.jobs();
    const active = list.filter(j => j.active).length;
    const applicants = list.reduce((sum, j) => sum + j.applicantsCount, 0);
    return {
      total: list.length,
      active,
      closed: list.length - active,
      applicants,
      average: list.length ? Math.round((applicants / list.length) * 10) / 10 : 0,
    };
  });

  /** Plus grand nombre de candidats sur une offre (pour la barre de popularité) */
  readonly maxApplicants = computed(() => Math.max(1, ...this.jobs().map(j => j.applicantsCount)));

  readonly visibleJobs = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    const list = this.jobs().filter(j =>
      (f === 'all' || (f === 'active') === j.active)
      && (!q || `${j.title} ${j.location} ${j.skills.join(' ')}`.toLowerCase().includes(q)));

    switch (this.sortBy()) {
      case 'applicants': return list.sort((a, b) => b.applicantsCount - a.applicantsCount);
      case 'title': return list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      default: return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getCompany().pipe(
      switchMap(company => {
        this.company.set(company);
        // Pas d'entreprise : inutile d'appeler /jobs (il répondrait 409)
        return company ? this.api.listJobs() : of<RecruiterJob[]>([]);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: jobs => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(toRecruiterError(err).message);
        this.loading.set(false);
      },
    });
  }

  setFilter(value: JobFilter): void {
    this.filter.set(value);
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as JobSort);
  }

  /** Fermer une offre la retire des recherches ; les candidatures restent consultables */
  toggleActive(job: RecruiterJob): void {
    // Fermer une offre qui a des candidats : on propose de leur répondre en une fois
    if (job.active && job.applicantsCount > 0) {
      this.closing.set(job);
      this.rejectRemaining.set(true);
      this.closeMessage.set(DEFAULT_CLOSE_MESSAGE);
      this.closeDialog().nativeElement.showModal();
      return;
    }
    this.busyId.set(job.id);
    this.error.set(null);
    this.api.setJobActive(job.id, !job.active).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.jobs.update(list => list.map(j => (j.id === updated.id ? updated : j)));
        this.busyId.set(null);
      },
      error: err => {
        this.error.set(toRecruiterError(err).message);
        this.busyId.set(null);
      },
    });
  }

  cancelClose(): void {
    const el = this.closeDialog().nativeElement;
    if (el.open) el.close();
    this.closing.set(null);
  }

  onRejectToggle(event: Event): void {
    this.rejectRemaining.set((event.target as HTMLInputElement).checked);
  }

  onCloseMessage(event: Event): void {
    this.closeMessage.set((event.target as HTMLTextAreaElement).value);
  }

  confirmClose(): void {
    const job = this.closing();
    if (!job) return;
    const body = { rejectRemaining: this.rejectRemaining(), message: this.closeMessage().trim() || null };
    this.cancelClose();
    this.busyId.set(job.id);
    this.error.set(null);
    this.api.closeJob(job.id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.jobs.update(list => list.map(j => (j.id === updated.id ? updated : j)));
        this.busyId.set(null);
      },
      error: err => {
        this.error.set(toRecruiterError(err).message);
        this.busyId.set(null);
      },
    });
  }

  // ── Affichage ───────────────────────────────────────────

  salary(job: RecruiterJob): string | null {
    const fmt = (n: number) => `${Math.round(n / 1000)} k${EURO}`;
    if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)} ${DASH} ${fmt(job.salaryMax)}`;
    if (job.salaryMin) return `dès ${fmt(job.salaryMin)}`;
    if (job.salaryMax) return `jusqu'à ${fmt(job.salaryMax)}`;
    return null;
  }

  sector(code: string | null): string {
    return code ? sectorLabel(code) : '';
  }

  /** « aujourd'hui », « hier », « il y a 5 jours », « il y a 3 semaines »… */
  ago(date: string): string {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    if (days < 14) return `il y a ${days} jours`;
    if (days < 60) return `il y a ${Math.floor(days / 7)} semaines`;
    return `il y a ${Math.floor(days / 30)} mois`;
  }

  /** Largeur de la barre de popularité, de 0 à 100 % */
  popularity(job: RecruiterJob): number {
    return Math.round((job.applicantsCount / this.maxApplicants()) * 100);
  }

  companyInitials(c: Company): string {
    return c.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
  }
}
