import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Page publique d'accueil
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    title: 'JobRadar — Trouvez l\'offre qui vous correspond vraiment',
  },

  // Authentification (lazy)
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  // Zone applicative protégée
  {
    path: 'app',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],    
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'JobRadar — Tableau de bord',
      },
      {
        path: 'offres',
        loadComponent: () =>
          import('./features/jobs/jobs-list.component').then(m => m.JobsListComponent),
        title: 'JobRadar — Offres',
      },
      {
        path: 'offres/:id',
        loadComponent: () =>
          import('./features/jobs/job-detail.component').then(m => m.JobDetailComponent),
        title: 'JobRadar — Détail de l\'offre',
      },
      {
        path: 'candidatures',
        loadComponent: () =>
          import('./features/applications/kanban.component').then(m => m.KanbanComponent),
        title: 'JobRadar — Mes candidatures',
      },
      {
        path: 'lettres',
        loadComponent: () =>
          import('./features/letters/letters.component').then(m => m.LettersComponent),
        title: 'JobRadar — Lettres de motivation',
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
        title: 'JobRadar — Analytics',
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
        title: 'JobRadar — Mon profil',
      },
    ],
  },

  // Page 404
  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'JobRadar — Page introuvable',
  },

  // Wildcard : tout le reste redirige vers 404
  {
    path: '**',
    redirectTo: '404',
  },
];