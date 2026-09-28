import { Component } from '@angular/core';

interface Step {
  index: string;
  label: string;
  title: string;
  description: string;
  icon: string;
  visual: 'cv' | 'score' | 'kanban';
}

@Component({
  selector: 'jr-how-it-works',
  standalone: true,
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {
  readonly steps: Step[] = [
    {
      index: '01',
      label: 'Profil',
      title: 'Importez votre CV',
      description: "L'IA repère vos compétences et identifie votre secteur pour appliquer les bons critères.",
      icon: 'ti-upload',
      visual: 'cv',
    },
    {
      index: '02',
      label: 'Score',
      title: 'Recevez les offres qui vous correspondent',
      description: 'Chaque offre reçoit une note de 0 à 100 selon les critères propres à votre métier.',
      icon: 'ti-target-arrow',
      visual: 'score',
    },
    {
      index: '03',
      label: 'Candidature',
      title: 'Postulez et suivez tout au même endroit',
      description: 'Lettre de motivation générée, suivi de vos candidatures en colonnes et rappels.',
      icon: 'ti-layout-kanban',
      visual: 'kanban',
    },
  ];

  /** Compétences affichées dans l'illustration de l'étape 1 */
  readonly cvSkills = ['Java', 'Angular', 'Docker'];

  /** Colonnes de l'illustration de l'étape 3 */
  readonly kanban = [
    { label: 'À envoyer', cards: [1, 2] },
    { label: 'Envoyée', cards: [1, 2, 3] },
    { label: 'Entretien', cards: [1] },
  ];
}