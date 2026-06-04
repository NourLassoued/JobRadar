import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'jr-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen flex bg-mist">
      <aside class="w-60 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <i class="ti ti-radar-2 text-white text-xl"></i>
          </div>
          <span class="text-base font-medium text-ink">JobRadar</span>
        </div>

        <nav class="flex flex-col gap-1 text-sm flex-1">
          <a routerLink="/app/dashboard" routerLinkActive="bg-indigo-50 text-indigo-700"
             class="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-gray-50">
            <i class="ti ti-dashboard"></i>Tableau de bord
          </a>
          <a routerLink="/app/offres" routerLinkActive="bg-indigo-50 text-indigo-700"
             class="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-gray-50">
            <i class="ti ti-briefcase"></i>Offres
          </a>
          <a routerLink="/app/candidatures" routerLinkActive="bg-indigo-50 text-indigo-700"
             class="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-gray-50">
            <i class="ti ti-layout-kanban"></i>Candidatures
          </a>
          <a routerLink="/app/lettres" routerLinkActive="bg-indigo-50 text-indigo-700"
             class="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-gray-50">
            <i class="ti ti-mail"></i>Lettres
          </a>
          <a routerLink="/app/analytics" routerLinkActive="bg-indigo-50 text-indigo-700"
             class="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-gray-50">
            <i class="ti ti-chart-bar"></i>Analytics
          </a>
          <a routerLink="/app/profil" routerLinkActive="bg-indigo-50 text-indigo-700"
             class="flex items-center gap-2 px-3 py-2 rounded-lg text-muted hover:bg-gray-50">
            <i class="ti ti-user"></i>Profil
          </a>
        </nav>

        <!-- Bouton logout en bas de la sidebar -->
        <button (click)="logout()"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 mt-4 w-full">
          <i class="ti ti-logout"></i>Déconnexion
        </button>
      </aside>

      <main class="flex-1 overflow-auto">
        <router-outlet />
      </main>
    </div>
  `,
})
export class MainLayoutComponent {
  private authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
  
}