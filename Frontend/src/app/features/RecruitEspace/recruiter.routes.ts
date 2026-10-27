import { Routes } from '@angular/router';

/** Chemin absolu de l'espace recruteur, utilisé par les liens des composants */
export const RECRUITER_BASE = '/app/recruteur';

export const RECRUITER_ROUTES: Routes = [
  {
    path: '',
    title: 'Mes offres · JobRadar',
    loadComponent: () => import('./recruiter-jobs/recruiter-jobs.component').then(m => m.RecruiterJobsComponent),
  },
  {
    path: 'entreprise',
    title: 'Mon entreprise · JobRadar',
    loadComponent: () => import('./company-profile/company-profile.component').then(m => m.CompanyProfileComponent),
  },
  {
    path: 'offres/nouvelle',
    title: 'Publier une offre · JobRadar',
    loadComponent: () => import('./job-form/job-form.component').then(m => m.JobFormComponent),
  },
  {
    path: 'offres/:id/modifier',
    title: "Modifier l'offre · JobRadar",
    loadComponent: () => import('./job-form/job-form.component').then(m => m.JobFormComponent),
  },
  {
    path: 'offres/:id/candidats',
    title: 'Candidats · JobRadar',
    loadComponent: () => import('./job-applicants/job-applicants.component').then(m => m.JobApplicantsComponent),
  },
];