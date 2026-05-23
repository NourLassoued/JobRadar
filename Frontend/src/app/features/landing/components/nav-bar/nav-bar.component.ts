import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'jr-nav-bar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur border-b border-gray-200">
      <a routerLink="/" class="flex items-center gap-3 cursor-pointer">
        <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <i class="ti ti-radar-2 text-white text-xl"></i>
        </div>
        <span class="text-base font-medium text-ink">JobRadar</span>
      </a>

      <div class="flex items-center gap-6 text-sm text-muted">
        <a class="hover:text-ink cursor-pointer">Fonctionnalités</a>
        <a class="hover:text-ink cursor-pointer">Secteurs</a>
        <a class="hover:text-ink cursor-pointer">Tarifs</a>

        <a routerLink="/auth/login"
           class="text-indigo-600 font-medium cursor-pointer hover:underline">
          Se connecter
        </a>

        <a routerLink="/auth/register"
           class="bg-indigo-600 text-white rounded-btn px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition cursor-pointer">
          Commencer
        </a>
      </div>
    </nav>
  `,
})
export class NavBarComponent {}