import {
  afterNextRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, OnInit,
  PLATFORM_ID, signal, untracked, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, of, skip, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { JobOffer, JobService } from '../../../core/services/job.service';
import { SECTOR_LABELS } from '../../../core/models/candidate';
import { sectorCode, sectorIcon, sectorLabel } from '../../../core/models/sector.utils';

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

/** Supprime accents et majuscules : « Développeur » = « developpeur » */
const normalize = (s: string | null | undefined): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface Chip { key: 'q' | 'sector' | 'type' | 'date'; label: string }

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [],
  templateUrl: './jobs-list.component.html',
  styleUrl: './jobs-list.component.scss',
})
export class JobsListComponent implements OnInit {
  private jobService = inject(JobService);
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

  visibleCount = signal(PAGE_SIZE);

  /** Grille ou liste compacte (mémorisé dans le navigateur) */
  viewMode = signal<ViewMode>('grid');
  /** Affiche le bouton « Haut de page » quand le haut de la liste n'est plus visible */
  showBackToTop = signal(false);

  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly dateOptions = DATE_OPTIONS;

  // ── Compteurs (sur toutes les offres chargées) ─────────────
  totalCount = computed(() => this.jobs().length);
  activeJobsCount = computed(() => this.jobs().filter(j => j.isActive).length);
  remoteJobsCount = computed(() => this.jobs().filter(j => j.remote).length);

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

    // Le secteur est déjà filtré par le backend (getOffersBySector)
    return this.jobs().filter(job => {
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

    // Garder les filtres dans l'URL (rechargement, bouton retour, partage)
    effect(() => {
      const sector = this.sectorFilter();
      untracked(() => {
        if (!this.loading()) {
          this.sectorLoading.set(true);
          this.fetchOffers(sector)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(offers => this.applyOffers(offers));
        }
      });
    }, { allowSignalWrites: true });
    
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

    const type = p.get('type') as FilterType;
    if (type && type in TYPE_LABELS) this.filterType.set(type);

    const date = p.get('date');
    if (date === '5d') this.dateFilter.set('7d'); // ancienne valeur
    else if (DATE_OPTIONS.some(o => o.value === date)) this.dateFilter.set(date as DateFilter);

    const tri = p.get('tri') as SortType;
    if (tri === 'salary' || tri === 'title') this.sortBy.set(tri);
  }

  /** Offres recommandées si connecté, sinon toutes (géré par le service) */
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
onSectorChange(event: Event): void {
  const selectedSector = (event.target as HTMLSelectElement).value;
  
  this.sectorFilter.set(selectedSector);
  this.visibleCount.set(PAGE_SIZE);
  
  //  AJOUTER CES 3 LIGNES
  this.sectorLoading.set(true);
  this.fetchOffers(selectedSector)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(offers => this.applyOffers(offers));
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