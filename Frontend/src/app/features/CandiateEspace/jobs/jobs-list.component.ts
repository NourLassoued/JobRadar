import {
  afterNextRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, OnInit,
  PLATFORM_ID, signal, untracked, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { JobOffer, JobService } from '../../../core/services/job.service';
import { SECTOR_LABELS } from '../../../core/models/candidate';
import { sectorCode, sectorIcon, sectorLabel } from '../../../core/models/sector.utils';
import { AdzunaError, AdzunaService } from '../../../core/services/adzuna.service';

type FilterType = 'all' | 'active' | 'remote';
type SortType = 'recent' | 'salary' | 'title';
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
};

/** Variantes possibles en base → code unique (« France Travail », « FT », « pole_emploi »…) */
const SOURCE_ALIASES: Record<string, string> = {
  FRANCE_TRAVAIL: 'FRANCE_TRAVAIL',
  FRANCETRAVAIL: 'FRANCE_TRAVAIL',
  FT: 'FRANCE_TRAVAIL',
  POLE_EMPLOI: 'FRANCE_TRAVAIL',
  ADZUNA: 'ADZUNA',
};

/** Les offres importées avant l'ajout du champ « source » viennent de France Travail */
const DEFAULT_SOURCE = 'FRANCE_TRAVAIL';

/** Supprime accents et majuscules : « Développeur » = « developpeur » */
const normalize = (s: string | null | undefined): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface Chip { key: 'q' | 'sector' | 'type' | 'date' | 'source'; label: string }

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [],
  templateUrl: './jobs-list.component.html',
  styleUrl: './jobs-list.component.scss',
})
export class JobsListComponent implements OnInit {
  private jobService = inject(JobService);
  private adzunaService = inject(AdzunaService);
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
  sortBy = signal<SortType>('recent');
  /** '' = toutes les sources */
  sourceFilter = signal('');

  visibleCount = signal(PAGE_SIZE);

  /** Grille ou liste compacte (mémorisé dans le navigateur) */
  viewMode = signal<ViewMode>('grid');
  /** Affiche le bouton « Haut de page » quand le haut de la liste n'est plus visible */
  showBackToTop = signal(false);

  /** Recherche Adzuna en cours et message de résultat */
  adzunaLoading = signal(false);
  adzunaMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

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

  filteredJobs = computed(() => {
    const days = DATE_OPTIONS.find(o => o.value === this.dateFilter())?.days ?? Infinity;
    const sorted = this.filteredExceptDate().filter(j => this.withinDays(j.createdAt, days));

    switch (this.sortBy()) {
      case 'salary':
        sorted.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
        break;
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

  /** Pastilles des filtres actifs */
  chips = computed<Chip[]>(() => {
    const chips: Chip[] = [];
    const q = this.searchQuery().trim();
    if (q) chips.push({ key: 'q', label: `« ${q} »` });
    if (this.sectorFilter()) chips.push({ key: 'sector', label: sectorLabel(this.sectorFilter()) });
    if (this.sourceFilter()) chips.push({ key: 'source', label: `Source : ${this.sourceLabel(this.sourceFilter())}` });
    if (this.filterType() !== 'all') chips.push({ key: 'type', label: TYPE_LABELS[this.filterType()] });
    if (this.dateFilter() !== 'all') chips.push({ key: 'date', label: DATE_OPTIONS.find(o => o.value === this.dateFilter())!.label });
    return chips;
  });

  hasActiveFilters = computed(() => this.chips().length > 0 || this.sortBy() !== 'recent');

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
      this.filteredExceptDate(); this.dateFilter(); this.sortBy();
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

    // Garder les filtres dans l'URL (rechargement, bouton retour, partage)
    effect(() => {
      const params = {
        q: this.searchQuery().trim() || null,
        secteur: this.sectorFilter() || null,
        source: this.sourceFilter() || null,
        type: this.filterType() !== 'all' ? this.filterType() : null,
        date: this.dateFilter() !== 'all' ? this.dateFilter() : null,
        tri: this.sortBy() !== 'recent' ? this.sortBy() : null,
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
    if (tri === 'salary' || tri === 'title') this.sortBy.set(tri);
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
      : this.jobService.getRecommendedOffers();

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

  private applyOffers(offers: JobOffer[] | null): void {
    if (offers) this.jobs.set(offers);
    this.loading.set(false);
    this.sectorLoading.set(false);
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
    this.sortBy.set('recent');
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
   * Cherche sur Adzuna (via le backend JobRadar) avec la recherche et le secteur actuels,
   * puis ajoute les nouvelles offres à la liste. Tous les filtres restent appliqués.
   */
  searchAdzuna(): void {
    if (this.adzunaLoading()) return;
    this.adzunaLoading.set(true);
    this.adzunaMessage.set(null);

    this.adzunaService.search({
      what: this.searchQuery(),
      sector: this.sectorFilter() || undefined,
      resultsPerPage: 30,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          const known = new Set(this.jobs().map(j => j.id));
          const fresh = result.offers.filter(o => !known.has(o.id));
          // Met à jour les offres déjà présentes, ajoute les nouvelles
          const updated = new Map(result.offers.map(o => [o.id, o]));
          this.jobs.update(list => [...list.map(j => updated.get(j.id) ?? j), ...fresh]);

          this.adzunaLoading.set(false);
          const n = fresh.length;
          this.adzunaMessage.set({
            type: 'success',
            text: n
              ? `${n} nouvelle${n > 1 ? 's' : ''} offre${n > 1 ? 's' : ''} Adzuna ajoutée${n > 1 ? 's' : ''} à la liste.`
              : 'Aucune nouvelle offre Adzuna pour cette recherche.',
          });
        },
        error: (err: HttpErrorResponse) => {
          this.adzunaLoading.set(false);
          const body = err.error as AdzunaError | null;
          this.adzunaMessage.set({
            type: 'error',
            text: body?.message || 'Les offres Adzuna sont momentanément indisponibles.',
          });
        },
      });
  }

  dismissAdzunaMessage(): void {
    this.adzunaMessage.set(null);
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
    if (t.includes('stage') || t.includes('altern')) return 'badge--stage';
    if (t.includes('freelance') || t.includes('independant') || t.includes('mission')) return 'badge--freelance';
    return '';
  }

  format(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }
}