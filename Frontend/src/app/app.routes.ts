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

  // Authentification (lazy) — auth/callback géré dedans
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  // Zone applicative protégée
  {
    path: 'app',
    loadComponent: () =>
      import('./features/CandiateEspace/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
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
          import('./features/CandiateEspace/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'JobRadar — Tableau de bord',
      },
      {
        path: 'offres',
        loadComponent: () =>
          import('./features/CandiateEspace/jobs/jobs-list.component').then(m => m.JobsListComponent),
        title: 'JobRadar — Offres',
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
          import('./features/CandiateEspace/letters/letters.component').then(m => m.LettersComponent),
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
          import('./features/CandiateEspace/profile/profile.component').then(m => m.ProfileComponent),
        title: 'JobRadar — Mon profil',
        data: { myProfile: true },
      },

      // Espace recruteur : /app/recruteur, /app/recruteur/entreprise, /app/recruteur/offres/...
      {
        path: 'recruteur',
        loadChildren: () =>
          import('./features/RecruitEspace/recruiter.routes').then(m => m.RECRUITER_ROUTES),
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

  // Wildcard (toujours en dernier)
  {
    path: '**',
    redirectTo: '404',
  },
];