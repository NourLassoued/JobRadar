import { Component } from '@angular/core';

interface Step {
  index: string;
  label: string;
  title: string;
  description: string;
  icon: string;
  accentBg: string;
  accentText: string;
}

@Component({
  selector: 'jr-how-it-works',
  standalone: true,
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {
  steps: Step[] = [
    {
      index: '01',
      label: 'Profil',
      title: 'Importez votre CV',
      description: "L'IA extrait vos compétences et choisit le bon modèle sectoriel.",
      icon: 'ti-upload',
      accentBg: 'bg-indigo-50',
      accentText: 'text-indigo-600',
    },
    {
      index: '02',
      label: 'Scoring',
      title: 'Recevez les meilleures offres',
      description: 'Chaque offre est notée 0-100 selon les critères de votre métier.',
      icon: 'ti-target',
      accentBg: 'bg-orange-50',
      accentText: 'text-orange-600',
    },
    {
      index: '03',
      label: 'Candidature',
      title: 'Postulez en 1 clic',
      description: 'Lettre générée par IA, suivi Kanban, rappels automatiques.',
      icon: 'ti-sparkles',
      accentBg: 'bg-emerald-50',
      accentText: 'text-emerald-700',
    },
  ];
}