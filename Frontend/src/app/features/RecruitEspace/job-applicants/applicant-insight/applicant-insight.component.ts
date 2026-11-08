import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ApplicantInsight, RecruiterAiService } from '../../../../core/services/recruiter-ai.service';
import { toRecruiterError } from '../../../../core/services/recruiter.service';

/**
 * Résumé IA d'un candidat (espace recruteur) : 3 points forts, 1 point à vérifier,
 * des questions d'entretien tirées du CV. Généré seulement au clic.
 */
@Component({
  selector: 'jr-applicant-insight',
  standalone: true,
  templateUrl: './applicant-insight.component.html',
  styleUrl: './applicant-insight.component.scss',
})
export class ApplicantInsightComponent {
  private api = inject(RecruiterAiService);
  private destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;

  readonly applicationId = input.required<number>();

  readonly insight = signal<ApplicantInsight | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);

  constructor() {
    // Autre candidat ouvert : on repart de zéro
    effect(() => {
      this.applicationId();
      untracked(() => {
        this.request?.unsubscribe();
        this.insight.set(null);
        this.error.set(null);
        this.loading.set(false);
      });
    });
  }

  generate(): void {
    if (this.loading()) return;
    const id = this.applicationId();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.applicantInsight(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (result.applicationId !== this.applicationId()) return;
        this.insight.set(result);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(toRecruiterError(err).message);
      },
    });
  }

  /** Copie les questions pour les avoir sous les yeux pendant l'entretien */
  async copyQuestions(i: ApplicantInsight): Promise<void> {
    const text = i.questions.map((q, n) => `${n + 1}. ${q.question}${q.purpose ? `\n   → ${q.purpose}` : ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch { /* presse-papiers refusé */ }
  }
}
