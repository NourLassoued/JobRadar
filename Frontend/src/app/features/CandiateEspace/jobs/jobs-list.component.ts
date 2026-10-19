import {
  afterNextRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, OnInit,
  PLATFORM_ID, signal, untracked, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JobOffer, JobService } from '../../../core/services/job.service';
import { AdzunaError, AdzunaService } from '../../../core/services/adzuna.service';
import { JoobleError, JoobleService } from '../../../core/services/jooble.service';
import { FranceTravailService } from '../../../core/services/france-travail.service';
import { MatchResult, MatchingService } from '../../../core/services/matching.service';
import { Observable } from 'rxjs';
import { SECTOR_LABELS } from '../../../core/models/candidate';
import { sectorCode, sectorIcon, sectorLabel } from '../../../core/models/sector.utils';
import { RecommendationService } from '../../../core/services/recommendation-service.service';
import { JobOfferModalComponent } from '../job-offer-modal/job-offer-modal.component';
import { ModalTab } from '../../../core/models/job-offer-modal.models';


type FilterType = 'all' | 'active' | 'remote';
type SortType = 'recent' | 'score' | 'salary' | 'title';
/** Niveau d'un score, pour la couleur */
type ScoreLevel = 'high' | 'mid' | 'low';
/** Filtre de score minimum : 0 = toutes, 40 = compatibles, 70 = très compatibles */
type MinScore = 0 | 40 | 70;
/** Raison pour laquelle les scores ne sont pas disponibles */
type ScoreNoticeKind = 'profile' | 'auth' | 'error';

/** Score à partir duquel une offre est mise en avant (« Top match ») */
const TOP_MATCH = 80;
type DateFilter = 'all' | '24h' | '3d' | '7d' | '30d';
type ViewMode = 'grid' | 'list';

/** Morceau de texte, surligné ou non (pour la recherche) */
interface Segment { text: string; match: boolean }

const VIEW_KEY = 'jr.jobs.view';

/** Nombre de cartes affichées à chaque fois */
const PAGE_SIZE = 24;

const DATE_OPTIONS: { value: DateFilter; label: string; days: number }[] = [
  { value: 'all', label: 'Toutes les dates', days: Infinity },
  { value: '24h', label: 'Dernières 24 h', days: 1 },
  { value: '3d', label: '3 derniers jours', days: 3 },
  { value: '7d', label: '7 derniers jours', days: 7 },
  { value: '30d', label: '30 derniers jours', days: 30 },
];

const TYPE_LABELS: Record<FilterType, string> = { all: 'Toutes', active: 'Actives', remote: 'Télétravail' };

// ── Sources d'offres ─────────────────────────────────────────
/** Code de source → libellé, icône Tabler et classe CSS */
const SOURCES: Record<string, { label: string; icon: string; css: string }> = {
  FRANCE_TRAVAIL: { label: 'France Travail', icon: 'ti-building-community', css: 'source--ft' },
  ADZUNA: { label: 'Adzuna', icon: 'ti-world-search', css: 'source--adzuna' },
  JOOBLE: { label: 'Jooble', icon: 'ti-radar', css: 'source--jooble' },
};

/** Sources interrogeables à la demande depuis la liste */
type ExternalSource = 'FRANCE_TRAVAIL' | 'ADZUNA' | 'JOOBLE';

/** Variantes possibles en base → code unique (« France Travail », « FT », « pole_emploi »…) */
const SOURCE_ALIASES: Record<string, string> = {
  FRANCE_TRAVAIL: 'FRANCE_TRAVAIL',
  FRANCETRAVAIL: 'FRANCE_TRAVAIL',
  FT: 'FRANCE_TRAVAIL',
  POLE_EMPLOI: 'FRANCE_TRAVAIL',
  ADZUNA: 'ADZUNA',
  JOOBLE: 'JOOBLE',
};

/** Les offres importées avant l'ajout du champ « source » viennent de France Travail */
const DEFAULT_SOURCE = 'FRANCE_TRAVAIL';

/** Supprime accents et majuscules : « Développeur » = « developpeur » */
const normalize = (s: string | null | undefined): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface Chip { key: 'q' | 'sector' | 'type' | 'date' | 'source' | 'score'; label: string }

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [RouterLink, JobOfferModalComponent],
  templateUrl: './jobs-list.component.html',
  styleUrl: './jobs-list.component.scss',
})
export class JobsListComponent implements OnInit {
  private jobService = inject(JobService);
  private adzunaService = inject(AdzunaService);
  private joobleService = inject(JoobleService);
  private franceTravailService = inject(FranceTravailService);
  private matchingService = inject(MatchingService);
  private recommendationService = inject(RecommendationService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('topSentinel') topSentinel?: ElementRef<HTMLElement>;

  // ── État ───────────────────────────────────────────────────
  jobs = signal<JobOffer[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  searchQuery = signal('');
  filterType = signal<FilterType>('all');
  sectorFilter = signal('');
  dateFilter = signal<DateFilter>('all');
  /** Tri par défaut : meilleur score d'abord (offres recommandées) */
  sortBy = signal<SortType>('score');
  /** '' = toutes les sources */
  sourceFilter = signal('');

  visibleCount = signal(PAGE_SIZE);

  /** Grille ou liste compacte (mémorisé dans le navigateur) */
  viewMode = signal<ViewMode>('grid');
  /** Affiche le bouton « Haut de page » quand le haut de la liste n'est plus visible */
  showBackToTop = signal(false);

  /** Source externe en cours d'interrogation (une à la fois) et message de résultat */
  externalLoading = signal<ExternalSource | null>(null);
  externalMessage = signal<{ source: ExternalSource; type: 'success' | 'error'; text: string } | null>(null);

  // ── Scores de matching ────────────────────────────────────
  /** Score par id d'offre (rempli au fur et à mesure de l'affichage) */
  scores = signal<Map<number, MatchResult>>(new Map());
  /** Offres dont le score est en cours de calcul */
  scoringIds = signal<Set<number>>(new Set());
  /** Message si les scores ne peuvent pas être calculés (profil incomplet, non connecté…) */
  scoreNotice = signal<{ kind: ScoreNoticeKind; text: string } | null>(null);
  /** Score minimum demandé (filtre « Compatibilité ») */
  minScore = signal<MinScore>(0);
  // ── Fenêtre modale d'une offre ────────────────────────────
  /** Offre ouverte dans la fenêtre (null = fermée) */
  selectedOffer = signal<JobOffer | null>(null);
  /** Onglet affiché à l'ouverture : score, CV adapté ou lettre */
  modalTab = signal<ModalTab>('score');
  /** Ids déjà demandés : évite de redemander le même score */
  private requestedScoreIds = new Set<number>();

  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly dateOptions = DATE_OPTIONS;

  // ── Compteurs (sur toutes les offres chargées) ─────────────
  totalCount = computed(() => this.jobs().length);
  activeJobsCount = computed(() => this.jobs().filter(j => j.isActive).length);
  remoteJobsCount = computed(() => this.jobs().filter(j => j.remote).length);

  /** Sources présentes dans les offres chargées, avec leur nombre (pour le filtre et l'en-tête) */
  sourceOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const job of this.jobs()) {
      const key = this.sourceKey(job);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count, label: this.sourceLabel(value), icon: this.sourceIcon(value) }))
      .sort((a, b) => b.count - a.count);
  });

  /** Les 14 secteurs de l'enum Java SectorType, triés par ordre alphabétique */
  readonly sectorOptions = Object.keys(SECTOR_LABELS)
    .filter(code => code !== 'OTHER')
    .map(code => ({ value: code, label: sectorLabel(code), icon: sectorIcon(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  /** Icône affichée dans la liste déroulante (secteur choisi ou icône générique) */
  selectedSectorIcon = computed(() => (this.sectorFilter() ? sectorIcon(this.sectorFilter()) : null));

  /** Le chargement en cours concerne-t-il un changement de secteur ? */
  sectorLoading = signal(false);

  // ── Filtrage ───────────────────────────────────────────────
  /** Offres filtrées par tout sauf la date (sert aussi aux compteurs de dates) */
  private filteredExceptDate = computed(() => {
    const q = normalize(this.searchQuery().trim());
    const type = this.filterType();
    const source = this.sourceFilter();

    // Le secteur est déjà filtré par le backend (getOffersBySector)
    return this.jobs().filter(job => {
      if (source && this.sourceKey(job) !== source) return false;
      if (type === 'active' && !job.isActive) return false;
      if (type === 'remote' && !job.remote) return false;
      if (!q) return true;
      return normalize(
        [job.title, job.company, job.location, job.description, sectorLabel(job.sector)].join(' ')
      ).includes(q);
    });
  });

  /** Nombre d'offres par période, affiché dans la liste « Publiée » */
  dateCounts = computed(() => {
    const list = this.filteredExceptDate();
    const counts: Record<string, number> = {};
    for (const opt of DATE_OPTIONS) counts[opt.value] = list.filter(j => this.withinDays(j.createdAt, opt.days)).length;
    return counts;
  });

  /** Offres filtrées par tout sauf le score (sert au résumé de compatibilité) */
  private filteredExceptScore = computed(() => {
    const days = DATE_OPTIONS.find(o => o.value === this.dateFilter())?.days ?? Infinity;
    return this.filteredExceptDate().filter(j => this.withinDays(j.createdAt, days));
  });

  filteredJobs = computed(() => {
    const min = this.minScore();
    const map = this.scores();
    // Filtre de score : les offres pas encore notées sont masquées tant que leur score n'est pas connu
    const sorted = min
      ? this.filteredExceptScore().filter(j => (map.get(j.id)?.score ?? -1) >= min)
      : [...this.filteredExceptScore()];

    switch (this.sortBy()) {
      case 'salary':
        sorted.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
        break;
      case 'score': {
        // Offres sans score encore calculé à la fin
        const map = this.scores();
        sorted.sort((a, b) => (map.get(b.id)?.score ?? -1) - (map.get(a.id)?.score ?? -1));
        break;
      }
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  });

  resultCount = computed(() => this.filteredJobs().length);

  /** Seulement les cartes à afficher (chargement progressif) */
  visibleJobs = computed(() => this.filteredJobs().slice(0, this.visibleCount()));
  remaining = computed(() => Math.max(0, this.resultCount() - this.visibleCount()));
  progress = computed(() => this.resultCount() ? Math.min(100, (this.visibleCount() / this.resultCount()) * 100) : 0);

  /** Offres visibles regroupées par période (uniquement en tri « Plus récentes ») */
  groupedJobs = computed(() => {
    const jobs = this.visibleJobs();
    if (this.sortBy() !== 'recent') return [{ label: '', jobs }];

    const groups: { label: string; jobs: JobOffer[] }[] = [];
    for (const job of jobs) {
      const label = this.periodLabel(job.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.jobs.push(job);
      else groups.push({ label, jobs: [job] });
    }
    return groups;
  });

  /** Résumé : moyenne, répartition et meilleure offre parmi les offres notées */
  scoreStats = computed(() => {
    const map = this.scores();
    const list = this.filteredExceptScore();
    let high = 0, mid = 0, low = 0, sum = 0;
    let best: { job: JobOffer; result: MatchResult } | null = null;

    for (const job of list) {
      const r = map.get(job.id);
      if (!r) continue;
      sum += r.score;
      const level = this.scoreLevel(r.score);
      if (level === 'high') high++; else if (level === 'mid') mid++; else low++;
      if (!best || r.score > best.result.score) best = { job, result: r };
    }

    const scored = high + mid + low;
    const pct = (n: number) => (scored ? Math.round((n / scored) * 100) : 0);
    return {
      scored,
      total: list.length,
      average: scored ? Math.round(sum / scored) : 0,
      high, mid, low,
      highPct: pct(high), midPct: pct(mid), lowPct: pct(low),
      best,
    };
  });

  /** Vrai tant qu'au moins un lot de scores est en cours de calcul */
  scoringInProgress = computed(() => this.scoringIds().size > 0);

  /** Pastilles des filtres actifs */
  chips = computed<Chip[]>(() => {
    const chips: Chip[] = [];
    const q = this.searchQuery().trim();
    if (q) chips.push({ key: 'q', label: `« ${q} »` });
    if (this.sectorFilter()) chips.push({ key: 'sector', label: sectorLabel(this.sectorFilter()) });
    if (this.sourceFilter()) chips.push({ key: 'source', label: `Source : ${this.sourceLabel(this.sourceFilter())}` });
    if (this.filterType() !== 'all') chips.push({ key: 'type', label: TYPE_LABELS[this.filterType()] });
    if (this.dateFilter() !== 'all') chips.push({ key: 'date', label: DATE_OPTIONS.find(o => o.value === this.dateFilter())!.label });
    if (this.minScore()) chips.push({ key: 'score', label: `Score ≥ ${this.minScore()}` });
    return chips;
  });

  hasActiveFilters = computed(() => this.chips().length > 0 || this.sortBy() !== 'score');

  /** Suggestions quand aucune offre ne correspond */
  suggestions = computed(() => {
    const s: { label: string; action: () => void }[] = [];
    const d = this.dateFilter();
    if (d === '24h' || d === '3d') s.push({ label: 'Élargir à 7 jours', action: () => this.dateFilter.set('7d') });
    else if (d !== 'all') s.push({ label: 'Toutes les dates', action: () => this.dateFilter.set('all') });
    if (this.sectorFilter()) s.push({ label: 'Retirer le secteur', action: () => this.sectorFilter.set('') });
    if (this.sourceFilter()) s.push({ label: 'Toutes les sources', action: () => this.sourceFilter.set('') });
    if (this.filterType() !== 'all') s.push({ label: `Retirer « ${TYPE_LABELS[this.filterType()]} »`, action: () => this.filterType.set('all') });
    if (this.searchQuery().trim()) s.push({ label: 'Effacer la recherche', action: () => this.searchQuery.set('') });
    if (this.minScore()) s.push({ label: 'Retirer le filtre de score', action: () => this.minScore.set(0) });
    return s;
  });

  constructor() {
    // Navigateur uniquement : préférence de vue + bouton « Haut de page »
    afterNextRender(() => {
      try {
        const saved = localStorage.getItem(VIEW_KEY);
        if (saved === 'grid' || saved === 'list') this.viewMode.set(saved);
      } catch { /* stockage indisponible : on garde la grille */ }

      const el = this.topSentinel?.nativeElement;
      if (!el || !('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver(([entry]) => this.showBackToTop.set(!entry.isIntersecting));
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // Revenir aux 24 premières offres quand un filtre change
    effect(() => {
      this.filteredExceptDate(); this.dateFilter(); this.sortBy(); this.minScore();
      untracked(() => this.visibleCount.set(PAGE_SIZE));
    }, { allowSignalWrites: true });

    // Changement de secteur (liste, pastille, « Tout effacer »…) → rechargement depuis le backend.
    // Seul endroit qui recharge : évite les doubles requêtes.
    effect(() => {
      const sector = this.sectorFilter();
      untracked(() => {
        if (this.loading()) return; // le chargement initial s'en occupe
        this.sectorLoading.set(true);
        this.errorMessage.set(null);
        this.fetchOffers(sector)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(offers => this.applyOffers(offers));
      });
    }, { allowSignalWrites: true });

    // Calcule le score des offres affichées (par lots de 100, une seule fois par offre)
    effect(() => {
      // Tri ou filtre par score : on note toutes les offres filtrées ; sinon seulement celles visibles
      const all = this.sortBy() === 'score' || this.minScore() > 0;
      const jobs = all ? this.filteredExceptScore() : this.visibleJobs();
      untracked(() => this.loadScores(jobs));
    });

    // Garder les filtres dans l'URL (rechargement, bouton retour, partage)
    effect(() => {
      const params = {
        q: this.searchQuery().trim() || null,
        secteur: this.sectorFilter() || null,
        source: this.sourceFilter() || null,
        type: this.filterType() !== 'all' ? this.filterType() : null,
        date: this.dateFilter() !== 'all' ? this.dateFilter() : null,
        tri: this.sortBy() !== 'score' ? this.sortBy() : null,
        score: this.minScore() || null,
      };
      if (!this.isBrowser) return;
      untracked(() => this.router.navigate([], {
        relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true,
      }));
    });
  }

  // ── Chargement ─────────────────────────────────────────────
  ngOnInit(): void {
    this.readFiltersFromUrl();
    this.loadJobsOnInit();
  }

  private readFiltersFromUrl(): void {
    const p = this.route.snapshot.queryParamMap;
    const secteur = p.get('secteur');
    if (secteur) this.sectorFilter.set(sectorCode(secteur) || secteur);
    if (p.get('q')) this.searchQuery.set(p.get('q')!);

    const source = p.get('source');
    if (source) this.sourceFilter.set(this.normalizeSource(source));

    const type = p.get('type') as FilterType;
    if (type && type in TYPE_LABELS) this.filterType.set(type);

    const date = p.get('date');
    if (date === '5d') this.dateFilter.set('7d'); // ancienne valeur
    else if (DATE_OPTIONS.some(o => o.value === date)) this.dateFilter.set(date as DateFilter);

    const tri = p.get('tri') as SortType;
    // Par défaut (pas de « tri » dans l'URL) : meilleur score d'abord
    if (tri === 'salary' || tri === 'title' || tri === 'recent') this.sortBy.set(tri);

    const score = Number(p.get('score'));
    if (score === 40 || score === 70) this.minScore.set(score);
  }

  /** Chargement initial (et bouton « Réessayer ») */
  loadJobsOnInit(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.fetchOffers(this.sectorFilter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(offers => this.applyOffers(offers));
  }

  /** Secteur choisi → offres de ce secteur ; aucun → offres recommandées */
  private fetchOffers(code: string) {
    const request$ = code
      ? this.jobService.getOffersBySector(code)
      : this.recommendedOffers();

    return request$.pipe(
      catchError(err => {
        console.error('Erreur chargement offres:', err);
        this.errorMessage.set(code
          ? `Les offres « ${sectorLabel(code)} » n'ont pas pu être chargées. Réessayez dans un instant.`
          : 'Les offres n\'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.');
        return of(null);
      }),
    );
  }

  /**
   * Offres recommandées déjà triées par score (GET /api/jobs/recommended).
   * Si ce nouvel endpoint échoue (backend pas à jour, erreur serveur…),
   * on revient à l'ancien /api/job-offers/recommended : la page reste utilisable.
   */
  private recommendedOffers(): Observable<JobOffer[]> {
    return this.recommendationService.getRecommended().pipe(
      map(offers => offers as JobOffer[]),
      catchError(err => {
        console.warn('GET /api/jobs/recommended indisponible, retour à l\'ancien endpoint', err);
        return this.jobService.getRecommendedOffers();
      }),
    );
  }

  private applyOffers(offers: JobOffer[] | null): void {
    if (offers) {
      this.jobs.set(offers);
      this.useEmbeddedScores(offers);
    }
    this.loading.set(false);
    this.sectorLoading.set(false);
  }

  /**
   * GET /api/jobs/recommended renvoie déjà le score de chaque offre (champ « match ») :
   * on le reprend directement, sans redemander les scores au backend.
   */
  private useEmbeddedScores(offers: JobOffer[]): void {
    const withScore = offers as (JobOffer & { match?: MatchResult })[];
    const embedded = withScore.filter(o => o.match && typeof o.id === 'number');
    if (!embedded.length) return;

    this.scores.update(map => {
      const next = new Map(map);
      for (const o of embedded) {
        next.set(o.id, o.match!);
        this.requestedScoreIds.add(o.id);
      }
      return next;
    });
  }

  // ── Actions ────────────────────────────────────────────────
  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onFilterChange(type: FilterType): void {
    this.filterType.set(type);
  }

  /** Le rechargement est fait par l'effet qui surveille sectorFilter */
  onSectorChange(event: Event): void {
    this.sectorFilter.set((event.target as HTMLSelectElement).value);
  }

  onSourceChange(event: Event): void {
    this.sourceFilter.set((event.target as HTMLSelectElement).value);
  }

  onDateChange(event: Event): void {
    this.dateFilter.set((event.target as HTMLSelectElement).value as DateFilter);
  }

  onSortChange(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as SortType);
  }

  removeChip(key: Chip['key']): void {
    if (key === 'q') this.searchQuery.set('');
    if (key === 'sector') this.sectorFilter.set('');
    if (key === 'source') this.sourceFilter.set('');
    if (key === 'type') this.filterType.set('all');
    if (key === 'date') this.dateFilter.set('all');
    if (key === 'score') this.minScore.set(0);
  }

  clearSearch(input?: HTMLInputElement): void {
    this.searchQuery.set('');
    input?.focus();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterType.set('all');
    this.sectorFilter.set('');
    this.sourceFilter.set('');
    this.dateFilter.set('all');
    this.sortBy.set('score');
    this.minScore.set(0);
  }

  showMore(): void {
    this.visibleCount.update(n => n + PAGE_SIZE);
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
    try { localStorage.setItem(VIEW_KEY, mode); } catch { /* ignoré */ }
  }

  backToTop(): void {
    this.topSentinel?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.searchInput?.nativeElement.focus({ preventScroll: true });
  }

  /**
   * Cherche sur Adzuna ou Jooble (via le backend JobRadar) avec la recherche et le secteur actuels,
   * puis ajoute les nouvelles offres à la liste. Tous les filtres restent appliqués.
   */
  searchExternal(source: ExternalSource): void {
    if (this.externalLoading()) return;
    this.externalLoading.set(source);
    this.externalMessage.set(null);

    const query = this.searchQuery();
    const sector = this.sectorFilter() || undefined;

    // Résultat commun : les offres à fusionner + (pour France Travail) le nombre importé
    let request$: Observable<{ offers: JobOffer[]; imported?: number }>;
    switch (source) {
      case 'FRANCE_TRAVAIL': {
        // 1. Import côté backend (mot-clé si saisi, sinon secteur choisi, sinon import général)
        const import$ = query.trim()
          ? this.franceTravailService.importOffers({ keywords: query, max: 30 })
          : sector
            ? this.franceTravailService.importBySector(sector)
            : this.franceTravailService.importOffers({ max: 30 });

        // 2. Rechargement des offres depuis la base, pour afficher les nouvelles
        request$ = import$.pipe(
          switchMap(res => {
            const reload$ = sector
              ? this.jobService.getOffersBySector(sector)
              : this.recommendedOffers();
            return reload$.pipe(map(offers => ({ offers, imported: res.imported })));
          }),
        );
        break;
      }
      case 'ADZUNA':
        request$ = this.adzunaService.search({ what: query, sector, resultsPerPage: 30 });
        break;
      default:
        request$ = this.joobleService.search({ keywords: query, sector, resultsPerPage: 30 });
    }

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          const known = new Set(this.jobs().map(j => j.id));
          const fresh = result.offers.filter(o => !known.has(o.id));
          // Met à jour les offres déjà présentes, ajoute les nouvelles
          const updated = new Map(result.offers.map(o => [o.id, o]));
          this.jobs.update(list => [...list.map(j => updated.get(j.id) ?? j), ...fresh]);

          this.externalLoading.set(null);
          const n = fresh.length;
          const label = this.sourceLabel(source);
          let text: string;
          if (result.imported !== undefined) {
            // France Travail : nombre importé côté backend + nouvelles offres visibles ici
            text = result.imported
              ? `${result.imported} offre${result.imported > 1 ? 's' : ''} ${label} importée${result.imported > 1 ? 's' : ''}`
                + (n ? `, dont ${n} nouvelle${n > 1 ? 's' : ''} dans cette liste.` : '.')
              : `Aucune nouvelle offre ${label} pour cette recherche.`;
          } else {
            text = n
              ? `${n} nouvelle${n > 1 ? 's' : ''} offre${n > 1 ? 's' : ''} ${label} ajoutée${n > 1 ? 's' : ''} à la liste.`
              : `Aucune nouvelle offre ${label} pour cette recherche.`;
          }
          this.externalMessage.set({ source, type: 'success', text });
        },
        error: (err: HttpErrorResponse) => {
          this.externalLoading.set(null);
          const body = err.error as (AdzunaError & JoobleError) | null;
          const label = this.sourceLabel(source);

          // Message lisible selon le code HTTP, avec la cause technique entre parenthèses
          let text: string;
          switch (err.status) {
            case 0:
              text = 'Le serveur JobRadar ne répond pas. Vérifiez que le backend est lancé.';
              break;
            case 401:
            case 403:
              text = `Accès refusé à la recherche ${label}. Reconnectez-vous ou vérifiez SecurityConfig.`;
              break;
            case 404:
              text = `La recherche ${label} n'existe pas encore côté serveur (contrôleur introuvable).`;
              break;
            default:
              text = body?.message || `Les offres ${label} sont momentanément indisponibles.`;
          }
          const reason = body?.reason ? ` · ${body.reason}` : '';
          console.error(`Recherche ${label} en échec`, err);

          this.externalMessage.set({ source, type: 'error', text: `${text} (erreur ${err.status}${reason})` });
        },
      });
  }

  // ── Scores de matching ────────────────────────────────────
  /** Demande au backend les scores des offres pas encore notées */
  private loadScores(jobs: JobOffer[]): void {
    if (!this.isBrowser || this.scoreNotice()) return;

    const missing = jobs
      .map(j => j.id)
      .filter((id): id is number => typeof id === 'number' && !this.requestedScoreIds.has(id));
    if (!missing.length) return;

    // Lots de 100 (limite du backend)
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
      batch.forEach(id => this.requestedScoreIds.add(id));
      this.scoringIds.update(set => new Set([...set, ...batch]));

      this.matchingService.scoreOffers(batch)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: results => {
            this.scores.update(map => {
              const next = new Map(map);
              results.forEach(r => next.set(r.offerId, r));
              return next;
            });
            this.doneScoring(batch);
          },
          error: (err: HttpErrorResponse) => {
            this.doneScoring(batch);
            // Ces offres pourront être redemandées plus tard
            batch.forEach(id => this.requestedScoreIds.delete(id));
            if (err.status === 404) {
              this.scoreNotice.set({ kind: 'profile', text: 'Complétez votre profil (secteur, compétences, expérience) pour voir votre score sur chaque offre.' });
            } else if (err.status === 401 || err.status === 403) {
              this.scoreNotice.set({ kind: 'auth', text: 'Connectez-vous pour voir votre score de compatibilité sur chaque offre.' });
            } else {
              console.error('Calcul des scores impossible', err);
              this.scoreNotice.set({ kind: 'error', text: `Les scores sont momentanément indisponibles (erreur ${err.status || 'réseau'}).` });
            }
          },
        });
    }
  }

  private doneScoring(ids: number[]): void {
    this.scoringIds.update(set => {
      const next = new Set(set);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }

  scoreOf(job: JobOffer): MatchResult | undefined {
    return this.scores().get(job.id);
  }

  isScoring(job: JobOffer): boolean {
    return this.scoringIds().has(job.id);
  }

  /** 70+ : très compatible ; 40-69 : compatible ; < 40 : peu compatible */
  scoreLevel(score: number): ScoreLevel {
    if (score >= 70) return 'high';
    if (score >= 40) return 'mid';
    return 'low';
  }

  scoreLabel(score: number): string {
    const level = this.scoreLevel(score);
    return level === 'high' ? 'Très compatible' : level === 'mid' ? 'Compatible' : 'Peu compatible';
  }

  /** Texte de l'infobulle : détail des 3 critères et explications */
  scoreTooltip(r: MatchResult): string {
    return [
      `Score ${r.score}/100 — ${this.scoreLabel(r.score)}`,
      `Compétences ${r.skillsScore} · Expérience ${r.experienceScore} · Secteur ${r.sectorScore}`,
      ...r.reasons,
    ].join('\n');
  }

  dismissScoreNotice(): void {
    this.scoreNotice.set(null);
  }

  /** Bouton « Réessayer » du bandeau : relance le calcul des offres affichées */
  retryScores(): void {
    this.scoreNotice.set(null);
    const all = this.sortBy() === 'score' || this.minScore() > 0;
    this.loadScores(all ? this.filteredExceptScore() : this.visibleJobs());
  }

  /** Filtre « Compatibilité » : toutes, ≥ 40 ou ≥ 70 */
  setMinScore(value: MinScore): void {
    this.minScore.set(value);
  }

  // ── Fenêtre modale ────────────────────────────────────────
  /** Clic sur une carte : ouvre la fenêtre de l'offre */
  openOffer(job: JobOffer, tab: ModalTab = 'score'): void {
    this.modalTab.set(tab);
    this.selectedOffer.set(job);
  }

  closeOffer(): void {
    this.selectedOffer.set(null);
  }

  /** Score recalculé dans la fenêtre : la carte affiche la nouvelle valeur */
  onModalMatch(result: MatchResult): void {
    this.scores.update(map => new Map(map).set(result.offerId, result));
  }

  /** Offre très bien notée, mise en avant */
  /** Libellé du secteur sans emoji : « 💻 Informatique / Tech » → « Informatique / Tech » */
  sectorText(code: string | null | undefined): string {
    return sectorLabel(code)
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
      .trim();
  }

  /** Lien entre le secteur de l'offre et celui du candidat, d'après le critère « Secteur » */
  sectorMatch(r: MatchResult): 'same' | 'near' | 'other' {
    if (r.sectorScore >= 70) return 'same';
    if (r.sectorScore >= 40) return 'near';
    return 'other';
  }

  sectorMatchLabel(r: MatchResult): string {
    const m = this.sectorMatch(r);
    return m === 'same' ? 'Votre secteur' : m === 'near' ? 'Secteur proche' : 'Autre secteur';
  }

  sectorMatchIcon(r: MatchResult): string {
    const m = this.sectorMatch(r);
    return m === 'same' ? 'ti-circle-check' : m === 'near' ? 'ti-arrows-exchange' : 'ti-circle-dashed';
  }

  isTopMatch(job: JobOffer): boolean {
    return (this.scoreOf(job)?.score ?? 0) >= TOP_MATCH;
  }

  dismissExternalMessage(): void {
    this.externalMessage.set(null);
  }

  // ── Source d'une offre ─────────────────────────────────────
  /** « France Travail », « ft », null… → code unique (FRANCE_TRAVAIL, ADZUNA…) */
  private normalizeSource(raw: string | null | undefined): string {
    if (!raw) return DEFAULT_SOURCE;
    const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
    return SOURCE_ALIASES[key] ?? key;
  }

  sourceKey(job: JobOffer): string {
    return this.normalizeSource(job.source);
  }

  sourceLabel(source: string): string {
    return SOURCES[source]?.label ?? source.charAt(0) + source.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  sourceIcon(source: string): string {
    return SOURCES[source]?.icon ?? 'ti-world';
  }

  /** Classe CSS du badge : couleur propre à chaque source */
  sourceClass(source: string): string {
    return 'source ' + (SOURCES[source]?.css ?? 'source--other');
  }

  // ── Surlignage et dates ────────────────────────────────────
  /** Découpe un texte pour surligner les mots recherchés (sans innerHTML) */
  highlight(text: string | null | undefined): Segment[] {
    const value = text || '';
    const words = normalize(this.searchQuery().trim()).split(/\s+/).filter(w => w.length > 1);
    if (!words.length || !value) return [{ text: value, match: false }];

    // On cherche dans la version sans accents, mais on découpe le texte d'origine
    const plain = normalize(value);
    const marks = new Array(value.length).fill(false);
    for (const w of words) {
      let i = plain.indexOf(w);
      while (i !== -1) {
        for (let k = i; k < i + w.length; k++) marks[k] = true;
        i = plain.indexOf(w, i + w.length);
      }
    }

    const segments: Segment[] = [];
    for (let i = 0; i < value.length; i++) {
      const last = segments[segments.length - 1];
      if (last && last.match === marks[i]) last.text += value[i];
      else segments.push({ text: value[i], match: marks[i] });
    }
    return segments;
  }

  private periodLabel(date?: string | null): string {
    if (!date) return 'Date inconnue';
    const t = new Date(date).getTime();
    if (isNaN(t)) return 'Date inconnue';
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const diffDays = (startOfToday.getTime() - t) / 86_400_000;
    if (diffDays <= 0) return "Aujourd'hui";
    if (diffDays <= 1) return 'Hier';
    if (diffDays <= 7) return 'Cette semaine';
    if (diffDays <= 30) return 'Ce mois-ci';
    return 'Plus ancien';
  }

  /** « / » place le curseur dans la recherche */
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.selectedOffer()) return; // fenêtre ouverte : elle gère le clavier
    const target = e.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  }

  // ── Affichage ──────────────────────────────────────────────
  sectorIcon = sectorIcon;
  sectorLabel = sectorLabel;

  private withinDays(date: string | undefined, days: number): boolean {
    if (days === Infinity) return true;
    if (!date) return false;
    const t = new Date(date).getTime();
    return !isNaN(t) && Date.now() - t < days * 86_400_000;
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
    if (days < 7) return `Publiée il y a ${days} jours`;
    if (days < 30) {
      const w = Math.floor(days / 7);
      return `Publiée il y a ${w} semaine${w > 1 ? 's' : ''}`;
    }
    return `Publiée le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  isNew(date?: string | null): boolean {
    if (!date) return false;
    const t = new Date(date).getTime();
    return !isNaN(t) && Date.now() - t < 3 * 86_400_000;
  }

  contractClass(type?: string | null): string {
    const t = normalize(type);
    if (t.includes('cdi')) return 'badge--cdi';
    if (t.includes('cdd')) return 'badge--cdd';
    if (t.includes('stage') || t.includes('altern') || t.includes('apprenti')) return 'badge--stage';
    if (t.includes('freelance') || t.includes('independant') || t.includes('mission')) return 'badge--freelance';
    if (t.includes('interim') || t.includes('temporaire')) return 'badge--interim';
    return '';
  }

  /**
   * Teinte de la carte selon le secteur (1 à 6), toujours la même pour un secteur donné.
   * Les 6 teintes sont accordées à la palette (sarcelle, bleu, violet, rose, ambre, vert).
   */
  sectorTone(code?: string | null): number {
    const key = (code || '').toUpperCase();
    if (!key) return 1;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return (hash % 6) + 1;
  }

  /** Fraîcheur de l'offre, pour la couleur de la date */
  freshness(date?: string | null): 'today' | 'week' | 'old' {
    if (!date) return 'old';
    const t = new Date(date).getTime();
    if (isNaN(t)) return 'old';
    const days = (Date.now() - t) / 86_400_000;
    return days < 1 ? 'today' : days < 7 ? 'week' : 'old';
  }

  format(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }
}