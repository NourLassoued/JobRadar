import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  ActivityItem,
  ApplicationCard,
  ApplicationDetail,
  ApplicationTrackingService,
} from '../../../../core/services/application-tracking.service';
import {
  ACTIVITY_TYPES,
  ActivityType,
  ApplicationStatus,
  STATUS_LABELS,
  activityIcon,
  activityLabel,
  contractLabel,
} from '../../../../core/models/application-status';
import { InterviewSlotsComponent } from '../interview-slots/interview-slots.component';

type Tab = 'overview' | 'tracking' | 'history';

/**
 * Panneau de détail d'une candidature : offre, documents envoyés, contact recruteur, relance,
 * événements (entretien, appel, test), notes personnelles et historique des étapes.
 */
@Component({
  selector: 'jr-application-detail',
  standalone: true,
  imports: [ReactiveFormsModule, InterviewSlotsComponent],
  templateUrl: './application-detail.component.html',
  styleUrl: './application-detail.component.scss',
})
export class ApplicationDetailComponent {
  private api = inject(ApplicationTrackingService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private loadSub: Subscription | null = null;

  /** Candidature à afficher */
  readonly applicationId = input.required<number>();
  readonly closed = output<void>();
  /** La carte a changé (étape, relance, prochain entretien…) : le Kanban la remplace */
  readonly cardChanged = output<ApplicationCard>();
  readonly removed = output<number>();

  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly statusLabels = STATUS_LABELS;
  readonly activityTypes = ACTIVITY_TYPES;

  readonly detail = signal<ApplicationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('overview');
  /** Action en cours (désactive les boutons concernés) */
  readonly busy = signal<string | null>(null);
  /** Message d'erreur ou de confirmation dans le panneau */
  readonly feedback = signal<{ text: string; kind: 'success' | 'error' } | null>(null);
  readonly confirmRemove = signal(false);
  readonly descriptionOpen = signal(false);
  readonly showActivityForm = signal(false);

  readonly card = computed(() => this.detail()?.card ?? null);
  /** Candidature ajoutée à la main : intitulé, entreprise et lien modifiables */
  readonly editableJob = computed(() => !!this.card() && this.card()!.jobOfferId === null);
  readonly canDelete = computed(() => {
    const c = this.card();
    return !!c && (!c.managedByRecruiter || c.status === 'TO_APPLY');
  });
  readonly canWithdraw = computed(() => {
    const c = this.card();
    return !!c && c.managedByRecruiter && c.allowedMoves.includes('WITHDRAWN');
  });
  readonly upcoming = computed(() => (this.detail()?.activities ?? []).filter(a => !a.done && new Date(a.scheduledAt) >= new Date()));
  readonly past = computed(() => (this.detail()?.activities ?? []).filter(a => a.done || new Date(a.scheduledAt) < new Date()));

  // ── Formulaires ────────────────────────────────────────────
  readonly jobForm = this.fb.nonNullable.group({
    jobTitle: ['', [Validators.required, Validators.maxLength(255)]],
    company: ['', Validators.maxLength(255)],
    jobUrl: ['', [Validators.maxLength(1000), Validators.pattern(/^(https?:\/\/\S+)?$/i)]],
    location: ['', Validators.maxLength(150)],
    contractType: ['', Validators.maxLength(40)],
    appliedAt: [''],
  });

  readonly contactForm = this.fb.nonNullable.group({
    contactName: ['', Validators.maxLength(120)],
    contactRole: ['', Validators.maxLength(120)],
    contactEmail: ['', [Validators.email, Validators.maxLength(150)]],
    contactPhone: ['', [Validators.maxLength(40), Validators.pattern(/^[+0-9 ().-]*$/)]],
  });

  readonly followUpControl = this.fb.nonNullable.control('');

  readonly activityForm = this.fb.nonNullable.group({
    type: ['INTERVIEW' as ActivityType, Validators.required],
    title: ['Entretien', [Validators.required, Validators.maxLength(150)]],
    scheduledAt: ['', Validators.required],
    location: ['', Validators.maxLength(300)],
    details: ['', Validators.maxLength(5000)],
  });

  readonly noteControl = this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(5000)]);

  constructor() {
    // Recharge quand on ouvre une autre carte sans fermer le panneau
    effect(() => {
      const id = this.applicationId();
      untracked(() => this.load(id));
    });
    // Le titre de l'événement suit son type tant que l'utilisateur ne l'a pas modifié
    this.activityForm.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => {
      const title = this.activityForm.controls.title;
      if (!title.dirty) title.setValue(activityLabel(type));
    });
  }

  // ── Chargement ─────────────────────────────────────────────

  load(id: number): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.confirmRemove.set(false);
    this.loadSub = this.api.detail(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        this.apply(detail);
        this.loading.set(false);
        queueMicrotask(() => this.closeButton()?.nativeElement.focus());
      },
      error: err => {
        this.error.set(ApplicationTrackingService.errorMessage(err, 'Impossible d\'ouvrir cette candidature.'));
        this.loading.set(false);
      },
    });
  }

  /** Met à jour le panneau et les formulaires avec la réponse de l'API */
  private apply(detail: ApplicationDetail): void {
    this.detail.set(detail);
    const c = detail.card;
    this.jobForm.reset({
      jobTitle: c.jobTitle ?? '',
      company: c.company ?? '',
      jobUrl: c.jobUrl ?? '',
      location: c.location ?? '',
      contractType: c.contractType ?? '',
      appliedAt: c.appliedAt ?? '',
    });
    this.contactForm.reset({
      contactName: detail.contact.name ?? '',
      contactRole: detail.contact.role ?? '',
      contactEmail: detail.contact.email ?? '',
      contactPhone: detail.contact.phone ?? '',
    });
    this.followUpControl.reset(c.followUpAt ?? '');
  }

  /** Créneau d'entretien choisi ou proposé : l'événement apparaît dans le suivi, la carte affiche la date */
  onSlotsChanged(message: string): void {
    this.refresh(message);
  }

  /** Recharge le détail après une modification et prévient le Kanban */
  private refresh(message?: string): void {
    const id = this.applicationId();
    this.api.detail(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        this.apply(detail);
        this.cardChanged.emit(detail.card);
        this.busy.set(null);
        if (message) this.feedback.set({ text: message, kind: 'success' });
      },
      error: err => this.fail(err),
    });
  }

  private fail(err: unknown, fallback = 'L\'enregistrement a échoué. Réessayez.'): void {
    this.busy.set(null);
    this.feedback.set({ text: ApplicationTrackingService.errorMessage(err, fallback), kind: 'error' });
  }

  // ── Étape ──────────────────────────────────────────────────

  changeStatus(value: string): void {
    const c = this.card();
    if (!c || !value || value === c.status) return;
    const status = value as ApplicationStatus;
    this.busy.set('status');
    this.feedback.set(null);
    this.api.move(c.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.refresh(`Candidature déplacée vers « ${STATUS_LABELS[status]} ».`),
      error: err => this.fail(err, 'Le changement d\'étape a échoué.'),
    });
  }

  withdraw(): void {
    this.confirmRemove.set(false);
    this.changeStatus('WITHDRAWN');
  }

  remove(): void {
    const c = this.card();
    if (!c) return;
    this.busy.set('remove');
    this.api.remove(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(null);
        this.removed.emit(c.id);
      },
      error: err => {
        this.confirmRemove.set(false);
        this.fail(err, 'La suppression a échoué.');
      },
    });
  }

  // ── Poste (candidature externe) et contact ─────────────────

  saveJob(): void {
    const c = this.card();
    if (!c || this.jobForm.invalid) {
      this.jobForm.markAllAsTouched();
      return;
    }
    const v = this.jobForm.getRawValue();
    this.busy.set('job');
    this.api.update(c.id, {
      jobTitle: v.jobTitle.trim(),
      company: v.company.trim(),
      jobUrl: v.jobUrl.trim(),
      location: v.location.trim(),
      contractType: v.contractType.trim(),
      appliedAt: v.appliedAt || null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => this.saved(detail, 'Informations du poste enregistrées.'),
      error: err => this.fail(err),
    });
  }

  saveContact(): void {
    const c = this.card();
    if (!c || this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    const v = this.contactForm.getRawValue();
    this.busy.set('contact');
    this.api.update(c.id, {
      contactName: v.contactName.trim(),
      contactRole: v.contactRole.trim(),
      contactEmail: v.contactEmail.trim(),
      contactPhone: v.contactPhone.trim(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => this.saved(detail, 'Contact enregistré.'),
      error: err => this.fail(err),
    });
  }

  private saved(detail: ApplicationDetail, message: string): void {
    this.apply(detail);
    this.cardChanged.emit(detail.card);
    this.busy.set(null);
    this.feedback.set({ text: message, kind: 'success' });
  }

  // ── Relance ────────────────────────────────────────────────

  /** Date de relance dans n jours */
  suggestFollowUp(days: number): void {
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.followUpControl.setValue(toIsoDay(d));
    this.followUpControl.markAsDirty();
  }

  saveFollowUp(clear = false): void {
    const c = this.card();
    if (!c) return;
    const value = clear ? null : this.followUpControl.value || null;
    this.busy.set('followup');
    this.api.setFollowUp(c.id, value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => this.saved(detail, value ? `Relance prévue le ${formatDay(value)}.` : 'Relance supprimée.'),
      error: err => this.fail(err),
    });
  }

  // ── Événements ─────────────────────────────────────────────

  openActivityForm(): void {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    this.activityForm.reset({
      type: 'INTERVIEW',
      title: 'Entretien',
      scheduledAt: toIsoLocal(d),
      location: '',
      details: '',
    });
    this.showActivityForm.set(true);
  }

  addActivity(): void {
    const c = this.card();
    if (!c || this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }
    const v = this.activityForm.getRawValue();
    this.busy.set('activity');
    this.api.addActivity(c.id, {
      type: v.type,
      title: v.title.trim(),
      scheduledAt: v.scheduledAt.length === 16 ? v.scheduledAt + ':00' : v.scheduledAt,
      location: v.location.trim() || null,
      details: v.details.trim() || null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.showActivityForm.set(false);
        this.refresh(`${activityLabel(v.type)} ajouté(e) le ${formatDateTime(v.scheduledAt)}.`);
      },
      error: err => this.fail(err),
    });
  }

  toggleDone(activity: ActivityItem): void {
    const c = this.card();
    if (!c) return;
    this.busy.set('activity-' + activity.id);
    this.api.setActivityDone(c.id, activity.id, !activity.done).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.refresh(),
      error: err => this.fail(err),
    });
  }

  deleteActivity(activity: ActivityItem): void {
    const c = this.card();
    if (!c) return;
    this.busy.set('activity-' + activity.id);
    this.api.deleteActivity(c.id, activity.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.refresh('Événement supprimé.'),
      error: err => this.fail(err),
    });
  }

  // ── Notes ──────────────────────────────────────────────────

  addNote(): void {
    const c = this.card();
    const content = this.noteControl.value.trim();
    if (!c || !content || this.noteControl.invalid) return;
    this.busy.set('note');
    this.api.addNote(c.id, content).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: note => {
        this.detail.update(d => (d ? { ...d, notes: [note, ...d.notes] } : d));
        this.noteControl.reset('');
        this.busy.set(null);
      },
      error: err => this.fail(err),
    });
  }

  /** Ctrl + Entrée (ou Cmd + Entrée) ajoute la note */
  onNoteKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.addNote();
    }
  }

  deleteNote(noteId: number): void {
    const c = this.card();
    if (!c) return;
    this.busy.set('note-' + noteId);
    this.api.deleteNote(c.id, noteId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.detail.update(d => (d ? { ...d, notes: d.notes.filter(n => n.id !== noteId) } : d));
        this.busy.set(null);
      },
      error: err => this.fail(err),
    });
  }

  // ── Affichage ──────────────────────────────────────────────

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  initials(c: ApplicationCard): string {
    const name = (c.company ?? c.jobTitle).trim();
    return name.split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
  }

  contract(value: string | null): string {
    return contractLabel(value);
  }

  salary(min: number | null, max: number | null): string {
    const f = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
    if (min && max) return min === max ? f(min) : `${f(min)} – ${f(max)}`;
    if (min) return `À partir de ${f(min)}`;
    if (max) return `Jusqu'à ${f(max)}`;
    return '';
  }

  /** Lien http(s) seulement (jamais javascript:, data:…) */
  safeLink(url: string | null | undefined): string | null {
    return url && /^https?:\/\//i.test(url) ? url : null;
  }

  day(iso: string | null | undefined): string {
    return iso ? formatDay(iso.slice(0, 10)) : '';
  }

  dateTime(iso: string): string {
    return formatDateTime(iso);
  }

  activityIcon(type: ActivityType): string {
    return activityIcon(type);
  }

  activityLabel(type: ActivityType): string {
    return activityLabel(type);
  }

  actor(role: string): string {
    switch (role) {
      case 'CANDIDATE': return 'Vous';
      case 'RECRUITER': return 'Le recruteur';
      case 'ADMIN': return 'L\'administrateur';
      default: return 'JobRadar';
    }
  }

  /** État de la relance : en retard, aujourd'hui, à venir */
  followUpState(): 'late' | 'today' | 'later' | null {
    const value = this.card()?.followUpAt;
    if (!value) return null;
    const today = toIsoDay(new Date());
    return value < today ? 'late' : value === today ? 'today' : 'later';
  }

  invalid(control: { invalid: boolean; touched: boolean }): boolean {
    return control.invalid && control.touched;
  }
}

// ── Dates ────────────────────────────────────────────────────

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toIsoLocal(d: Date): string {
  return `${toIsoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
}