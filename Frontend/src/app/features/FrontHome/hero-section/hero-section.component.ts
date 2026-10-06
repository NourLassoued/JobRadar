import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTOR_ICONS, sectorLabel } from '../../../core/models/sector.utils';

interface HeroJob {
  title: string;
  company: string;
  meta: string;
  sector: string; // code de l'enum Java : TECH, HEALTH…
  score: number;  // 0 à 100
}

@Component({
  selector: 'jr-hero-section',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="hero__inner">

        <!-- ═══ Texte ═══ -->
        <div class="hero__copy">
          @if (newJobsToday(); as count) {
            <p class="pill">
              <span class="pill__dot" aria-hidden="true"></span>
              {{ count }} nouvelles offres aujourd'hui
            </p>
          }

          <h1 class="hero__title">
            Trouvez l'offre qui vous correspond <em>vraiment</em>, quel que soit votre métier.
          </h1>

          <p class="hero__text">
            JobRadar rassemble les offres de 15 secteurs, de la tech à la santé en passant par le BTP,
            et les classe selon leur correspondance avec votre profil.
          </p>

          <div class="hero__actions">
            <a routerLink="/auth/register" class="btn btn--primary">
              Commencer gratuitement <i class="ti ti-arrow-right" aria-hidden="true"></i>
            </a>
            <a routerLink="/auth/login" class="btn btn--secondary">J'ai déjà un compte</a>
          </div>

          <ul class="hero__trust">
            <li><i class="ti ti-circle-check" aria-hidden="true"></i>Gratuit pour les candidats</li>
            <li><i class="ti ti-circle-check" aria-hidden="true"></i>Offres issues de France Travail</li>
            <li><i class="ti ti-circle-check" aria-hidden="true"></i>Données jamais revendues</li>
          </ul>
        </div>

        <!-- ═══ Cartes d'offres ═══ -->
        <div class="hero__visual" aria-hidden="true">
          <span class="ring ring--1"></span>
          <span class="ring ring--2"></span>
          <span class="ring ring--3"></span>

          @for (job of jobs; track job.title; let i = $index) {
            <article [class]="'job job--' + (i + 1)">
              <div class="job__top">
                <span class="job__sector">
                  <svg viewBox="0 0 24 24"><path [attr.d]="icon(job.sector)" /></svg>
                </span>
                <span class="job__company">
                  <span class="job__company-name">{{ job.company }}</span>
                  <span class="job__company-sector">{{ label(job.sector) }}</span>
                </span>
                <span class="score" [class.score--mid]="job.score < 80" [class.score--low]="job.score < 70">
                  <svg viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" class="score__track" />
                    <circle cx="20" cy="20" r="16" class="score__value" pathLength="100"
                            [attr.stroke-dasharray]="job.score + ' 100'" transform="rotate(-90 20 20)" />
                  </svg>
                  <span class="score__num">{{ job.score }}</span>
                </span>
              </div>
              <p class="job__title">{{ job.title }}</p>
              <p class="job__meta"><i class="ti ti-map-pin"></i>{{ job.meta }}</p>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      --paper: #f3f5f4;
      --surface: #ffffff;
      --surface-sunk: #f7f8f8;
      --ink: #17202a;
      --ink-soft: #3a4652;
      --muted: #66727e;
      --line: #dde2e5;
      --line-strong: #c5ccd2;
      --accent: #155e63;
      --accent-hover: #0f4a4e;
      --accent-soft: #e2efee;
      --signal: #b7791f;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;

      display: block;
      font-family: var(--font);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --paper: #0f1519;
        --surface: #161e23;
        --surface-sunk: #12191d;
        --ink: #e6ebee;
        --ink-soft: #c3ccd2;
        --muted: #8d9aa4;
        --line: #253038;
        --line-strong: #34424c;
        --accent: #5fb3b3;
        --accent-hover: #7cc6c5;
        --accent-soft: #19302f;
        --signal: #e0a64a;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }
    p, h1, ul { margin: 0; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    /* ── Section ─────────────────────────────────────────── */
    .hero {
      padding: 72px 24px 80px;
      background-color: var(--paper);
      background-image: radial-gradient(color-mix(in srgb, var(--accent) 14%, transparent) 1px, transparent 1px);
      background-size: 22px 22px;
      border-bottom: 1px solid var(--line);
      overflow: hidden;
    }

    .hero__inner {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 56px;
      align-items: center;
      max-width: 1120px;
      margin: 0 auto;
    }

    /* ── Texte ───────────────────────────────────────────── */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      padding: 5px 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-soft);
      border-radius: 999px;
    }

    .pill__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent);
      animation: ping 2s ease-out infinite;
    }

    @keyframes ping {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
      70%, 100% { box-shadow: 0 0 0 7px transparent; }
    }

    .hero__title {
      font-size: clamp(32px, 4.4vw, 50px);
      font-weight: 700;
      line-height: 1.08;
      letter-spacing: -0.03em;
      text-wrap: balance;
    }

    .hero__title em {
      font-style: normal;
      color: var(--accent);
      background: linear-gradient(transparent 68%, color-mix(in srgb, var(--accent) 16%, transparent) 68%);
    }

    .hero__text {
      margin-top: 18px;
      max-width: 52ch;
      font-size: 17px;
      line-height: 1.6;
      color: var(--ink-soft);
    }

    .hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 28px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 48px;
      padding: 0 20px;
      font: inherit;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      border: 1px solid transparent;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .btn .ti { font-size: 17px; transition: transform 0.15s ease; }

    .btn--primary { background: var(--accent); color: #fff; }
    .btn--primary:hover { background: var(--accent-hover); }
    .btn--primary:hover .ti-arrow-right { transform: translateX(3px); }

    .btn--secondary { background: var(--surface); border-color: var(--line-strong); color: var(--ink); }
    .btn--secondary:hover { border-color: var(--accent); color: var(--accent); }

    .hero__trust {
      list-style: none;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin-top: 28px;
      font-size: 13px;
      color: var(--muted);
    }

    .hero__trust li { display: inline-flex; align-items: center; gap: 6px; }
    .hero__trust .ti { font-size: 16px; color: var(--accent); }

    /* ── Visuel : cartes sur fond de radar ───────────────── */
    .hero__visual {
      position: relative;
      height: 380px;
    }

    .ring {
      position: absolute;
      top: 50%;
      left: 50%;
      border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }

    .ring--1 { width: 420px; height: 420px; }
    .ring--2 { width: 290px; height: 290px; }
    .ring--3 { width: 160px; height: 160px; background: color-mix(in srgb, var(--accent) 6%, transparent); }

    .job {
      position: absolute;
      width: min(340px, 86%);
      padding: 16px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 18px 40px -20px rgba(13, 58, 62, 0.4);
      animation: rise 0.6s ease-out both;
    }

    .job--1 { top: 8px;    left: 0;    transform: rotate(-3deg); animation-delay: 0.05s; }
    .job--2 { top: 128px;  right: 0;   transform: rotate(2deg);  animation-delay: 0.2s; z-index: 2; }
    .job--3 { bottom: 4px; left: 8%;   transform: rotate(-1deg); animation-delay: 0.35s; }

    @keyframes rise {
      from { opacity: 0; translate: 0 16px; }
      to { opacity: 1; translate: 0 0; }
    }

    .job__top { display: flex; align-items: center; gap: 12px; }

    .job__sector {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      flex-shrink: 0;
      border-radius: 10px;
      background: var(--accent-soft);
      color: var(--accent);
    }

    .job__sector svg { width: 19px; height: 19px; }

    .job__company { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .job__company-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .job__company-sector { font-size: 12px; color: var(--muted); }

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
      color: var(--ink-soft);
    }

    .job__meta .ti { font-size: 15px; color: var(--muted); }

    /* Score de correspondance */
    .score {
      position: relative;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      flex-shrink: 0;
      --score: var(--accent);
    }

    .score--mid { --score: var(--accent); opacity: 0.85; }
    .score--low { --score: var(--signal); opacity: 1; }

    .score svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .score__track { stroke: var(--line); stroke-width: 3; }
    .score__value { stroke: var(--score); stroke-width: 3; }
    .score__num { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }

    /* ── Responsive ──────────────────────────────────────── */
    @media (max-width: 960px) {
      .hero { padding: 48px 20px 56px; }
      .hero__inner { grid-template-columns: 1fr; gap: 40px; }
      .hero__visual { height: 340px; max-width: 480px; width: 100%; margin: 0 auto; }
      .ring--1 { width: 340px; height: 340px; }
    }

    @media (max-width: 480px) {
      .hero__text { font-size: 16px; }
      .hero__actions .btn { flex: 1; }
      .hero__visual { height: 300px; }
      .job { padding: 12px; }
      .job--2 { top: 108px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .job, .pill__dot { animation: none; }
      .btn, .btn .ti { transition: none; }
    }
  `],
})
export class HeroSectionComponent {
  /** Nombre réel d'offres du jour (à passer depuis la page, sinon le badge est masqué) */
  newJobsToday = input<number | null>(null);

  readonly jobs: HeroJob[] = [
    { title: 'Infirmier(ère) diplômé(e) d\'État', company: 'CH Orléans', meta: 'Orléans, CDI', sector: 'HEALTH', score: 85 },
    { title: 'Développeur full-stack Java / Angular', company: 'CGI', meta: 'Orléans, hybride', sector: 'TECH', score: 93 },
    { title: 'Chef de partie', company: 'Le Lift', meta: 'Orléans, CDI', sector: 'HOSPITALITY', score: 64 },
  ];

  icon(code: string): string {
    return SECTOR_ICONS[code] || SECTOR_ICONS['OTHER'];
  }

  label(code: string): string {
    return sectorLabel(code);
  }
}