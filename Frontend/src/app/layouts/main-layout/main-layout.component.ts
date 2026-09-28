import { Component, computed, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CandidateService } from '../../core/services/candidate.service';
import { CandidateResponse } from '../../core/models/candidate';
import { sectorIcon, sectorLabel } from '../../core/models/sector.utils';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'jr-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [class.is-menu-open]="menuOpen()">

      <!-- ── Barre mobile ──────────────────────────────────── -->
      <header class="topbar">
        <button type="button" class="icon-btn" (click)="toggleMenu()"
                [attr.aria-expanded]="menuOpen()" aria-controls="sidebar"
                [attr.aria-label]="menuOpen() ? 'Fermer le menu' : 'Ouvrir le menu'">
          <i class="ti" [class.ti-menu-2]="!menuOpen()" [class.ti-x]="menuOpen()" aria-hidden="true"></i>
        </button>
        <a routerLink="/app/dashboard" class="brand brand--compact">
          <span class="brand__mark" aria-hidden="true"><i class="ti ti-radar-2"></i></span>
          <span class="brand__name">JobRadar</span>
        </a>
      </header>

      <!-- ── Barre latérale ────────────────────────────────── -->
      <aside id="sidebar" class="sidebar" aria-label="Navigation principale">
        <a routerLink="/app/dashboard" class="brand">
          <span class="brand__mark" aria-hidden="true"><i class="ti ti-radar-2"></i></span>
          <span class="brand__name">JobRadar</span>
        </a>

        <nav class="nav">
          <p class="nav__heading">Menu</p>
          @for (item of navItems; track item.path) {
            <a class="nav__link" [routerLink]="item.path"
               routerLinkActive="is-active" #rla="routerLinkActive"
               [attr.aria-current]="rla.isActive ? 'page' : null">
              <i class="ti {{ item.icon }}" aria-hidden="true"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar__foot">
          <!-- Carte utilisateur = lien vers le profil -->
          @if (isLoadingUser()) {
            <div class="user user--skeleton" aria-hidden="true">
              <span class="skeleton skeleton--avatar"></span>
              <span class="user__text">
                <span class="skeleton skeleton--line w-70"></span>
                <span class="skeleton skeleton--line w-50"></span>
              </span>
            </div>
          } @else if (currentUser()) {
            <a class="user" routerLink="/app/profil" routerLinkActive="is-active"
               #rlaProfile="routerLinkActive" [attr.aria-current]="rlaProfile.isActive ? 'page' : null"
               aria-label="Voir mon profil">
              <span class="user__avatar">
                @if (userAvatar()) {
                  <img [src]="userAvatar()" alt="" />
                } @else {
                  {{ userInitials() }}
                }
              </span>
              <span class="user__text">
                <span class="user__name">{{ fullName() }}</span>
                <span class="user__sector">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="userSectorIcon()" /></svg>
                  {{ userSector() }}
                </span>
              </span>
              <i class="ti ti-chevron-right user__chevron" aria-hidden="true"></i>
            </a>
          } @else {
            <a class="nav__link" routerLink="/app/profil" routerLinkActive="is-active">
              <i class="ti ti-user" aria-hidden="true"></i><span>Mon profil</span>
            </a>
          }

          <button type="button" class="logout" (click)="logout()">
            <i class="ti ti-logout" aria-hidden="true"></i>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <!-- Fond cliquable du menu mobile -->
      @if (menuOpen()) {
        <div class="backdrop" (click)="closeMenu()" aria-hidden="true"></div>
      }

      <!-- ── Contenu ───────────────────────────────────────── -->
      <main class="main" id="main">
        <router-outlet />
      </main>
    </div>
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
      --danger: #b42318;
      --danger-soft: #fdecea;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
      --sidebar-w: 248px;
      --r-md: 8px;
      display: block;
      font-family: var(--font);
      color: var(--ink);
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
        --danger: #f07a6e;
        --danger-soft: #2d1a19;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }

    p {
      margin: 0;
    }

    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    :focus-visible {
      outline: none;
      box-shadow: var(--focus);
    }

    .shell {
      display: grid;
      grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
      height: 100vh;
      height: 100dvh;
      background: var(--paper);
    }

    .main {
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--paper);
    }

    .topbar {
      display: none;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 20px 14px 14px;
      background: var(--surface);
      border-right: 1px solid var(--line);
      overflow-y: auto;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px 22px;
      text-decoration: none;
      color: var(--ink);
      border-radius: var(--r-md);
    }
    .brand--compact {
      padding: 0;
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

    .brand__name {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .nav__heading {
      padding: 0 10px 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .nav__link {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      font-size: 14px;
      font-weight: 500;
      color: var(--ink-soft);
      text-decoration: none;
      border-radius: var(--r-md);
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .nav__link .ti {
      font-size: 19px;
      color: var(--muted);
      transition: color 0.15s ease;
    }
    .nav__link:hover {
      background: var(--surface-sunk);
      color: var(--ink);
    }
    .nav__link:hover .ti {
      color: var(--ink);
    }
    .nav__link.is-active {
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 600;
    }
    .nav__link.is-active .ti {
      color: var(--accent);
    }
    .nav__link.is-active::before {
      content: "";
      position: absolute;
      left: -14px;
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--accent);
    }

    .sidebar__foot {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 14px;
      margin-top: 14px;
      border-top: 1px solid var(--line);
    }

    .user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--surface-sunk);
      color: var(--ink);
      text-decoration: none;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .user:hover {
      border-color: var(--line-strong);
    }
    .user.is-active {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .user:hover .user__chevron {
      transform: translateX(2px);
      color: var(--ink);
    }
    .user--skeleton {
      pointer-events: none;
    }

    .user__avatar {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 10px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 14px;
      font-weight: 700;
    }
    .user__avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .user.is-active .user__avatar {
      background: var(--surface);
    }

    .user__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .user__name {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user__sector {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user__sector svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    .user__chevron {
      font-size: 16px;
      color: var(--muted);
      transition: transform 0.15s ease, color 0.15s ease;
    }

    .logout {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 10px;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
      background: transparent;
      border: 0;
      border-radius: var(--r-md);
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .logout .ti {
      font-size: 19px;
    }
    .logout:hover {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .skeleton {
      display: block;
      border-radius: 6px;
      background: linear-gradient(90deg, var(--line) 0%, var(--surface) 50%, var(--line) 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    .skeleton--avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      flex-shrink: 0;
    }
    .skeleton--line {
      height: 10px;
    }

    .w-50 {
      width: 50%;
    }

    .w-70 {
      width: 70%;
    }

    @keyframes shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    .icon-btn {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 0;
      border-radius: var(--r-md);
      background: transparent;
      color: var(--ink);
      font-size: 22px;
      cursor: pointer;
    }
    .icon-btn:hover {
      background: var(--surface-sunk);
    }

    @media (max-width: 900px) {
      .shell {
        grid-template-columns: 1fr;
        grid-template-rows: 56px minmax(0, 1fr);
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        background: var(--surface);
        border-bottom: 1px solid var(--line);
        position: relative;
        z-index: 42;
      }
      .sidebar {
        position: fixed;
        top: 56px;
        bottom: 0;
        left: 0;
        z-index: 41;
        width: min(var(--sidebar-w), 84vw);
        height: auto;
        transform: translateX(-100%);
        visibility: hidden;
        transition: transform 0.22s ease, visibility 0s linear 0.22s;
      }
      .sidebar .brand:not(.brand--compact) {
        display: none;
      }
      .is-menu-open .sidebar {
        transform: translateX(0);
        visibility: visible;
        transition: transform 0.22s ease, visibility 0s;
        box-shadow: 12px 0 32px rgba(10, 20, 25, 0.16);
      }
      .backdrop {
        position: fixed;
        inset: 56px 0 0 0;
        z-index: 40;
        background: rgba(10, 20, 25, 0.35);
        animation: fade-in 0.2s ease;
      }
      .nav__link.is-active::before {
        display: none;
      }
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class MainLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private candidateService = inject(CandidateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly navItems: NavItem[] = [
    { path: '/app/dashboard', label: 'Tableau de bord', icon: 'ti-layout-dashboard' },
    { path: '/app/offres', label: 'Offres', icon: 'ti-briefcase' },
    { path: '/app/candidatures', label: 'Candidatures', icon: 'ti-layout-kanban' },
    { path: '/app/lettres', label: 'Lettres', icon: 'ti-mail' },
    { path: '/app/analytics', label: 'Analytics', icon: 'ti-chart-bar' },
  ];

  // ── État ───────────────────────────────────────────────────
  currentUser = signal<CandidateResponse | null>(null);
  isLoadingUser = signal(true);
  menuOpen = signal(false);

  // ── Computed ───────────────────────────────────────────────
  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u?.firstName) return '?';
    return (u.firstName.charAt(0) + (u.lastName?.charAt(0) || '')).toUpperCase();
  });

  fullName = computed(() => {
    const u = this.currentUser();
    return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Utilisateur' : '';
  });

  userSector = computed(() => sectorLabel(this.currentUser()?.sector) || 'Secteur non renseigné');
  userAvatar = computed(() => this.currentUser()?.profileImageUrl || '');
  userSectorIcon = computed(() => sectorIcon(this.currentUser()?.sector));

  // ── Cycle de vie ───────────────────────────────────────────
  ngOnInit(): void {
    this.loadCurrentUserProfile();

    // Ferme le menu mobile après chaque navigation
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.menuOpen.set(false));
  }

  private loadCurrentUserProfile(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.isLoadingUser.set(false);
      return;
    }

    this.candidateService.getCandidateById(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.currentUser.set(data);
          this.isLoadingUser.set(false);
        },
        error: err => {
          console.error('Erreur chargement profil:', err);
          this.isLoadingUser.set(false);
        },
      });
  }

  // ── Menu mobile ────────────────────────────────────────────
  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}