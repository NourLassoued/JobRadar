import {
  afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, OnDestroy, OnInit,
  output, signal, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatchingService, MatchResult } from '../../../core/services/matching.service';
import {
  AdaptationStatus, AiError, AiQuota, AiService, CandidateCv, CoverLetter, CvAdaptation, InterviewPrep, InterviewQuestion,
  LetterLanguage, LetterLength, LetterTone,
} from '../../../core/services/ai.service';
import { AuthService } from '../../../core/services/auth.service';
import { CandidateService } from '../../../core/services/candidate.service';
import { JobOffer } from '../../../core/services/job.service';
import { sectorIcon, sectorLabel } from '../../../core/models/sector.utils';
import {
  AiBusy, AiTab, CoverageGain, criteriaOf, INTERVIEW_CATEGORIES, levelLabel, levelOf, ModalTab, slug, TextBlock, toBlocks, verdictOf,
} from '../../../core/models/job-offer-modal.models';

const SOURCES: Record<string, { label: string; icon: string; css: string }> = {
  FRANCE_TRAVAIL: { label: 'France Travail', icon: 'ti-building-community', css: 'source--ft' },
  ADZUNA: { label: 'Adzuna', icon: 'ti-world-search', css: 'source--adzuna' },
  JOOBLE: { label: 'Jooble', icon: 'ti-radar', css: 'source--jooble' },
};

const SOURCE_ALIASES: Record<string, string> = {
  FRANCE_TRAVAIL: 'FRANCE_TRAVAIL', FRANCETRAVAIL: 'FRANCE_TRAVAIL', FT: 'FRANCE_TRAVAIL', POLE_EMPLOI: 'FRANCE_TRAVAIL',
  ADZUNA: 'ADZUNA', JOOBLE: 'JOOBLE',
};

@Component({
  selector: 'app-job-offer-modal',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './job-offer-modal.component.html',
  styleUrl: './job-offer-modal.component.scss',
})
export class JobOfferModalComponent implements OnInit, OnDestroy {
  private matchingService = inject(MatchingService);
  private aiService = inject(AiService);
  private authService = inject(AuthService);
  private candidateService = inject(CandidateService);
  private destroyRef = inject(DestroyRef);

  // ── Entrées / sorties ─────────────────────────────────────
  /** Offre cliquée dans la liste */
  offer = input.required<JobOffer>();
  /** Score déjà calculé par la liste : affiché tout de suite, sans appel réseau */
  initialMatch = input<MatchResult | null | undefined>(null);
  /** Onglet ouvert en premier */
  initialTab = input<ModalTab>('score');

  closed = output<void>();
  /** Score recalculé : la liste met sa carte à jour */
  matchChange = output<MatchResult>();

  private dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  // ── Onglets ───────────────────────────────────────────────
  tab = signal<ModalTab>('score');

  // ── Score ─────────────────────────────────────────────────
  /** Score reçu de l'API dans cette fenêtre (prioritaire sur celui de la liste) */
  private fetchedMatch = signal<MatchResult | null>(null);
  match = computed(() => this.fetchedMatch() ?? this.initialMatch() ?? null);
  matchLoading = signal(false);
  matchNotice = signal<{ kind: 'profile' | 'auth' | 'error'; text: string } | null>(null);
  showAllMissing = signal(false);

  level = computed(() => levelOf(this.match()?.score ?? 0));
  label = computed(() => levelLabel(this.match()?.score ?? 0));
  criteria = computed(() => (this.match() ? criteriaOf(this.match()!) : []));
  verdict = computed(() => (this.match() ? verdictOf(this.match()!) : null));
  missingSkills = computed(() => {
    const all = this.match()?.missingSkills ?? [];
    return this.showAllMissing() ? all : all.slice(0, 10);
  });
  hiddenMissing = computed(() => Math.max(0, (this.match()?.missingSkills?.length ?? 0) - this.missingSkills().length));
  /** « Vous couvrez X / Y technologies » si l'offre en cite au moins 3 */
  coverage = computed(() => {
    const r = this.match();
    const total = r?.offerSkills?.length ?? 0;
    return r && total >= 3 ? { covered: total - (r.missingSkills?.length ?? 0), total } : null;
  });

  // ── Assistant IA ──────────────────────────────────────────
  cvs = signal<CandidateCv[]>([]);
  cvsLoaded = signal(false);
  cvsError = signal(false);
  selectedCvId = signal<number | null>(null);
  quota = signal<AiQuota | null>(null);
  aiBusy = signal<AiBusy>(null);
  aiError = signal<{ tab: AiTab; text: string } | null>(null);

  adaptation = signal<CvAdaptation | null>(null);
  letter = signal<CoverLetter | null>(null);

  tone = signal<LetterTone>('FORMAL');
  letterLength = signal<LetterLength>('STANDARD');
  language = signal<LetterLanguage>('FR');

  // ── Préparation à l'entretien ─────────────────────────────
  interview = signal<InterviewPrep | null>(null);
  interviewCount = signal<5 | 8 | 12>(8);
  interviewLanguage = signal<LetterLanguage>('FR');

  /** Questions regroupées par catégorie, dans l'ordre d'un entretien */
  interviewGroups = computed(() => {
    const questions = this.interview()?.questions ?? [];
    return INTERVIEW_CATEGORIES
      .map(c => ({ ...c, questions: questions.filter(q => q.category === c.key) }))
      .filter(g => g.questions.length);
  });

  /** Nombre de questions sur des compétences absentes du profil */
  gapCount = computed(() => (this.interview()?.questions ?? []).filter(q => q.category === 'GAP').length);

  /** Clé du dernier texte copié : affiche « Copié » 2 s */
  copied = signal<string | null>(null);

  adaptationBlocks = computed<TextBlock[]>(() => toBlocks(this.adaptation()?.adaptedContent));
  letterParagraphs = computed(() =>
    (this.letter()?.letter || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean));
  /** Avant → après : affiché seulement si l'API renvoie les deux valeurs */
  coverageGain = computed<CoverageGain | null>(() => {
    const a = this.adaptation();
    if (a?.scoreBefore == null || a?.scoreAfter == null) return null;
    return { before: a.scoreBefore, after: a.scoreAfter, gain: a.scoreAfter - a.scoreBefore };
  });
  quotaEmpty = computed(() => this.quota()?.remaining === 0);
  noCv = computed(() => this.cvsLoaded() && !this.cvsError() && !this.cvs().length);

  // ── Offre ─────────────────────────────────────────────────
  source = computed(() => {
    const raw = (this.offer().source || '').toUpperCase().replace(/[\s-]+/g, '_');
    const key = SOURCE_ALIASES[raw] ?? (raw || 'FRANCE_TRAVAIL');
    return SOURCES[key] ?? { label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '), icon: 'ti-world', css: 'source--other' };
  });
  showFullDescription = signal(false);

  readonly titleId = `offer-modal-title-${Math.random().toString(36).slice(2, 8)}`;
  sectorIcon = sectorIcon;

  /** Élément actif avant l'ouverture : le focus y revient à la fermeture */
  private previousFocus: HTMLElement | null = null;
  private lockedScroll: { el: HTMLElement; overflow: string }[] = [];
  private copyTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      this.previousFocus = document.activeElement as HTMLElement | null;
      this.lockScroll();
      const dialog = this.dialogRef().nativeElement;
      if (!dialog.open) dialog.showModal();
    });
  }

  ngOnInit(): void {
    this.tab.set(this.initialTab());
    const id = this.offer().id;
    if (!this.initialMatch()) this.loadMatch(id);
    this.loadAi(id);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.copyTimer);
    const dialog = this.dialogRef().nativeElement;
    if (dialog.open) dialog.close();
    this.unlockScroll();
    this.previousFocus?.focus?.();
  }

  // ── Fermeture ─────────────────────────────────────────────
  close(): void {
    this.dialogRef().nativeElement.close();
  }

  /** Événement « close » du <dialog> (bouton ×, Échap, clic sur le fond) */
  onDialogClose(): void {
    if (!this.destroyed) this.closed.emit();
  }

  /** Clic sur le fond sombre : le <dialog> lui-même est la cible, pas son contenu */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) this.close();
  }

  /** Le défilement se fait dans .main (layout) ou dans body : on bloque les deux */
  private lockScroll(): void {
    const targets = [document.body, document.querySelector<HTMLElement>('.main')].filter((el): el is HTMLElement => !!el);
    this.lockedScroll = targets.map(el => ({ el, overflow: el.style.overflow }));
    targets.forEach(el => (el.style.overflow = 'hidden'));
  }

  private unlockScroll(): void {
    this.lockedScroll.forEach(({ el, overflow }) => (el.style.overflow = overflow));
    this.lockedScroll = [];
  }

  // ── Onglets ───────────────────────────────────────────────
  selectTab(tab: ModalTab): void {
    this.tab.set(tab);
  }

  /** Flèches gauche / droite entre les onglets (motif ARIA « tabs ») */
  onTabKeydown(event: KeyboardEvent): void {
    const order: ModalTab[] = ['score', 'cv', 'letter', 'interview'];
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = order[(order.indexOf(this.tab()) + step + order.length) % order.length];
    this.tab.set(next);
    (this.dialogRef().nativeElement.querySelector(`#tab-${next}`) as HTMLElement | null)?.focus();
  }

  // ── Score ─────────────────────────────────────────────────
  loadMatch(id = this.offer().id): void {
    this.matchLoading.set(true);
    this.matchNotice.set(null);
    this.matchingService.scoreOffer(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.fetchedMatch.set(r);
          this.matchLoading.set(false);
          this.matchChange.emit(r);
        },
        error: (err: HttpErrorResponse) => {
          this.matchLoading.set(false);
          if (err.status === 404) {
            this.matchNotice.set({ kind: 'profile', text: 'Complétez votre profil (compétences, secteur, expérience) pour voir votre compatibilité.' });
          } else if (err.status === 401 || err.status === 403) {
            this.matchNotice.set({ kind: 'auth', text: 'Connectez-vous pour voir votre compatibilité avec cette offre.' });
          } else {
            this.matchNotice.set({ kind: 'error', text: 'Le score n\'a pas pu être calculé.' });
          }
        },
      });
  }

  // ── Assistant IA : données de départ ──────────────────────
  private loadAi(offerId: number): void {
    this.aiService.listCvs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cvs => {
        this.cvs.set(cvs ?? []);
        this.selectedCvId.set((cvs?.find(c => c.defaultCv) ?? cvs?.[0])?.id ?? null);
        this.cvsLoaded.set(true);
      },
      error: () => {
        this.cvsError.set(true);
        this.cvsLoaded.set(true);
      },
    });

    this.refreshQuota();

    // Dernière adaptation déjà faite pour cette offre : pas besoin de régénérer
    this.aiService.listAdaptations(offerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.adaptation.set((list ?? []).find(a => a.status !== 'REJECTED') ?? null),
      error: () => { /* non bloquant */ },
    });
  }

  private refreshQuota(): void {
    this.aiService.quota().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: q => this.quota.set(q),
      error: () => { /* non bloquant */ },
    });
  }

  private updateRemaining(remaining: number | null | undefined): void {
    const q = this.quota();
    if (q && remaining != null) this.quota.set({ ...q, remaining, used: q.limit - remaining });
  }

  setCv(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.selectedCvId.set(Number.isFinite(value) && value > 0 ? value : null);
  }

  /** Enregistre le CV du profil comme premier CV (POST /api/cvs) */
  importProfileCv(tab: AiTab): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) { this.aiError.set({ tab, text: 'Connectez-vous pour utiliser l\'assistant IA.' }); return; }

    this.aiBusy.set('import');
    this.aiError.set(null);
    this.candidateService.getCandidateById(userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profile => {
        const cvUrl = (profile as { cvUrl?: string | null }).cvUrl;
        if (!cvUrl) {
          this.aiBusy.set(null);
          this.aiError.set({ tab, text: 'Aucun CV dans votre profil. Ajoutez-en un depuis la page Profil.' });
          return;
        }
        const fileName = decodeURIComponent(cvUrl.split('/').pop()?.split('?')[0] || 'cv.pdf');
        this.aiService.createCv({ title: 'CV principal', fileName, fileUrl: cvUrl, makeDefault: true })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: cv => {
              this.cvs.set([cv, ...this.cvs()]);
              this.selectedCvId.set(cv.id);
              this.aiBusy.set(null);
            },
            error: err => this.failAi(err, tab),
          });
      },
      error: err => this.failAi(err, tab),
    });
  }

  // ── 2. CV adapté ──────────────────────────────────────────
  /** Depuis l'onglet Score : bascule sur l'onglet CV puis lance la génération */
  startCv(): void {
    this.tab.set('cv');
    if (!this.adaptation()) this.adaptCv();
  }

  adaptCv(): void {
    if (this.aiBusy() || this.quotaEmpty()) return;
    if (!this.selectedCvId()) {
      this.aiError.set({ tab: 'cv', text: 'Choisissez ou importez d\'abord un CV.' });
      return;
    }
    this.aiBusy.set('cv');
    this.aiError.set(null);
    this.aiService.adaptCv(this.offer().id, this.selectedCvId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: a => {
          this.aiBusy.set(null);
          if (!a?.adaptedContent?.trim()) {
            this.aiError.set({ tab: 'cv', text: 'L\'IA n\'a renvoyé aucun contenu. Réessayez dans un instant.' });
            return;
          }
          this.adaptation.set(a);
          this.updateRemaining(a.remainingQuota);
          this.scrollTo('modal-cv-result');
        },
        error: err => this.failAi(err, 'cv'),
      });
  }

  setAdaptationStatus(status: AdaptationStatus): void {
    const a = this.adaptation();
    if (!a) return;
    this.aiService.setAdaptationStatus(a.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => this.adaptation.set(status === 'REJECTED' ? null : { ...a, status: updated.status }),
      error: err => this.failAi(err, 'cv'),
    });
  }

  // ── 3. Lettre de motivation ───────────────────────────────
  startLetter(): void {
    this.tab.set('letter');
  }

  generateLetter(): void {
    if (this.aiBusy() || this.quotaEmpty()) return;
    this.aiBusy.set('letter');
    this.aiError.set(null);
    this.aiService.coverLetter({
      jobOfferId: this.offer().id,
      cvId: this.selectedCvId(),
      tone: this.tone(),
      length: this.letterLength(),
      language: this.language(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: l => {
        this.aiBusy.set(null);
        if (!l?.letter?.trim()) {
          this.aiError.set({ tab: 'letter', text: 'L\'IA n\'a renvoyé aucune lettre. Réessayez dans un instant.' });
          return;
        }
        this.letter.set(l);
        this.updateRemaining(l.remainingQuota);
        this.scrollTo('modal-letter-result');
      },
      error: err => this.failAi(err, 'letter'),
    });
  }

  // ── 4. Préparation à l'entretien ──────────────────────────
  startInterview(): void {
    this.tab.set('interview');
  }

  generateInterview(): void {
    if (this.aiBusy() || this.quotaEmpty()) return;
    this.aiBusy.set('interview');
    this.aiError.set(null);
    this.aiService.interviewPrep({
      jobOfferId: this.offer().id,
      cvId: this.selectedCvId(),
      language: this.interviewLanguage(),
      questionCount: this.interviewCount(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: prep => {
        this.aiBusy.set(null);
        if (!prep?.questions?.length) {
          this.aiError.set({ tab: 'interview', text: 'L\'IA n\'a renvoyé aucune question. Réessayez dans un instant.' });
          return;
        }
        this.interview.set(prep);
        this.updateRemaining(prep.remainingQuota);
        this.scrollTo('modal-interview-result');
      },
      error: err => this.failAi(err, 'interview'),
    });
  }

  categoryLabel(key: string): string {
    return INTERVIEW_CATEGORIES.find(c => c.key === key)?.label ?? key;
  }

  /** Toute la préparation en texte : copie, .txt et PDF */
  interviewText(p: InterviewPrep): string {
    const lines: string[] = [`Préparation à l'entretien — ${p.offerTitle}${p.offerCompany ? ' · ' + p.offerCompany : ''}`, ''];
    p.questions.forEach((q, i) => {
      lines.push(`${i + 1}. [${this.categoryLabel(q.category)}] ${q.question}`);
      if (q.why) lines.push(`   Pourquoi : ${q.why}`);
      if (q.suggestedAnswer) lines.push(`   Piste de réponse : ${q.suggestedAnswer}`);
      if (q.keyPoints.length) lines.push(`   Points clés : ${q.keyPoints.join(' · ')}`);
      lines.push('');
    });
    if (p.questionsToAsk.length) lines.push('Questions à poser au recruteur :', ...p.questionsToAsk.map(x => `- ${x}`), '');
    if (p.tips.length) lines.push('Conseils :', ...p.tips.map(x => `- ${x}`));
    return lines.join('\n');
  }

  trackQuestion(q: InterviewQuestion): string {
    return q.question;
  }

  letterText(l: CoverLetter): string {
    return l.subject ? `Objet : ${l.subject}\n\n${l.letter}` : l.letter;
  }

  // ── Copier / télécharger ──────────────────────────────────
  copy(text: string, key: string): void {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(key);
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied.set(null), 2000);
    });
  }

  /** Fichier texte : .md pour le CV (titres conservés), .txt pour la lettre */
  download(text: string, kind: 'cv' | 'lettre' | 'entretien'): void {
    const prefix = kind === 'cv' ? 'cv-adapte' : kind === 'lettre' ? 'lettre-motivation' : 'preparation-entretien';
    const name = `${prefix}-${slug(this.offer().company)}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}${kind === 'cv' ? '.md' : '.txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * PDF : ouvre une page imprimable mise en forme ; « Enregistrer au format PDF »
   * dans la fenêtre d'impression du navigateur. Le contenu est inséré en textContent (pas de HTML injecté).
   */
  printPdf(kind: 'cv' | 'lettre' | 'entretien'): void {
    const win = window.open('', '_blank', 'width=820,height=960');
    if (!win) {
      const tab: AiTab = kind === 'cv' ? 'cv' : kind === 'lettre' ? 'letter' : 'interview';
      this.aiError.set({ tab, text: 'Autorisez les fenêtres pop-up pour exporter en PDF.' });
      return;
    }
    const doc = win.document;
    doc.title = kind === 'cv' ? `CV adapté — ${this.offer().title}`
      : kind === 'lettre' ? `Lettre de motivation — ${this.offer().company || this.offer().title}`
        : `Préparation à l'entretien — ${this.offer().title}`;
    const style = doc.createElement('style');
    style.textContent = `
      @page { margin: 18mm; }
      body { font: 11pt/1.55 'Segoe UI', system-ui, sans-serif; color: #17202a; max-width: 720px; margin: 24px auto; padding: 0 16px; }
      h2 { font-size: 12.5pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #c5ccd2; color: #155e63; }
      p { margin: 0 0 8px; } ul { margin: 0 0 8px; padding-left: 18px; } li { margin: 2px 0; }
      .subject { font-weight: 700; margin-bottom: 18px; }
      h3 { font-size: 11.5pt; margin: 16px 0 4px; } .why { color: #66727e; font-style: italic; }`;
    doc.head.appendChild(style);

    const body = doc.body;
    if (kind === 'cv') {
      let list: HTMLUListElement | null = null;
      for (const b of this.adaptationBlocks()) {
        if (b.kind === 'li') {
          list ??= body.appendChild(doc.createElement('ul'));
          list.appendChild(doc.createElement('li')).textContent = b.text;
        } else {
          list = null;
          body.appendChild(doc.createElement(b.kind === 'h' ? 'h2' : 'p')).textContent = b.text;
        }
      }
    } else if (kind === 'entretien') {
      const p = this.interview();
      if (p) {
        body.appendChild(doc.createElement('h2')).textContent = `Préparation à l'entretien — ${p.offerTitle}`;
        p.questions.forEach((q, i) => {
          body.appendChild(doc.createElement('h3')).textContent = `${i + 1}. ${q.question}`;
          if (q.why) {
            const why = body.appendChild(doc.createElement('p'));
            why.className = 'why';
            why.textContent = q.why;
          }
          if (q.suggestedAnswer) body.appendChild(doc.createElement('p')).textContent = q.suggestedAnswer;
          if (q.keyPoints.length) {
            const ul = body.appendChild(doc.createElement('ul'));
            q.keyPoints.forEach(k => (ul.appendChild(doc.createElement('li')).textContent = k));
          }
        });
        if (p.questionsToAsk.length) {
          body.appendChild(doc.createElement('h2')).textContent = 'Questions à poser au recruteur';
          const ul = body.appendChild(doc.createElement('ul'));
          p.questionsToAsk.forEach(k => (ul.appendChild(doc.createElement('li')).textContent = k));
        }
      }
    } else {
      const l = this.letter();
      if (l?.subject) {
        const subject = body.appendChild(doc.createElement('p'));
        subject.className = 'subject';
        subject.textContent = `Objet : ${l.subject}`;
      }
      this.letterParagraphs().forEach(p => (body.appendChild(doc.createElement('p')).textContent = p));
    }
    win.focus();
    setTimeout(() => win.print(), 150);
  }

  // ── Erreurs ───────────────────────────────────────────────
  /** Traduit la réponse d'erreur du backend { status, code, message } */
  private failAi(err: HttpErrorResponse, tab: AiTab): void {
    this.aiBusy.set(null);
    const body = err.error as AiError | null;
    let text: string;
    if (err.status === 0) text = 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.';
    else if (err.status === 401 || err.status === 403) text = 'Connectez-vous pour utiliser l\'assistant IA.';
    else if (body?.code === 'CV_TEXT_MISSING') text = body.message || 'Le texte de ce CV n\'a pas pu être lu. Utilisez un PDF contenant du texte (pas un scan).';
    else if (body?.code === 'QUOTA_EXCEEDED') text = body.message || 'Vous avez atteint votre limite de générations pour aujourd\'hui.';
    else if (body?.code === 'RATE_LIMITED') text = body.message || 'Trop de demandes en même temps. Patientez une minute puis réessayez.';
    else text = body?.message || `Erreur ${err.status}. Réessayez dans un instant.`;
    this.aiError.set({ tab, text });
    if (body?.code === 'QUOTA_EXCEEDED') this.refreshQuota();
  }

  private scrollTo(id: string): void {
    setTimeout(() => this.dialogRef().nativeElement.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // ── Affichage ─────────────────────────────────────────────
  sectorText(code?: string | null): string {
    return sectorLabel(code).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').trim();
  }

  formatSalary(min?: number | null, max?: number | null): string {
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
    if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)} €`;
    if (min && max) return `${fmt(max)} €`;
    if (max) return `Jusqu'à ${fmt(max)} €`;
    if (min) return `À partir de ${fmt(min)} €`;
    return '';
  }

  relativeDate(date?: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return 'Publiée aujourd\'hui';
    if (days === 1) return 'Publiée hier';
    if (days < 30) return `Publiée il y a ${days} jours`;
    return `Publiée le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  /** Description longue : repliée au-delà de 600 caractères */
  description = computed(() => {
    const text = (this.offer().description || '').trim();
    if (this.showFullDescription() || text.length <= 600) return text;
    return text.slice(0, 600).replace(/\s+\S*$/, '') + '…';
  });
  descriptionTruncated = computed(() => (this.offer().description || '').trim().length > 600);
}