import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Applicant } from './recruiter.service';

// ── Modèles (InterviewSlotDtos) ───────────────────────────

export type SlotMode = 'VIDEO' | 'PHONE' | 'ONSITE';
export type SlotAuthor = 'RECRUITER' | 'CANDIDATE';
export type SlotStatus = 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
/** NONE · WAITING_CANDIDATE (le candidat doit choisir) · WAITING_RECRUITER (le candidat a proposé un moment) · CONFIRMED */
export type SlotState = 'NONE' | 'WAITING_CANDIDATE' | 'WAITING_RECRUITER' | 'CONFIRMED';

export interface SlotItem {
  id: number;
  /** yyyy-MM-ddTHH:mm:ss (heure locale) */
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  mode: SlotMode;
  location: string | null;
  proposedBy: SlotAuthor;
  status: SlotStatus;
  message: string | null;
  createdAt: string;
}

export interface InterviewSlots {
  state: SlotState;
  /** Créneaux en attente de réponse */
  proposals: SlotItem[];
  /** Entretien fixé */
  confirmed: SlotItem | null;
}

/** Créneau saisi par le recruteur */
export interface SlotDraft {
  /** valeur d'un <input type="datetime-local"> : yyyy-MM-ddTHH:mm */
  startsAt: string;
  durationMinutes: number;
  mode: SlotMode;
  location: string;
}

export interface ProposeResult {
  /** Rempli quand la candidature vient de passer à « Entretien » */
  applicant: Applicant | null;
  slots: InterviewSlots;
}

export const SLOT_MODES: { value: SlotMode; label: string; icon: string; placeholder: string }[] = [
  { value: 'VIDEO', label: 'Visio', icon: 'ti-video', placeholder: 'Lien de la visio (Meet, Teams, Zoom…)' },
  { value: 'PHONE', label: 'Téléphone', icon: 'ti-phone', placeholder: 'Numéro à appeler (facultatif)' },
  { value: 'ONSITE', label: 'Sur place', icon: 'ti-building', placeholder: 'Adresse de l\'entretien' },
];

export const SLOT_DURATIONS = [30, 45, 60, 90];

export function slotModeLabel(mode: SlotMode): string {
  return SLOT_MODES.find(m => m.value === mode)?.label ?? mode;
}

export function slotModeIcon(mode: SlotMode): string {
  return SLOT_MODES.find(m => m.value === mode)?.icon ?? 'ti-calendar';
}

/** « mardi 12 novembre » */
export function slotDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** « 10:00 – 11:00 » */
export function slotHours(slot: Pick<SlotItem, 'startsAt' | 'endsAt'>): string {
  const t = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${t(slot.startsAt)} – ${t(slot.endsAt)}`;
}

/** Lien http(s) uniquement (jamais javascript:…) */
export function slotLink(location: string | null): string | null {
  return location && /^https?:\/\/\S+$/i.test(location.trim()) ? location.trim() : null;
}

/** Valeur datetime-local minimale : maintenant + n minutes */
export function localInputValue(minutesFromNow = 0): string {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Vérifie les créneaux du recruteur avant l'envoi ; renvoie le message d'erreur ou null */
export function checkDrafts(drafts: SlotDraft[]): string | null {
  if (!drafts.length) return 'Ajoutez au moins un créneau.';
  if (drafts.length > 3) return 'Proposez 3 créneaux au maximum.';
  const min = Date.now() + 30 * 60_000;
  const seen = new Set<string>();
  for (const [i, d] of drafts.entries()) {
    if (!d.startsAt) return `Indiquez la date et l'heure du créneau ${i + 1}.`;
    if (new Date(d.startsAt).getTime() < min) return `Le créneau ${i + 1} doit commencer au moins 30 minutes après maintenant.`;
    if (seen.has(d.startsAt)) return 'Deux créneaux sont identiques.';
    seen.add(d.startsAt);
    if (d.mode === 'ONSITE' && !d.location.trim()) return `Indiquez l'adresse du créneau ${i + 1}.`;
  }
  return null;
}

// ── Service ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class InterviewSlotsService {
  private http = inject(HttpClient);
  private recruiter = `${environment.apiUrl}/recruiter/applications`;
  private tracking = `${environment.apiUrl}/tracking/applications`;

  // Recruteur
  recruiterSlots(applicationId: number): Observable<InterviewSlots> {
    return this.http.get<InterviewSlots>(`${this.recruiter}/${applicationId}/interview-slots`);
  }

  propose(applicationId: number, slots: SlotDraft[], message?: string | null): Observable<ProposeResult> {
    return this.http.post<ProposeResult>(`${this.recruiter}/${applicationId}/interview-slots`, {
      message: message?.trim() || null,
      slots: slots.map(s => ({
        startsAt: s.startsAt,
        durationMinutes: s.durationMinutes,
        mode: s.mode,
        location: s.location.trim() || null,
      })),
    });
  }

  confirmCandidateProposal(applicationId: number, slotId: number, mode: SlotMode, location: string): Observable<InterviewSlots> {
    return this.http.post<InterviewSlots>(`${this.recruiter}/${applicationId}/interview-slots/${slotId}/confirm`, {
      mode,
      location: location.trim() || null,
    });
  }

  // Candidat
  candidateSlots(applicationId: number): Observable<InterviewSlots> {
    return this.http.get<InterviewSlots>(`${this.tracking}/${applicationId}/interview-slots`);
  }

  accept(applicationId: number, slotId: number): Observable<InterviewSlots> {
    return this.http.post<InterviewSlots>(`${this.tracking}/${applicationId}/interview-slots/${slotId}/accept`, {});
  }

  counter(applicationId: number, startsAt: string, message?: string | null): Observable<InterviewSlots> {
    return this.http.post<InterviewSlots>(`${this.tracking}/${applicationId}/interview-slots/counter`, {
      startsAt,
      message: message?.trim() || null,
    });
  }
}
