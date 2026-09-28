import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { JobOffer, JobService } from '../../core/services/job.service';
import { sectorCode, sectorIcon, sectorLabel } from '../../core/models/sector.utils';

type FilterType = 'all' | 'active' | 'remote';
type SortType = 'recent' | 'salary' | 'title';

/** Supprime accents et majuscules : « Développeur » = « developpeur » */
const normalize = (s: string | null | undefined): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

  // ── État ───────────────────────────────────────────────────
  jobs = signal<JobOffer[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  searchQuery = signal('');
  filterType = signal<FilterType>('all');
  sectorFilter = signal('');
  sortBy = signal<SortType>('recent');

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  // ── Compteurs (sur toutes les offres chargées) ─────────────
  totalCount = computed(() => this.jobs().length);
  activeJobsCount = computed(() => this.jobs().filter(j => j.isActive).length);
  remoteJobsCount = computed(() => this.jobs().filter(j => j.remote).length);

  /** Secteurs présents dans les offres, triés par nombre d'offres */
  sectorOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const job of this.jobs()) {
      const key = sectorCode(job.sector) || job.sector;
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count, label: sectorLabel(value) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  // ── Liste filtrée et triée ─────────────────────────────────
  filteredJobs = computed(() => {
    const q = normalize(this.searchQuery().trim());
    const type = this.filterType();
    const sector = this.sectorFilter();

    const list = this.jobs().filter(job => {
      if (type === 'active' && !job.isActive) return false;
      if (type === 'remote' && !job.remote) return false;
      if (sector && (sectorCode(job.sector) || job.sector) !== sector) return false;
      if (!q) return true;
      return normalize(
        [job.title, job.company, job.location, job.description, sectorLabel(job.sector)].join(' ')
      ).includes(q);
    });

    // Copie avant tri : ne jamais muter le tableau du signal
    const sorted = [...list];
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

  hasActiveFilters = computed(() =>
    !!this.searchQuery().trim() || this.filterType() !== 'all' || !!this.sectorFilter() || this.sortBy() !== 'recent'
  );

  // ── Chargement ─────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAllJobs();
  }

  loadAllJobs(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.jobService.getAllOffers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: offers => {
          this.jobs.set(offers);
          this.loading.set(false);
        },
        error: err => {
          console.error('Erreur chargement offres:', err);
          this.errorMessage.set('Les offres n\'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.');
          this.loading.set(false);
        },
      });
  }

  // ── Actions ────────────────────────────────────────────────
  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onFilterChange(type: FilterType): void {
    this.filterType.set(type);
  }

  onSectorChange(event: Event): void {
    this.sectorFilter.set((event.target as HTMLSelectElement).value);
  }

  onSortChange(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as SortType);
  }

  clearSearch(input?: HTMLInputElement): void {
    this.searchQuery.set('');
    input?.focus();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterType.set('all');
    this.sectorFilter.set('');
    this.sortBy.set('recent');
  }

  // ── Affichage ──────────────────────────────────────────────
  sectorIcon = sectorIcon;
  sectorLabel = sectorLabel;

  companyInitial(company?: string | null): string {
    return (company || '?').trim().charAt(0).toUpperCase();
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
}