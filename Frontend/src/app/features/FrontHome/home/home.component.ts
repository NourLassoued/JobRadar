import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as THREE from 'three';

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface Stat {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvas3d', { static: true }) canvas3d!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number = 0;
  private particles!: THREE.Points;

  features: Feature[] = [
    {
      icon: 'psychology',
      title: 'Matching IA',
      description: 'Score 0-100 calculé sur 5 critères pondérés (secteur, lieu, expérience, salaire, télétravail)',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: 'workspaces',
      title: '14 secteurs',
      description: 'Tech, Santé, BTP, Commerce, Hôtellerie... Tous les métiers du référentiel ROME',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: 'dashboard',
      title: 'Kanban suivi',
      description: 'Suivez vos candidatures par drag & drop : Postulé, Entretien, Offre, Refus',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: 'public',
      title: 'API France Travail',
      description: 'Données officielles, 390+ offres temps réel mises à jour automatiquement',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: 'speed',
      title: 'Rapide & moderne',
      description: 'Stack Spring Boot 4 + Angular 18 + PostgreSQL. Performance optimale.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: 'security',
      title: '100% sécurisé',
      description: 'JWT, BCrypt, OAuth 2.0, données chiffrées. RGPD compliant.',
      color: 'from-indigo-500 to-blue-500'
    }
  ];

  stats: Stat[] = [
    { value: '390+', label: 'Offres importées', icon: 'work' },
    { value: '14', label: 'Secteurs métiers', icon: 'category' },
    { value: '0-100', label: 'Score précis IA', icon: 'analytics' },
    { value: '< 200ms', label: 'Temps de réponse', icon: 'speed' }
  ];

  steps = [
    {
      number: '01',
      title: 'Créez votre profil',
      description: 'Indiquez votre secteur, expérience, ville et préférences en 2 minutes',
      icon: 'person_add'
    },
    {
      number: '02',
      title: 'Découvrez vos matches',
      description: 'L\'IA analyse 390+ offres et vous propose les plus pertinentes avec un score',
      icon: 'auto_awesome'
    },
    {
      number: '03',
      title: 'Postulez efficacement',
      description: 'Suivez vos candidatures en Kanban et gagnez 70% de temps',
      icon: 'rocket_launch'
    }
  ];

  ngAfterViewInit(): void {
    this.init3DScene();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  /**
   * Initialise la scène Three.js avec des particules flottantes
   */
  private init3DScene(): void {
    const canvas = this.canvas3d.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Création des particules
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 1500;
    const posArray = new Float32Array(particlesCount * 3);
    const colorArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 12;
      // Couleurs bleu/violet
      if (i % 3 === 0) colorArray[i] = Math.random() * 0.5 + 0.3; // R
      if (i % 3 === 1) colorArray[i] = Math.random() * 0.5 + 0.5; // G
      if (i % 3 === 2) colorArray[i] = Math.random() * 0.5 + 0.8; // B
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
    this.scene.add(this.particles);

    // Listen to resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.particles) {
      this.particles.rotation.y += 0.0005;
      this.particles.rotation.x += 0.0002;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private onWindowResize(): void {
    const canvas = this.canvas3d.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  scrollToFeatures(): void {
    const element = document.getElementById('features');
    element?.scrollIntoView({ behavior: 'smooth' });
  }
}