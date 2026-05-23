import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

interface Mission {
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface Audience {
  emoji: string;
  title: string;
  description: string;
}

interface Comparison {
  feature: string;
  jobradar: string | boolean;
  indeed: string | boolean;
  linkedin: string | boolean;
}

interface TechStack {
  category: string;
  technologies: { name: string; icon: string }[];
}

interface RoadmapItem {
  status: 'done' | 'in-progress' | 'planned';
  title: string;
  date: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {

  // ============================================================
  // MISSION : Ce qu'on fait
  // ============================================================
  missions: Mission[] = [
    {
      icon: 'hub',
      title: 'Agréger',
      description: 'Nous centralisons les offres d\'emploi de l\'API officielle France Travail (1M+ offres légales) et de sources spécialisées par secteur.',
      color: 'blue'
    },
    {
      icon: 'auto_awesome',
      title: 'Scorer avec l\'IA',
      description: 'Notre moteur de matching calcule un score 0-100 personnalisé selon votre profil sur 5 critères pondérés (secteur, lieu, expérience, salaire, télétravail).',
      color: 'purple'
    },
    {
      icon: 'dashboard',
      title: 'Suivre',
      description: 'Vous gérez toutes vos candidatures en un seul endroit avec un Kanban interactif et des statistiques personnelles.',
      color: 'orange'
    }
  ];

  // ============================================================
  // POUR QUI
  // ============================================================
  audiences: Audience[] = [
    {
      emoji: '🎓',
      title: 'Jeunes diplômés',
      description: 'Premier emploi, alternance, stage : on filtre selon votre cursus et votre secteur.'
    },
    {
      emoji: '🔄',
      title: 'Reconvertis',
      description: 'Changement de carrière ? On vous propose les offres adaptées à votre nouveau secteur.'
    },
    {
      emoji: '💼',
      title: 'Cadres confirmés',
      description: 'Postes seniors, télétravail, fourchette salariale : matching précis sur vos critères.'
    },
    {
      emoji: '🌍',
      title: 'Recherche élargie',
      description: 'Tous secteurs, toute France : du BTP à la Tech, en passant par la Santé et le Commerce.'
    },
    {
      emoji: '👨‍🏫',
      title: 'Demandeurs longue durée',
      description: 'Outil de suivi structuré pour reprendre confiance et organiser ses recherches.'
    },
    {
      emoji: '🚀',
      title: 'Freelances',
      description: 'Missions courtes, indépendants : filtrage par type de contrat (CDD, freelance, intérim).'
    }
  ];

  // ============================================================
  // COMPARAISON
  // ============================================================
  comparisons: Comparison[] = [
    { feature: 'Multi-secteurs (14 familles ROME)', jobradar: true, indeed: false, linkedin: false },
    { feature: 'Score de matching IA personnalisé', jobradar: true, indeed: false, linkedin: 'Premium' },
    { feature: 'Données officielles France Travail', jobradar: true, indeed: 'Partiel', linkedin: false },
    { feature: 'Kanban de suivi des candidatures', jobradar: true, indeed: false, linkedin: false },
    { feature: '100% gratuit', jobradar: true, indeed: true, linkedin: false },
    { feature: 'Pas de publicité', jobradar: true, indeed: false, linkedin: false },
    { feature: 'API publique (open data)', jobradar: 'Bientôt', indeed: false, linkedin: false },
    { feature: 'RGPD compliant', jobradar: true, indeed: 'Limité', linkedin: 'Limité' }
  ];

  // ============================================================
  // STATS
  // ============================================================
  stats = [
    { value: '390+', label: 'Offres réelles importées' },
    { value: '14', label: 'Secteurs ROME couverts' },
    { value: '5', label: 'Critères de matching pondérés' },
    { value: '< 200ms', label: 'Temps de réponse API' }
  ];

  // ============================================================
  // TECH STACK
  // ============================================================
  techStack: TechStack[] = [
    {
      category: 'Backend',
      technologies: [
        { name: 'Spring Boot 4', icon: '☕' },
        { name: 'Java 17', icon: '🟧' },
        { name: 'JWT', icon: '🔐' },
        { name: 'OAuth 2.0', icon: '🔑' }
      ]
    },
    {
      category: 'Frontend',
      technologies: [
        { name: 'Angular 18', icon: '🅰️' },
        { name: 'TypeScript', icon: '📘' },
        { name: 'Material Design', icon: '🎨' },
        { name: 'Three.js', icon: '🌐' }
      ]
    },
    {
      category: 'Database',
      technologies: [
        { name: 'PostgreSQL 16', icon: '🐘' },
        { name: 'JPA/Hibernate', icon: '💾' },
        { name: 'Redis (V2)', icon: '⚡' }
      ]
    },
    {
      category: 'Sources & IA',
      technologies: [
        { name: 'France Travail API', icon: '🇫🇷' },
        { name: 'Claude AI', icon: '🤖' },
        { name: 'Indeed (V2)', icon: '🔍' }
      ]
    }
  ];

  // ============================================================
  // ROADMAP
  // ============================================================
  roadmap: RoadmapItem[] = [
    { status: 'done', title: '✅ Authentification JWT + Spring Security', date: 'Mai 2026' },
    { status: 'done', title: '✅ CRUD complet (User, Candidate, JobOffer)', date: 'Mai 2026' },
    { status: 'done', title: '✅ Moteur de matching IA 0-100', date: 'Mai 2026' },
    { status: 'done', title: '✅ Intégration OAuth 2.0 France Travail', date: 'Mai 2026' },
    { status: 'done', title: '✅ Kanban candidatures + Stats', date: 'Mai 2026' },
    { status: 'in-progress', title: '🔄 Frontend Angular 18 + Three.js', date: 'Juin 2026' },
    { status: 'planned', title: '📅 Génération lettres motivation (Claude AI)', date: 'Été 2026' },
    { status: 'planned', title: '📅 Notifications email matinales', date: 'Été 2026' },
    { status: 'planned', title: '📅 PWA mobile + notifications push', date: 'Automne 2026' },
    { status: 'planned', title: '📅 Sources spécialisées (APEC, WTTJ, BatiActu)', date: 'Automne 2026' },
    { status: 'planned', title: '📅 API publique pour développeurs', date: 'Hiver 2026-27' }
  ];

  // Helpers pour le template
  getCheckIcon(value: string | boolean): string {
    if (value === true) return 'check_circle';
    if (value === false) return 'cancel';
    return 'help_outline';
  }

  getCheckColor(value: string | boolean): string {
    if (value === true) return 'success';
    if (value === false) return 'error';
    return 'partial';
  }

  getCheckLabel(value: string | boolean): string {
    if (value === true) return 'Oui';
    if (value === false) return 'Non';
    return value as string;
  }
}