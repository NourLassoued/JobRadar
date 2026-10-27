import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ApplyResponse, ApplyService } from '../../../../core/services/apply.service';

/** Ce dont le bouton a besoin dans une offre (compatible avec JobOffer de job.service) */
export interface ApplyableOffer {
  id: number;
  source?: string | null;
  isActive?: boolean;
}

type ApplyState = 'idle' | 'sending' | 'done' | 'error';

/**
 * Bouton « Postuler » pour les offres publiées directement sur JobRadar (source JOBRADAR).
 * Pour les autres sources, il ne s'affiche pas : la candidature se fait sur le site d'origine.
 *
 * Utilisation dans la modale de l'offre :
 *   <app-apply-button [offer]="offer()" [coverLetter]="letterText()" (applied)="onApplied($event)" />
 */
@Component({
  selector: 'app-apply-button',
  standalone: true,
  templateUrl: './apply-button.component.html',
  styleUrl: './apply-button.component.scss',
})
export class ApplyButtonComponent {
  private api = inject(ApplyService);
  private destroyRef = inject(DestroyRef);

  readonly offer = input.required<ApplyableOffer>();
  /** Lettre générée par l'IA, proposée en pièce jointe */
  readonly coverLetter = input<string | null>(null);
  /** CV à joindre ; sinon le CV du profil */
  readonly cvId = input<number | null>(null);

  readonly applied = output<ApplyResponse>();

  readonly state = signal<ApplyState>('idle');
  readonly message = signal<string | null>(null);
  readonly attachLetter = signal(true);

  readonly visible = computed(() => this.offer().source === 'JOBRADAR');
  readonly closed = computed(() => this.offer().isActive === false);
  readonly hasLetter = computed(() => !!this.coverLetter()?.trim());

  toggleLetter(event: Event): void {
    this.attachLetter.set((event.target as HTMLInputElement).checked);
  }

  apply(): void {
    if (this.state() === 'sending' || this.state() === 'done') return;
    this.state.set('sending');
    this.message.set(null);

    this.api.apply({
      jobOfferId: this.offer().id,
      cvId: this.cvId(),
      coverLetter: this.hasLetter() && this.attachLetter() ? this.coverLetter() : null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.state.set('done');
        this.message.set('Candidature envoyée. Elle apparaît dans votre suivi, colonne « Postulé ».');
        this.applied.emit(res);
      },
      error: (err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        const body = err instanceof HttpErrorResponse ? (err.error as { message?: string } | null) : null;
        if (status === 409 && body?.message?.includes('déjà postulé')) {
          this.state.set('done');
          this.message.set('Vous avez déjà postulé à cette offre.');
          return;
        }
        this.state.set('error');
        this.message.set(body?.message || "La candidature n'a pas pu être envoyée. Réessayez.");
      },
    });
  }
}