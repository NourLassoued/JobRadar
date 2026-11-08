import { Component, DestroyRef, NgZone, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  AiService, AnswerFeedback, InterviewQuestion, LetterLanguage, StarStep,
} from '../../../../core/services/ai.service';
import { INTERVIEW_CATEGORIES } from '../../../../core/models/job-offer-modal.models';

type Phase = 'intro' | 'answer' | 'feedback' | 'summary';

/** Résultat d'une question pendant la simulation */
interface Attempt {
  question: InterviewQuestion;
  answer: string;
  feedback: AnswerFeedback | null;
  skipped: boolean;
}

// ── Reconnaissance vocale du navigateur (Chrome, Edge) : types minimaux ──
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

const STAR_KEYS = [
  { key: 'situation', label: 'Situation', hint: 'Le contexte' },
  { key: 'task', label: 'Tâche', hint: 'L\'objectif' },
  { key: 'action', label: 'Action', hint: 'Ce que vous avez fait' },
  { key: 'result', label: 'Résultat', hint: 'L\'impact' },
] as const;

/**
 * Simulation d'entretien : les questions préparées sont posées une par une, sans la piste de réponse.
 * Le candidat répond à l'écrit ou au micro ; l'IA note la réponse sur 10 (méthode STAR),
 * donne des conseils et une version mieux structurée de SA réponse. Bilan à la fin.
 */
@Component({
  selector: 'app-interview-practice',
  standalone: true,
  templateUrl: './interview-practice.component.html',
  styleUrl: './interview-practice.component.scss',
})
export class InterviewPracticeComponent {
  private ai = inject(AiService);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Texte tapé ou dicté avant le début de la dictée en cours */
  private dictationBase = '';

  readonly jobOfferId = input.required<number>();
  readonly questions = input.required<InterviewQuestion[]>();
  readonly language = input<LetterLanguage>('FR');

  readonly phase = signal<Phase>('intro');
  readonly index = signal(0);
  readonly answer = signal('');
  readonly attempts = signal<Attempt[]>([]);
  readonly feedback = signal<AnswerFeedback | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showImproved = signal(false);
  readonly listening = signal(false);
  readonly spoken = signal(false);
  readonly seconds = signal(0);
  readonly remaining = signal<number | null>(null);

  readonly speechSupported = typeof window !== 'undefined'
    && !!((window as unknown as Record<string, unknown>)['SpeechRecognition']
      || (window as unknown as Record<string, unknown>)['webkitSpeechRecognition']);

  readonly starKeys = STAR_KEYS;
  readonly current = computed(() => this.questions()[this.index()] ?? null);
  readonly total = computed(() => this.questions().length);
  readonly progress = computed(() => Math.round((this.index() / Math.max(1, this.total())) * 100));
  readonly answerLength = computed(() => this.answer().trim().length);
  readonly canSubmit = computed(() => this.answerLength() >= 15 && !this.loading());

  readonly evaluated = computed(() => this.attempts().filter(a => a.feedback));
  readonly average = computed(() => {
    const list = this.evaluated();
    if (!list.length) return null;
    return Math.round((list.reduce((s, a) => s + (a.feedback?.score ?? 0), 0) / list.length) * 10) / 10;
  });
  /** Étape STAR la plus souvent oubliée sur la simulation */
  readonly weakestStar = computed(() => {
    const list = this.evaluated();
    if (!list.length) return null;
    const missing = STAR_KEYS.map(k => ({
      ...k,
      count: list.filter(a => !a.feedback!.star[k.key].present).length,
    })).sort((a, b) => b.count - a.count)[0];
    return missing.count > 0 ? missing : null;
  });

  constructor() {
    // Nouvelles questions générées : la simulation repart de zéro
    effect(() => {
      this.questions();
      untracked(() => this.restart());
    });
    this.destroyRef.onDestroy(() => {
      this.stopListening();
      this.stopTimer();
      this.request?.unsubscribe();
    });
  }

  // ── Déroulé ───────────────────────────────────────────────

  start(fromIndex = 0): void {
    this.attempts.set([]);
    this.goTo(fromIndex);
  }

  restart(): void {
    this.stopListening();
    this.stopTimer();
    this.request?.unsubscribe();
    this.attempts.set([]);
    this.index.set(0);
    this.resetAnswer();
    this.phase.set('intro');
  }

  /** Depuis le bilan : retravailler une question (les autres résultats sont gardés) */
  goToQuestion(i: number): void {
    this.goTo(i);
  }

  /** Recommencer la même question (nouvelle tentative) */
  retry(): void {
    this.goTo(this.index());
  }

  next(): void {
    if (this.index() + 1 >= this.total()) {
      this.finish();
      return;
    }
    this.goTo(this.index() + 1);
  }

  skip(): void {
    const q = this.current();
    if (q) this.record({ question: q, answer: '', feedback: null, skipped: true });
    this.next();
  }

  finish(): void {
    this.stopListening();
    this.stopTimer();
    this.phase.set('summary');
  }

  submit(): void {
    const q = this.current();
    if (!q || !this.canSubmit()) return;
    this.stopListening();
    this.stopTimer();
    this.loading.set(true);
    this.error.set(null);
    const answer = this.answer().trim();

    this.request = this.ai.evaluateAnswer({
      jobOfferId: this.jobOfferId(),
      category: q.category,
      question: q.question,
      answer,
      language: this.language(),
      spoken: this.spoken(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: feedback => {
        this.loading.set(false);
        this.feedback.set(feedback);
        this.remaining.set(feedback.remainingQuota);
        this.record({ question: q, answer, feedback, skipped: false });
        this.showImproved.set(false);
        this.phase.set('feedback');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(errorText(err));
      },
    });
  }

  private goTo(i: number): void {
    this.index.set(i);
    this.resetAnswer();
    this.phase.set('answer');
    this.startTimer();
  }

  private resetAnswer(): void {
    this.answer.set('');
    this.feedback.set(null);
    this.error.set(null);
    this.spoken.set(false);
    this.showImproved.set(false);
    this.seconds.set(0);
  }

  /** Une seule tentative gardée par question : la dernière */
  private record(attempt: Attempt): void {
    this.attempts.update(list => [...list.filter(a => a.question !== attempt.question), attempt]);
  }

  onInput(event: Event): void {
    this.answer.set((event.target as HTMLTextAreaElement).value);
  }

  // ── Micro (dictée) ────────────────────────────────────────

  toggleListening(): void {
    if (this.listening()) this.stopListening();
    else this.startListening();
  }

  private startListening(): void {
    const w = window as unknown as Record<string, SpeechCtor | undefined>;
    const Ctor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = this.language() === 'EN' ? 'en-US' : 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    this.dictationBase = this.answer().trim();

    let finalText = '';
    rec.onresult = (e: SpeechEvent) => this.zone.run(() => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      const spokenText = (finalText + interim).trim();
      this.answer.set([this.dictationBase, spokenText].filter(Boolean).join(' '));
      this.spoken.set(true);
    });
    rec.onerror = e => this.zone.run(() => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.error.set('Micro refusé : autorisez-le dans le navigateur, ou répondez à l\'écrit.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.error.set('La dictée s\'est arrêtée. Réessayez ou répondez à l\'écrit.');
      }
      this.listening.set(false);
    });
    rec.onend = () => this.zone.run(() => this.listening.set(false));

    try {
      rec.start();
      this.recognition = rec;
      this.listening.set(true);
      this.error.set(null);
    } catch {
      this.error.set('Impossible de démarrer le micro. Répondez à l\'écrit.');
    }
  }

  private stopListening(): void {
    if (this.recognition) {
      this.recognition.onend = null;
      try { this.recognition.stop(); } catch { /* déjà arrêté */ }
    }
    this.recognition = null;
    this.listening.set(false);
  }

  // ── Chronomètre (indicatif) ───────────────────────────────

  private startTimer(): void {
    this.stopTimer();
    this.seconds.set(0);
    this.timer = setInterval(() => this.seconds.update(s => s + 1), 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ── Affichage ─────────────────────────────────────────────

  clock(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  categoryLabel(q: InterviewQuestion): string {
    return INTERVIEW_CATEGORIES.find(c => c.key === q.category)?.label ?? 'Question';
  }

  categoryIcon(q: InterviewQuestion): string {
    return INTERVIEW_CATEGORIES.find(c => c.key === q.category)?.icon ?? 'ti-message';
  }

  star(f: AnswerFeedback, key: typeof STAR_KEYS[number]['key']): StarStep {
    return f.star[key];
  }

  tone(score: number): 'high' | 'mid' | 'low' {
    return score >= 8 ? 'high' : score >= 5 ? 'mid' : 'low';
  }

  attemptOf(q: InterviewQuestion): Attempt | null {
    return this.attempts().find(a => a.question === q) ?? null;
  }
}

function errorText(err: HttpErrorResponse): string {
  const message = typeof err.error?.message === 'string' ? err.error.message : null;
  if (err.status === 0) return 'Serveur injoignable. Vérifiez votre connexion.';
  if (err.status === 401) return 'Session expirée : reconnectez-vous.';
  if (message) return message;
  if (err.status === 429) return 'Limite de générations atteinte pour aujourd\'hui.';
  return 'L\'évaluation a échoué. Réessayez dans un instant.';
}
