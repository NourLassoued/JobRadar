import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AiService, ScoreExplanation } from '../../../../core/services/ai.service';

/**
 * « Pourquoi ce score ? » : l'IA explique le score de compatibilité et propose 3 actions.
 * Affiché dans l'onglet Score de la fenêtre d'une offre. L'explication n'est demandée qu'au clic
 * (elle consomme une génération IA, sauf si elle est déjà en cache côté serveur).
 */
@Component({
  selector: 'app-score-explanation',
  standalone: true,
  templateUrl: './score-explanation.component.html',
  styleUrl: './score-explanation.component.scss',
})
export class ScoreExplanationComponent {
  private ai = inject(AiService);
  private destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;

  readonly offerId = input.required<number>();
  /** Score affiché : si le score change (profil modifié), l'ancienne explication est retirée */
  readonly score = input.required<number>();

  readonly explanation = signal<ScoreExplanation | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.offerId();
      this.score();
      untracked(() => this.reset());
    });
  }

  explain(): void {
    if (this.loading()) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const offerId = this.offerId();
    this.request = this.ai.explainScore(offerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (result.jobOfferId !== this.offerId()) return; // l'utilisateur a changé d'offre entre-temps
        this.explanation.set(result);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(errorText(err));
      },
    });
  }

  private reset(): void {
    this.request?.unsubscribe();
    this.request = null;
    this.explanation.set(null);
    this.error.set(null);
    this.loading.set(false);
  }
}

function errorText(err: HttpErrorResponse): string {
  const message = typeof err.error?.message === 'string' ? err.error.message : null;
  if (err.status === 0) return 'Serveur injoignable. Vérifiez votre connexion.';
  if (err.status === 401) return 'Session expirée : reconnectez-vous.';
  if (message) return message;
  if (err.status === 429) return 'Limite de générations atteinte pour aujourd\'hui.';
  return 'L\'explication n\'a pas pu être générée. Réessayez dans un instant.';
}
