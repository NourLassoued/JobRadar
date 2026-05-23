import { Component, signal } from '@angular/core';
import { JobCardPreviewComponent } from '../job-card-preview/job-card-preview.component';
import { JobPreview } from '../../../../core/models/sector.model';

@Component({
  selector: 'jr-hero-section',
  standalone: true,
  imports: [JobCardPreviewComponent],
  template: `
    <section class="px-7 py-10 relative"
             style="background: linear-gradient(180deg, rgba(79,70,229,0.04), rgba(249,112,102,0.03));">
      <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 items-center max-w-6xl mx-auto">

        <div>
          <div class="inline-flex items-center gap-2 bg-indigo-600/10 text-indigo-700 rounded-full px-3 py-1 text-xs font-medium mb-4">
            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
            {{ newJobsToday() }} nouvelles offres aujourd'hui
          </div>

          <h1 class="text-3xl lg:text-4xl font-medium tracking-tight leading-tight text-ink mb-3">
            Trouvez l'offre qui vous correspond
            <span class="text-indigo-600">vraiment</span>,
            peu importe votre métier.
          </h1>

          <p class="text-sm lg:text-base text-muted mb-5 leading-relaxed">
            1M+ offres agrégées · Scoring IA adaptatif par secteur ·
            14 familles de métiers couvertes.
          </p>

          <div class="flex gap-3 mb-5">
            <button class="bg-indigo-600 text-white rounded-btn px-5 py-3 text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2">
              Commencer gratuitement
              <i class="ti ti-arrow-right"></i>
            </button>
            <button class="bg-white/70 text-ink border border-gray-300 rounded-btn px-5 py-3 text-sm font-medium hover:bg-white transition flex items-center gap-2">
              <i class="ti ti-player-play"></i>
              Voir la démo
            </button>
          </div>

          <div class="flex gap-4 text-xs text-muted">
            <span class="inline-flex items-center gap-1">
              <i class="ti ti-shield-check text-emerald-500 text-base"></i>RGPD
            </span>
            <span class="inline-flex items-center gap-1">
              <i class="ti ti-circle-check text-emerald-500 text-base"></i>Partenaire France Travail
            </span>
            <span>🇫🇷 Made in France</span>
          </div>
        </div>

        <div class="relative h-72">
          @for (job of jobs(); track $index) {
            <div class="absolute w-[80%]"
                 [style.top.px]="positions[$index].top"
                 [style.left.px]="positions[$index].left"
                 [style.right.px]="positions[$index].right"
                 [style.bottom.px]="positions[$index].bottom"
                 [style.transform]="'rotate(' + positions[$index].rotate + 'deg)'">
              <jr-job-card-preview [job]="job" />
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class HeroSectionComponent {
  newJobsToday = signal(1247);

  jobs = signal<JobPreview[]>([
    {
      title: 'Infirmier(ère) DE',
      company: 'CH Orléans',
      context: 'CDI',
      sector: { id: 'sante', label: 'Santé', icon: 'ti-stethoscope', bg: 'bg-pink-100', text: 'text-pink-600' },
      score: 85,
    },
    {
      title: 'Full-stack Java/Angular',
      company: 'CGI',
      context: 'Orléans · Hybride',
      sector: { id: 'tech', label: 'Tech', icon: 'ti-code', bg: 'bg-blue-100', text: 'text-blue-700' },
      score: 93,
    },
    {
      title: 'Chef de partie',
      company: 'Le Lift',
      context: 'Orléans · CDI',
      sector: { id: 'hotel', label: 'Hôtellerie', icon: 'ti-tools-kitchen-2', bg: 'bg-amber-100', text: 'text-amber-700' },
      score: 64,
    },
  ]);

  positions = [
    { top: 16, left: 8, right: null, bottom: null, rotate: -3 },
    { top: 90, left: null, right: 0, bottom: null, rotate: 2 },
    { top: null, left: 32, right: null, bottom: 0, rotate: -1 },
  ];
}