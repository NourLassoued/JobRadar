import { Component, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface NavLink {
  label: string;
  fragment: string; // id de la section cible sur la page d'accueil
}

@Component({
  selector: 'jr-nav-bar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="nav" [class.is-scrolled]="scrolled()" [class.is-open]="menuOpen()">
      <div class="nav__inner">
        <a routerLink="/" class="brand" (click)="closeMenu()">
          <span class="brand__mark" aria-hidden="true"><i class="ti ti-radar-2"></i></span>
          <span class="brand__name">JobRadar</span>
        </a>

        <nav class="nav__links" aria-label="Sections de la page">
          @for (link of links; track link.fragment) {
            <a routerLink="/" [fragment]="link.fragment" class="nav__link">{{ link.label }}</a>
          }
        </nav>

        <div class="nav__actions">
          <a routerLink="/auth/login" class="btn btn--ghost">Se connecter</a>
          <a routerLink="/auth/register" class="btn btn--primary">
            Commencer <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </a>
        </div>

        <button type="button" class="nav__toggle" (click)="toggleMenu()"
                [attr.aria-expanded]="menuOpen()" aria-controls="mobile-menu"
                [attr.aria-label]="menuOpen() ? 'Fermer le menu' : 'Ouvrir le menu'">
          <i [class]="'ti ' + (menuOpen() ? 'ti-x' : 'ti-menu-2')" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Menu mobile -->
      @if (menuOpen()) {
        <div class="mobile" id="mobile-menu">
          <nav class="mobile__links" aria-label="Sections de la page">
            @for (link of links; track link.fragment) {
              <a routerLink="/" [fragment]="link.fragment" class="mobile__link" (click)="closeMenu()">
                {{ link.label }} <i class="ti ti-chevron-right" aria-hidden="true"></i>
              </a>
            }
          </nav>
          <div class="mobile__actions">
            <a routerLink="/auth/register" class="btn btn--primary btn--block" (click)="closeMenu()">
              Commencer gratuitement
            </a>
            <a routerLink="/auth/login" class="btn btn--secondary btn--block" (click)="closeMenu()">
              Se connecter
            </a>
          </div>
        </div>
      }
    </header>
  `,
  styles: [`
    :host {
      --paper: #f3f5f4;
      --surface: #ffffff;
      --surface-sunk: #f7f8f8;
      --ink: #17202a;
      --ink-soft: #3a4652;
      --muted: #66727e;
      --line: #dde2e5;
      --line-strong: #c5ccd2;
      --accent: #155e63;
      --accent-hover: #0f4a4e;
      --accent-soft: #e2efee;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;

      display: block;
      position: sticky;
      top: 0;
      z-index: 50;
      font-family: var(--font);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --paper: #0f1519;
        --surface: #161e23;
        --surface-sunk: #12191d;
        --ink: #e6ebee;
        --ink-soft: #c3ccd2;
        --muted: #8d9aa4;
        --line: #253038;
        --line-strong: #34424c;
        --accent: #5fb3b3;
        --accent-hover: #7cc6c5;
        --accent-soft: #19302f;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    /* ── Barre ───────────────────────────────────────────── */
    .nav {
      background: color-mix(in srgb, var(--paper) 82%, transparent);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
    }

    .nav.is-scrolled,
    .nav.is-open {
      background: color-mix(in srgb, var(--surface) 92%, transparent);
      border-bottom-color: var(--line);
      box-shadow: 0 6px 20px -14px rgba(13, 58, 62, 0.35);
    }

    .nav__inner {
      display: flex;
      align-items: center;
      gap: 32px;
      max-width: 1120px;
      height: 68px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* ── Marque ──────────────────────────────────────────── */
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--ink);
      text-decoration: none;
      border-radius: 8px;
    }

    .brand__mark {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: var(--accent);
      color: #fff;
      font-size: 19px;
    }

    .brand__name { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }

    /* ── Liens ───────────────────────────────────────────── */
    .nav__links { display: flex; gap: 4px; flex: 1; }

    .nav__link {
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 500;
      color: var(--ink-soft);
      text-decoration: none;
      border-radius: 8px;
      transition: color 0.15s ease, background-color 0.15s ease;
    }

    .nav__link:hover { color: var(--ink); background: var(--surface-sunk); }

    .nav__actions { display: flex; align-items: center; gap: 8px; }

    /* ── Boutons ─────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 40px;
      padding: 0 16px;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      border-radius: 8px;
      border: 1px solid transparent;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .btn .ti { font-size: 16px; transition: transform 0.15s ease; }

    .btn--primary { background: var(--accent); color: #fff; }
    .btn--primary:hover { background: var(--accent-hover); }
    .btn--primary:hover .ti-arrow-right { transform: translateX(3px); }

    .btn--ghost { color: var(--ink); }
    .btn--ghost:hover { background: var(--surface-sunk); color: var(--accent); }

    .btn--secondary { background: var(--surface); border-color: var(--line-strong); color: var(--ink); }
    .btn--secondary:hover { border-color: var(--accent); color: var(--accent); }

    .btn--block { width: 100%; height: 46px; font-size: 15px; }

    @media (prefers-color-scheme: dark) {
      .btn--primary, .brand__mark { color: #0f1519; }
    }

    /* ── Mobile ──────────────────────────────────────────── */
    .nav__toggle {
      display: none;
      place-items: center;
      width: 40px;
      height: 40px;
      margin-left: auto;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--ink);
      font-size: 22px;
      cursor: pointer;
    }

    .nav__toggle:hover { background: var(--surface-sunk); }

    .mobile {
      padding: 8px 20px 20px;
      border-top: 1px solid var(--line);
      animation: drop 0.18s ease-out;
    }

    .mobile__links { display: flex; flex-direction: column; }

    .mobile__link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 4px;
      font-size: 16px;
      font-weight: 500;
      color: var(--ink);
      text-decoration: none;
      border-bottom: 1px solid var(--line);
    }

    .mobile__link .ti { color: var(--muted); font-size: 18px; }

    .mobile__actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }

    @keyframes drop {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 820px) {
      .nav__links, .nav__actions { display: none; }
      .nav__toggle { display: grid; }
      .nav__inner { height: 60px; padding: 0 16px; }
    }

    @media (min-width: 821px) {
      .mobile { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .nav, .mobile, .btn, .btn .ti, .nav__link { transition: none; animation: none; }
    }
  `],
})
export class NavBarComponent {
  readonly links: NavLink[] = [
    { label: 'Fonctionnalités', fragment: 'fonctionnalites' },
    { label: 'Secteurs', fragment: 'secteurs' },
    { label: 'Tarifs', fragment: 'tarifs' },
  ];

  scrolled = signal(false);
  menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 820) this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }
}