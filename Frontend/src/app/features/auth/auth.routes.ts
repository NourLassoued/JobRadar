import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent),
    title: 'JobRadar — Connexion',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then(m => m.RegisterComponent),
    title: 'JobRadar — Inscription',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'JobRadar — Mot de passe oublié',
  },
  {
    path: 'oauth-callback',
    loadComponent: () =>
      import('./oauth-callback/oauth-callback.component').then(m => m.OauthCallbackComponent),
    title: 'JobRadar — Authentification',
  },
];