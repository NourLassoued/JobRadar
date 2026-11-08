import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ApplicationStatus } from '../../../../core/models/application-status';
import { ApplicationTrackingService } from '../../../../core/services/application-tracking.service';
import {
  InterviewSlots,
  InterviewSlotsService,
  SlotItem,
  localInputValue,
  slotDay,
  slotHours,
  slotLink,
  slotModeIcon,
  slotModeLabel,
} from '../../../../core/services/interview-slots.service';

/**
 * Côté candidat : choisir un des créneaux d'entretien proposés par le recruteur,
 * ou proposer un autre moment. Affiché en haut de l'onglet « Suivi ».
 */
@Component({
  selector: 'jr-interview-slots',
  standalone: true,
  templateUrl: './interview-slots.component.html',
  styleUrl: './interview-slots.component.scss',
})
export class InterviewSlotsComponent {
  private api = inject(InterviewSlotsService);
  private destroyRef = inject(DestroyRef);
  private loadSub: Subscription | null = null;

  readonly applicationId = input.required<number>();
  readonly status = input.required<ApplicationStatus>();
  /** Un créneau a été accepté ou proposé : le détail (événements, carte) doit être rechargé */
  readonly changed = output<string>();

  readonly data = signal<InterviewSlots | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  /** Créneau sélectionné, en attente de confirmation */
  readonly selectedId = signal<number | null>(null);
  readonly showCounter = signal(false);
  readonly counterAt = signal('');
  readonly counterMessage = signal('');

  readonly minDate = signal(localInputValue(60));
  readonly selected = computed(() => this.data()?.proposals.find(s => s.id === this.selectedId()) ?? null);
  /** Rien à afficher : pas d'entretien en cours ni fixé */
  readonly hidden = computed(() => {
    const d = this.data();
    return !this.loading() && !this.error() && this.status() !== 'INTERVIEW' && (!d || d.state === 'NONE');
  });

  readonly day = slotDay;
  readonly hours = slotHours;
  readonly modeLabel = slotModeLabel;
  readonly modeIcon = slotModeIcon;
  readonly link = slotLink;

  constructor() {
    // Recharge quand on change de candidature ou quand l'étape change (décision du recruteur)
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
    this.loadSub = this.api.candidateSlots(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        this.reset();
      },
      error: err => {
        this.loading.set(false);
        this.error.set(ApplicationTrackingService.errorMessage(err, 'Impossible de charger les créneaux.'));
      },
    });
  }

  select(slot: SlotItem): void {
    this.selectedId.set(this.selectedId() === slot.id ? null : slot.id);
    this.showCounter.set(false);
  }

  confirm(): void {
    const slot = this.selected();
    if (!slot || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.accept(this.applicationId(), slot.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data.set(data);
        this.busy.set(false);
        this.reset();
        this.changed.emit(`Entretien confirmé le ${slotDay(slot.startsAt)} à ${slotHours(slot).split(' – ')[0]}. Le recruteur est prévenu.`);
      },
      error: err => this.fail(err),
    });
  }

  openCounter(): void {
    this.selectedId.set(null);
    this.minDate.set(localInputValue(60));
    this.showCounter.set(true);
  }

  sendCounter(): void {
    const at = this.counterAt();
    if (!at || this.busy()) return;
    if (new Date(at).getTime() < Date.now() + 30 * 60_000) {
      this.error.set('Choisissez un moment à venir (au moins dans 30 minutes).');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.counter(this.applicationId(), at, this.counterMessage()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data.set(data);
        this.busy.set(false);
        this.reset();
        this.changed.emit('Votre proposition a été envoyée au recruteur.');
      },
      error: err => this.fail(err),
    });
  }

  onInput(target: 'at' | 'message', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (target === 'at') this.counterAt.set(value);
    else this.counterMessage.set(value);
  }

  private reset(): void {
    this.selectedId.set(null);
    this.showCounter.set(false);
    this.counterAt.set('');
    this.counterMessage.set('');
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.error.set(ApplicationTrackingService.errorMessage(err, 'L\'envoi a échoué. Réessayez.'));
    // Un créneau devenu indisponible : on recharge l'état réel
    this.load();
  }
}