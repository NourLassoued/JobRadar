import { Component, model, signal } from '@angular/core';
import {
  SLOT_DURATIONS,
  SLOT_MODES,
  SlotDraft,
  SlotMode,
  localInputValue,
} from '../../../../core/services/interview-slots.service';

/** Nouveau créneau : demain à 10 h, 1 h, en visio (ou les réglages du créneau précédent) */
export function newSlotDraft(previous?: SlotDraft): SlotDraft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const base = previous?.startsAt ? new Date(previous.startsAt) : null;
  if (base) base.setDate(base.getDate() + 1);
  const at = base && !isNaN(base.getTime()) ? base : tomorrow;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startsAt: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`,
    durationMinutes: previous?.durationMinutes ?? 60,
    mode: previous?.mode ?? 'VIDEO',
    location: previous?.location ?? '',
  };
}

/**
 * Saisie de 1 à 3 créneaux d'entretien (date, heure, durée, format, lien / adresse).
 * Utilisation : <jr-slot-editor [(slots)]="drafts" />
 */
@Component({
  selector: 'jr-slot-editor',
  standalone: true,
  templateUrl: './slot-editor.component.html',
  styleUrl: './slot-editor.component.scss',
})
export class SlotEditorComponent {
  readonly slots = model.required<SlotDraft[]>();

  readonly modes = SLOT_MODES;
  readonly durations = SLOT_DURATIONS;
  readonly max = 3;
  readonly minDate = signal(localInputValue(30));

  add(): void {
    const list = this.slots();
    if (list.length >= this.max) return;
    this.minDate.set(localInputValue(30));
    this.slots.set([...list, newSlotDraft(list[list.length - 1])]);
  }

  remove(index: number): void {
    if (this.slots().length <= 1) return;
    this.slots.set(this.slots().filter((_, i) => i !== index));
  }

  set<K extends keyof SlotDraft>(index: number, key: K, value: SlotDraft[K]): void {
    this.slots.set(this.slots().map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }

  onDate(index: number, event: Event): void {
    this.set(index, 'startsAt', (event.target as HTMLInputElement).value);
  }

  onDuration(index: number, event: Event): void {
    this.set(index, 'durationMinutes', Number((event.target as HTMLSelectElement).value));
  }

  onMode(index: number, mode: SlotMode): void {
    this.set(index, 'mode', mode);
  }

  onLocation(index: number, event: Event): void {
    this.set(index, 'location', (event.target as HTMLInputElement).value);
  }

  placeholder(mode: SlotMode): string {
    return this.modes.find(m => m.value === mode)?.placeholder ?? '';
  }
}
