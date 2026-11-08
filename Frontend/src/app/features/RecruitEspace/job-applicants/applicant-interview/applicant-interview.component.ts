import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  InterviewSlots,
  InterviewSlotsService,
  SLOT_MODES,
  SlotDraft,
  SlotItem,
  SlotMode,
  checkDrafts,
  slotDay,
  slotHours,
  slotLink,
  slotModeIcon,
  slotModeLabel,
} from '../../../../core/services/interview-slots.service';
import { Applicant, ApplicantStatus, toRecruiterError } from '../../../../core/services/recruiter.service';
import { SlotEditorComponent, newSlotDraft } from '../slot-editor/slot-editor.component';

/**
 * Côté recruteur : où en est la prise de rendez-vous avec ce candidat.
 * Créneaux en attente, moment proposé par le candidat (à accepter), entretien fixé (à reprogrammer).
 */
@Component({
  selector: 'jr-applicant-interview',
  standalone: true,
  imports: [SlotEditorComponent],
  templateUrl: './applicant-interview.component.html',
  styleUrl: './applicant-interview.component.scss',
})
export class ApplicantInterviewComponent {
  private api = inject(InterviewSlotsService);
  private destroyRef = inject(DestroyRef);
  private loadSub: Subscription | null = null;

  readonly applicationId = input.required<number>();
  readonly status = input.required<ApplicantStatus>();
  /** Créneaux envoyés ou entretien confirmé : la page recharge l'historique (et la candidature si fournie) */
  readonly changed = output<Applicant | null>();

  readonly data = signal<InterviewSlots | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly busy = signal(false);

  /** Saisie de nouveaux créneaux */
  readonly editing = signal(false);
  readonly drafts = signal<SlotDraft[]>([newSlotDraft()]);
  readonly message = signal('');

  /** Acceptation du moment proposé par le candidat : format et lien */
  readonly confirmMode = signal<SlotMode>('VIDEO');
  readonly confirmLocation = signal('');

  readonly modes = SLOT_MODES;
  readonly day = slotDay;
  readonly hours = slotHours;
  readonly modeLabel = slotModeLabel;
  readonly modeIcon = slotModeIcon;
  readonly link = slotLink;

  readonly closed = computed(() => this.status() === 'HIRED' || this.status() === 'WITHDRAWN');
  /** Le bloc n'apparaît qu'à l'étape Entretien, ou si un entretien a été fixé */
  readonly visible = computed(() => {
    const d = this.data();
    return this.status() === 'INTERVIEW' || (!!d && d.state !== 'NONE');
  });
  readonly candidateProposal = computed<SlotItem | null>(() => {
    const d = this.data();
    return d?.state === 'WAITING_RECRUITER' ? d.proposals[0] ?? null : null;
  });

  constructor() {
    effect(() => {
      const id = this.applicationId();
      this.status();
      untracked(() => this.load(id));
    });
  }

  load(id = this.applicationId()): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.loadSub = this.api.recruiterSlots(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        this.editing.set(false);
        const p = data.state === 'WAITING_RECRUITER' ? data.proposals[0] : null;
        if (p) {
          this.confirmMode.set(p.mode);
          this.confirmLocation.set(p.location ?? '');
        }
      },
      error: err => {
        this.loading.set(false);
        this.error.set(toRecruiterError(err).message);
      },
    });
  }

  startEditing(): void {
    const d = this.data();
    // Reprend le format et le lien déjà utilisés
    const model = d?.confirmed ?? d?.proposals[0] ?? null;
    const first = newSlotDraft();
    if (model) {
      first.mode = model.mode;
      first.location = model.location ?? '';
      first.durationMinutes = model.durationMinutes;
    }
    this.drafts.set([first]);
    this.message.set('');
    this.success.set(null);
    this.error.set(null);
    this.editing.set(true);
  }

  send(): void {
    const problem = checkDrafts(this.drafts());
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.propose(this.applicationId(), this.drafts(), this.message()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.data.set(result.slots);
        this.busy.set(false);
        this.editing.set(false);
        this.success.set('Créneaux envoyés : le candidat est prévenu.');
        this.changed.emit(result.applicant);
      },
      error: err => this.fail(err),
    });
  }

  acceptCandidateProposal(): void {
    const p = this.candidateProposal();
    if (!p || this.busy()) return;
    if (this.confirmMode() === 'ONSITE' && !this.confirmLocation().trim()) {
      this.error.set('Indiquez l\'adresse de l\'entretien.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.confirmCandidateProposal(this.applicationId(), p.id, this.confirmMode(), this.confirmLocation())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => {
          this.data.set(data);
          this.busy.set(false);
          this.success.set('Entretien confirmé : le candidat est prévenu.');
          this.changed.emit(null);
        },
        error: err => this.fail(err),
      });
  }

  onMessage(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  onConfirmLocation(event: Event): void {
    this.confirmLocation.set((event.target as HTMLInputElement).value);
  }

  placeholder(mode: SlotMode): string {
    return this.modes.find(m => m.value === mode)?.placeholder ?? '';
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.error.set(toRecruiterError(err).message);
  }
}
