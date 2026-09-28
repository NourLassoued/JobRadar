import { Component, computed, input } from '@angular/core';
import { sectorIcon, sectorLabel } from '../../../../core/models/sector.utils';

/** Données d'une carte d'aperçu. `sector` = code de l'enum Java (TECH, HEALTH…) */
export interface JobCardData {
  title: string;
  company: string;
  context: string;
  sector: string;
  score: number; // 0 à 100
}

@Component({
  selector: 'jr-job-card-preview',
  standalone: true,
  template: `
    <article class="job">
      <div class="job__top">
        <span class="job__sector" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path [attr.d]="icon()" /></svg>
        </span>
        <span class="job__company">
          <span class="job__company-name">{{ job().company }}</span>
          <span class="job__company-sector">{{ label() }}</span>
        </span>
        <span class="score" [class.score--low]="job().score < 70"
              [style.width.px]="size()" [style.height.px]="size()"
              role="img" [attr.aria-label]="'Correspondance ' + job().score + ' sur 100'">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" class="score__track" />
            <circle cx="20" cy="20" r="16" class="score__value" pathLength="100"
                    [attr.stroke-dasharray]="clampedScore() + ' 100'" transform="rotate(-90 20 20)" />
          </svg>
          <span class="score__num" aria-hidden="true">{{ clampedScore() }}</span>
        </span>
      </div>
      <p class="job__title">{{ job().title }}</p>
      <p class="job__meta">
        <i class="ti ti-map-pin" aria-hidden="true"></i>{{ job().context }}
      </p>
    </article>
  `,
  styles: [`
    /* Les variables viennent de la page parente ; valeurs de secours si le composant est utilisé seul */
    :host {
      display: block;
      font-family: var(--font, 'Schibsted Grotesk', 'Segoe UI', system-ui, sans-serif);
      color: var(--ink, #17202a);
    }

    *, *::before, *::after { box-sizing: border-box; }
    p { margin: 0; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

    .job {
      padding: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--line, #dde2e5);
      border-radius: 14px;
      box-shadow: 0 18px 40px -20px rgba(13, 58, 62, 0.4);
    }

    .job__top { display: flex; align-items: center; gap: 12px; }

    .job__sector {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      flex-shrink: 0;
      border-radius: 10px;
      background: var(--accent-soft, #e2efee);
      color: var(--accent, #155e63);
    }

    .job__sector svg { width: 19px; height: 19px; }

    .job__company { display: flex; flex-direction: column; flex: 1; min-width: 0; }

    .job__company-name {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .job__company-sector { font-size: 12px; color: var(--muted, #66727e); }

    .job__title {
      margin-top: 12px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .job__meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 13px;
      color: var(--ink-soft, #3a4652);
    }

    .job__meta .ti { font-size: 15px; color: var(--muted, #66727e); }

    /* Score de correspondance */
    .score {
      position: relative;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      --score: var(--accent, #155e63);
    }

    .score--low { --score: var(--signal, #b7791f); }

    .score svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .score__track { stroke: var(--line, #dde2e5); stroke-width: 3; }
    .score__value { stroke: var(--score); stroke-width: 3; }
    .score__num { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }

    @media (max-width: 480px) {
      .job { padding: 12px; }
    }
  `],
})
export class JobCardPreviewComponent {
  job = input.required<JobCardData>();
  /** Diamètre de l'anneau de score, en pixels */
  size = input(42);

  icon = computed(() => sectorIcon(this.job().sector));
  label = computed(() => sectorLabel(this.job().sector));
  clampedScore = computed(() => Math.max(0, Math.min(100, Math.round(this.job().score))));
}