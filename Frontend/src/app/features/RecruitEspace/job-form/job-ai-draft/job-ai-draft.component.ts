import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { JobDraft, JobDraftRequest, RecruiterAiService } from '../../../../core/services/recruiter-ai.service';
import { toRecruiterError } from '../../../../core/services/recruiter.service';

/** Ce que le formulaire connaît déjà (envoyé à l'IA pour qu'elle reste cohérente) */
export type JobDraftContext = Omit<JobDraftRequest, 'brief'>;

const EXAMPLE = 'Ex. : On cherche un développeur Java/Angular pour notre équipe de 6 personnes à Tunis. '
  + '2 ans d\'expérience, il travaillera sur notre plateforme de réservation. Télétravail 2 jours par semaine, mutuelle.';

/**
 * Rédaction d'offre assistée : le recruteur écrit quelques lignes, l'IA propose une offre complète.
 * Le brouillon est affiché pour relecture ; « Remplir le formulaire » le copie dans les champs.
 * Rien n'est publié tant que le recruteur n'enregistre pas lui-même.
 */
@Component({
  selector: 'jr-job-ai-draft',
  standalone: true,
  templateUrl: './job-ai-draft.component.html',
  styleUrl: './job-ai-draft.component.scss',
})
export class JobAiDraftComponent {
  private api = inject(RecruiterAiService);
  private destroyRef = inject(DestroyRef);

  readonly context = input<JobDraftContext>({});
  /** Le formulaire contient déjà un texte : on prévient qu'il sera remplacé */
  readonly hasContent = input(false);
  readonly apply = output<JobDraft>();

  readonly example = EXAMPLE;
  readonly open = signal(false);
  readonly brief = signal('');
  readonly draft = signal<JobDraft | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly applied = signal(false);

  onBrief(event: Event): void {
    this.brief.set((event.target as HTMLTextAreaElement).value);
  }

  generate(): void {
    const brief = this.brief().trim();
    if (brief.length < 20) {
      this.error.set('Décrivez le poste en quelques lignes (20 caractères minimum).');
      return;
    }
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.applied.set(false);
    this.api.jobDraft({ ...this.context(), brief }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: draft => {
        this.draft.set(draft);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(toRecruiterError(err).message);
      },
    });
  }

  useDraft(): void {
    const d = this.draft();
    if (!d) return;
    this.apply.emit(d);
    this.applied.set(true);
  }

  excerpt(text: string): string {
    return text.length > 420 ? text.slice(0, 420).trimEnd() + '…' : text;
  }
}
