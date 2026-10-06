import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef,
  inject, input, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTOR_LABELS } from '../../../core/models/candidate';

interface Stat {
  key: string;
  value: number | null; // null = donnée indisponible → case masquée
  label: string;
  icon: string;
  suffix?: string;
}

/**
 * VERSION SIMPLE : une bande de chiffres réels + un bouton.
 * Plus légère que jr-animated-stats-section (pas de témoignages ni d'histoires).
 */
@Component({
  selector: 'jr-animated-stats-simple',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="band" aria-label="JobRadar en chiffres">
      <div class="band__inner">

        <dl class="row">
          @for (s of visibleStats(); track s.key; let i = $index) {
            <div class="stat reveal" [style.animation-delay.ms]="i * 90">
              <span class="stat__icon" aria-hidden="true"><i [class]="'ti ' + s.icon"></i></span>
              <dt class="stat__label">{{ s.label }}</dt>
              <dd class="stat__value">{{ format(displayed()[s.key] ?? 0) }}{{ s.suffix ?? '' }}</dd>
            </div>
          }
        </dl>

        <div class="cta reveal" style="animation-delay: 380ms">
          <p class="cta__text">Gratuit, sans carte bancaire.</p>
          <a routerLink="/auth/register" class="btn">
            Créer mon compte <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      --surface: #ffffff; --surface-sunk: #f7f8f8;
      --ink: #17202a; --muted: #66727e;
      --line: #dde2e5;
      --accent: #155e63; --accent-hover: #0f4a4e; --accent-soft: #e2efee;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
      display: block;
      font-family: var(--font);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --surface: #161e23; --surface-sunk: #12191d;
        --ink: #e6ebee; --muted: #8d9aa4;
        --line: #253038;
        --accent: #5fb3b3; --accent-hover: #7cc6c5; --accent-soft: #19302f;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }
    p, dl, dd { margin: 0; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    .band { padding: 28px 24px; background: var(--surface); border-bottom: 1px solid var(--line); }

    .band__inner {
      display: flex;
      align-items: center;
      gap: 24px 40px;
      max-width: 1120px;
      margin: 0 auto;
    }

    .reveal { opacity: 0; transform: translateY(10px); }
    :host(.is-visible) .reveal { animation: rise 0.55s ease-out forwards; }
    @keyframes rise { to { opacity: 1; transform: translateY(0); } }

    /* ── Chiffres ───────────────────────────────────────── */
    .row {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 20px;
    }

    /* Icône à gauche, chiffre au-dessus du libellé (grille : HTML valide pour dt/dd) */
    .stat {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      grid-template-areas: 'icon value' 'icon label';
      column-gap: 14px;
      align-items: center;
    }

    .stat__icon { grid-area: icon; }
    .stat__value { grid-area: value; }
    .stat__label { grid-area: label; }

    .stat__icon {
      display: grid; place-items: center;
      width: 42px; height: 42px; flex-shrink: 0;
      border-radius: 11px;
      background: var(--accent-soft); color: var(--accent);
      font-size: 20px;
    }

    .stat__value {
      font-size: 26px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }

    .stat__label { font-size: 13px; color: var(--muted); }

    /* ── CTA ────────────────────────────────────────────── */
    .cta {
      display: flex; align-items: center; gap: 16px; flex-shrink: 0;
      padding-left: 32px;
      border-left: 1px solid var(--line);
    }

    .cta__text { font-size: 14px; color: var(--muted); }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      height: 44px; padding: 0 18px;
      font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap;
      text-decoration: none; border-radius: 8px;
      background: var(--accent); color: #fff;
      transition: background-color 0.15s ease;
    }

    .btn .ti { font-size: 16px; transition: transform 0.15s ease; }
    .btn:hover { background: var(--accent-hover); }
    .btn:hover .ti { transform: translateX(3px); }

    @media (prefers-color-scheme: dark) {
      .btn { color: #0f1519; }
    }

    @media (max-width: 900px) {
      .band__inner { flex-direction: column; align-items: stretch; }
      .row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cta { padding: 20px 0 0; border-left: 0; border-top: 1px solid var(--line); justify-content: space-between; }
    }

    @media (max-width: 420px) {
      .row { grid-template-columns: 1fr; }
      .cta { flex-direction: column; align-items: stretch; }
      .btn { justify-content: center; }
    }

    @media (prefers-reduced-motion: reduce) {
      .reveal, :host(.is-visible) .reveal { opacity: 1; transform: none; animation: none; }
      .btn, .btn .ti { transition: none; }
    }
  `],
})
export class AnimatedStatsSimpleComponent {
  private host = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  /** Données réelles fournies par la page (null = case masquée) */
  totalOffers = input<number | null>(null);
  newToday = input<number | null>(null);

  private readonly sectorCount = Object.keys(SECTOR_LABELS).filter(k => k !== 'OTHER').length;

  stats = computed<Stat[]>(() => [
    { key: 'offers', value: this.totalOffers(), icon: 'ti-briefcase', label: 'offres disponibles' },
    { key: 'today', value: this.newToday(), icon: 'ti-clock-plus', label: "nouvelles aujourd'hui" },
    { key: 'sectors', value: this.sectorCount, icon: 'ti-category', label: 'familles de métiers' },
  ]);

  visibleStats = computed(() => this.stats().filter(s => s.value !== null));

  displayed = signal<Partial<Record<string, number>>>({});

  private visible = signal(false);
  private frame = 0;

  constructor() {
    // afterNextRender ne s'exécute que dans le navigateur (jamais en SSR)
    afterNextRender(() => {
      this.destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));

      const el = this.host.nativeElement as HTMLElement;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduce || !('IntersectionObserver' in window)) {
        el.classList.add('is-visible');
        this.visible.set(true);
        return;
      }

      const observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          el.classList.add('is-visible');
          this.visible.set(true);
          observer.disconnect();
        }
      }, { threshold: 0.3 });

      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      const stats = this.visibleStats();
      if (this.visible()) this.countUp(stats);
    }, { allowSignalWrites: true });
  }

  private countUp(stats: Stat[]): void {
    cancelAnimationFrame(this.frame);
    const targets = Object.fromEntries(stats.map(s => [s.key, s.value ?? 0]));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayed.set(targets);
      return;
    }

    const duration = 1200;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const values: Record<string, number> = {};
      for (const [key, target] of Object.entries(targets)) values[key] = Math.round(target * easeOut(t));
      this.displayed.set(values);
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };

    this.frame = requestAnimationFrame(tick);
  }

  format(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }
}