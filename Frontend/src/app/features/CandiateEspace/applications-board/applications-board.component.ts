import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDragStart,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import {
  ApplicationCard,
  ApplicationStats,
  ApplicationTrackingService,
} from '../../../core/services/application-tracking.service';
import {
  ApplicationStatus,
  BOARD_COLUMNS,
  BoardColumn,
  STATUS_LABELS,
  activityIcon,
  activityLabel,
  columnOf,
  contractLabel,
} from '../../../core/models/application-status';
import { ApplicationDetailComponent } from './application-detail/application-detail.component';
import { ApplicationCreateComponent } from './application-create/application-create.component';

type ToastKind = 'success' | 'error';

/**
 * Suivi des candidatures du candidat : Kanban à 8 colonnes, glisser-déposer (Angular CDK),
 * filtres, recherche et statistiques. Toutes les données viennent de l'API (aucune donnée fictive).
 */
@Component({
  selector: 'jr-applications-board',
  standalone: true,
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    ApplicationDetailComponent,
    ApplicationCreateComponent,
  ],
  templateUrl: './applications-board.component.html',
  styleUrl: './applications-board.component.scss',
})
export class ApplicationsBoardComponent implements OnInit {
  private api = inject(ApplicationTrackingService);
  private destroyRef = inject(DestroyRef);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly columns = BOARD_COLUMNS;
  readonly statusLabels = STATUS_LABELS;

  // ── Données ────────────────────────────────────────────────
  readonly cards = signal<ApplicationCard[]>([]);
  readonly stats = signal<ApplicationStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Cartes en cours d'enregistrement après un déplacement */
  readonly saving = signal<ReadonlySet<number>>(new Set());
  readonly toast = signal<{ text: string; kind: ToastKind } | null>(null);

  // ── Interface ──────────────────────────────────────────────
  /** Carte en cours de glisser-déposer : sert à griser les colonnes interdites */
  readonly dragging = signal<ApplicationCard | null>(null);
  /** Candidature ouverte dans le panneau de détail */
  readonly selectedId = signal<number | null>(null);
  readonly createOpen = signal(false);
  readonly filtersOpen = signal(false);

  // ── Filtres ────────────────────────────────────────────────
  readonly search = signal('');
  readonly company = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  /** Colonnes affichées (vide = toutes) */
  readonly statusFilter = signal<ReadonlySet<ApplicationStatus>>(new Set());
  readonly newestFirst = signal(true);

  /** Entreprises présentes dans le suivi, pour le filtre */
  readonly companies = computed(() =>
    [...new Set(this.cards().map(c => c.company?.trim()).filter((c): c is string => !!c))]
      .sort((a, b) => a.localeCompare(b, 'fr')),
  );

  readonly hasFilters = computed(
    () => !!(this.search().trim() || this.company() || this.dateFrom() || this.dateTo() || this.statusFilter().size),
  );

  /** Cartes qui passent la recherche et les filtres entreprise / date */
  readonly filtered = computed(() => {
    const q = normalize(this.search());
    const company = this.company();
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.cards().filter(c => {
      if (company && (c.company ?? '').trim() !== company) return false;
      const day = cardDay(c);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [c.jobTitle, c.company, c.location, c.contractType].some(v => normalize(v ?? '').includes(q));
    });
  });

  readonly visibleColumns = computed(() => {
    const only = this.statusFilter();
    return only.size ? this.columns.filter(col => only.has(col.status)) : this.columns;
  });

  /** Cartes par colonne, dans l'ordre chronologique choisi */
  readonly byColumn = computed(() => {
    const groups = new Map<ApplicationStatus, ApplicationCard[]>();
    for (const col of this.columns) groups.set(col.status, []);
    for (const card of this.filtered()) groups.get(columnOf(card.status))?.push(card);
    const dir = this.newestFirst() ? -1 : 1;
    for (const list of groups.values()) {
      list.sort((a, b) => dir * (sortKey(a).localeCompare(sortKey(b))));
    }
    return groups;
  });

  /** Nombre de cartes affichées (après filtres) */
  readonly shownCount = computed(() =>
    this.visibleColumns().reduce((n, col) => n + (this.byColumn().get(col.status)?.length ?? 0), 0),
  );

  ngOnInit(): void {
    this.load();
  }

  // ── Chargement ─────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ cards: this.api.board(), stats: this.api.stats() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cards, stats }) => {
          this.cards.set(cards);
          this.stats.set(stats);
          this.loading.set(false);
        },
        error: err => {
          this.error.set(ApplicationTrackingService.errorMessage(err, 'Impossible de charger vos candidatures.'));
          this.loading.set(false);
        },
      });
  }

  private refreshStats(): void {
    this.api.stats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stats => this.stats.set(stats),
      error: () => { /* les compteurs restent ceux d'avant */ },
    });
  }

  // ── Glisser-déposer ────────────────────────────────────────

  /** Une colonne n'accepte la carte que si le déplacement est autorisé (règles du backend) */
  readonly canEnter = (drag: CdkDrag<ApplicationCard>, drop: CdkDropList<ApplicationStatus>): boolean => {
    const card = drag.data;
    return columnOf(card.status) === drop.data || card.allowedMoves.includes(drop.data);
  };

  onDragStart(event: CdkDragStart<ApplicationCard>): void {
    this.dragging.set(event.source.data);
  }

  onDragEnd(): void {
    this.dragging.set(null);
  }

  /** La colonne est-elle une destination possible pour la carte en cours de déplacement ? */
  isDropTarget(status: ApplicationStatus): boolean {
    const card = this.dragging();
    return !!card && columnOf(card.status) !== status && card.allowedMoves.includes(status);
  }

  isDropBlocked(status: ApplicationStatus): boolean {
    const card = this.dragging();
    return !!card && columnOf(card.status) !== status && !card.allowedMoves.includes(status);
  }

  drop(event: CdkDragDrop<ApplicationStatus, ApplicationStatus, ApplicationCard>): void {
    this.dragging.set(null);
    const card = event.item.data;
    const target = event.container.data;
    if (event.previousContainer === event.container || columnOf(card.status) === target) return;
    this.moveCard(card, target);
  }

  /** Déplacement (glisser-déposer ou menu du panneau de détail) : affichage immédiat, annulé si l'API refuse */
  moveCard(card: ApplicationCard, target: ApplicationStatus): void {
    if (!card.allowedMoves.includes(target)) {
      this.showToast(this.refusal(card), 'error');
      return;
    }
    this.replaceCard({ ...card, status: target });
    this.setSaving(card.id, true);

    this.api.move(card.id, target).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.replaceCard(updated);
        this.setSaving(card.id, false);
        this.refreshStats();
        this.showToast(`« ${card.jobTitle} » déplacée vers ${STATUS_LABELS[target]}.`, 'success');
      },
      error: err => {
        this.replaceCard(card);
        this.setSaving(card.id, false);
        this.showToast(ApplicationTrackingService.errorMessage(err, 'Le déplacement n\'a pas pu être enregistré.'), 'error');
      },
    });
  }

  private refusal(card: ApplicationCard): string {
    if (card.managedByRecruiter && card.status === 'TO_APPLY') {
      return 'Pour envoyer cette candidature, utilisez « Postuler » sur l\'offre (CV et lettre requis).';
    }
    if (card.managedByRecruiter && card.allowedMoves.length) {
      return 'C\'est le recruteur qui fait avancer cette candidature : vous pouvez seulement la retirer.';
    }
    if (card.managedByRecruiter) return 'Cette candidature est close.';
    return 'Ce déplacement n\'est pas possible.';
  }

  // ── Panneau de détail et ajout ─────────────────────────────

  open(card: ApplicationCard): void {
    this.selectedId.set(card.id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  /** Le panneau a modifié la candidature (contact, relance, événement…) */
  onCardChanged(card: ApplicationCard): void {
    this.replaceCard(card);
    this.refreshStats();
  }

  onRemoved(id: number): void {
    this.cards.update(list => list.filter(c => c.id !== id));
    this.selectedId.set(null);
    this.refreshStats();
    this.showToast('Candidature supprimée du suivi.', 'success');
  }

  onCreated(card: ApplicationCard): void {
    this.cards.update(list => [card, ...list]);
    this.createOpen.set(false);
    this.refreshStats();
    this.showToast(`« ${card.jobTitle} » ajoutée à votre suivi.`, 'success');
  }

  // ── Filtres ────────────────────────────────────────────────

  toggleStatus(status: ApplicationStatus): void {
    this.statusFilter.update(set => {
      const next = new Set(set);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  resetFilters(): void {
    this.search.set('');
    this.company.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.statusFilter.set(new Set());
  }

  countOf(status: ApplicationStatus): number {
    return this.byColumn().get(status)?.length ?? 0;
  }

  /** Nombre total de cartes de la colonne, sans les filtres */
  totalOf(status: ApplicationStatus): number {
    return this.cards().filter(c => columnOf(c.status) === status).length;
  }

  // ── Affichage des cartes ───────────────────────────────────

  trackColumn = (_: number, col: BoardColumn) => col.status;

  initials(card: ApplicationCard): string {
    const name = (card.company ?? card.jobTitle).trim();
    return name.split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
  }

  contract(card: ApplicationCard): string {
    return contractLabel(card.contractType);
  }

  /** « Envoyée le 12 nov. » ou « Ajoutée le 3 nov. » */
  dateLine(card: ApplicationCard): string {
    if (card.appliedAt) return `Envoyée le ${formatDay(card.appliedAt)}`;
    return `Ajoutée le ${formatDay(card.createdAt.slice(0, 10))}`;
  }

  nextEventLabel(card: ApplicationCard): string {
    if (!card.nextEventAt) return '';
    return `${activityLabel(card.nextEventType)} · ${formatDateTime(card.nextEventAt)}`;
  }

  nextEventIcon(card: ApplicationCard): string {
    return activityIcon(card.nextEventType);
  }

  /** Relance : « Relance aujourd'hui », « Relance en retard », « Relance le 14 nov. » */
  followUp(card: ApplicationCard): { label: string; late: boolean } | null {
    if (!card.followUpAt || ['REJECTED', 'WITHDRAWN', 'HIRED'].includes(card.status)) return null;
    const today = todayIso();
    if (card.followUpAt < today) return { label: 'Relance en retard', late: true };
    if (card.followUpAt === today) return { label: 'Relance aujourd\'hui', late: true };
    return { label: `Relance le ${formatDay(card.followUpAt)}`, late: false };
  }

  /** Lien vers l'offre d'origine : seulement http(s) */
  offerLink(card: ApplicationCard): string | null {
    return card.jobUrl && /^https?:\/\//i.test(card.jobUrl) ? card.jobUrl : null;
  }

  isSaving(card: ApplicationCard): boolean {
    return this.saving().has(card.id);
  }

  rate(value: number | null | undefined): string {
    return value == null ? '—' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  }

  rateWidth(value: number | null | undefined): number {
    return value == null ? 0 : Math.max(0, Math.min(100, value));
  }

  // ── Outils ─────────────────────────────────────────────────

  private replaceCard(card: ApplicationCard): void {
    this.cards.update(list => list.map(c => (c.id === card.id ? card : c)));
  }

  private setSaving(id: number, on: boolean): void {
    this.saving.update(set => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private showToast(text: string, kind: ToastKind): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ text, kind });
    this.toastTimer = setTimeout(() => this.toast.set(null), kind === 'error' ? 6000 : 3500);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set(null);
  }
}

// ── Fonctions utilitaires ────────────────────────────────────

/** Jour de référence d'une carte : date d'envoi, sinon date d'ajout (yyyy-MM-dd) */
function cardDay(card: ApplicationCard): string {
  return card.appliedAt ?? card.createdAt.slice(0, 10);
}

/** Clé de tri chronologique */
function sortKey(card: ApplicationCard): string {
  return (card.appliedAt ? card.appliedAt + 'T00:00:00' : card.createdAt) + '|' + card.createdAt;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « 12 nov. 2026 » (l'année seulement si ce n'est pas l'année en cours) */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** « mar. 4 nov. à 10:00 » */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
}
