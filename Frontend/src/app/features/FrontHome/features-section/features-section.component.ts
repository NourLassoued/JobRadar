import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTOR_ICONS } from '../../../core/models/sector.utils';

@Component({
  selector: 'jr-features-section',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="features" id="fonctionnalites" aria-labelledby="features-title">
      <div class="features__inner">

        <header class="features__head">
          <p class="eyebrow">Fonctionnalités</p>
          <h2 class="features__title" id="features-title">
            Tout ce qu'il faut pour chercher mieux, pas plus.
          </h2>
        </header>

        <div class="bento">

          <!-- ═══ 1. Score (grande carte) ═══ -->
          <article class="card card--wide">
            <div class="card__text">
              <p class="card__label"><i class="ti ti-target-arrow" aria-hidden="true"></i>Score de correspondance</p>
              <h3 class="card__title">Les offres classées selon votre profil, pas selon la date.</h3>
              <p class="card__desc">
                Chaque offre reçoit une note de 0 à 100. Les critères changent selon le métier :
                les compétences techniques pour un développeur, les diplômes et horaires pour un infirmier.
              </p>
            </div>

            <div class="mock mock--list" aria-hidden="true">
              @for (row of scoreRows; track row.title) {
                <div class="row">
                  <span class="row__icon"><svg viewBox="0 0 24 24"><path [attr.d]="row.icon" /></svg></span>
                  <span class="row__text">
                    <span class="row__title">{{ row.title }}</span>
                    <span class="row__meta">{{ row.meta }}</span>
                  </span>
                  <span class="row__score" [class.is-low]="row.score < 70">
                    <span class="row__bar"><span [style.width.%]="row.score"></span></span>
                    <strong>{{ row.score }}</strong>
                  </span>
                </div>
              }
            </div>
          </article>

          <!-- ═══ 2. Lettres ═══ -->
          <article class="card">
            <div class="mock mock--letter" aria-hidden="true">
              <div class="letter">
                <span class="letter__line w-40"></span>
                <span class="letter__line w-90"></span>
                <span class="letter__line w-80"></span>
                <span class="letter__line w-60 is-typing"></span>
              </div>
              <span class="letter__btn"><i class="ti ti-sparkles"></i>Générer</span>
            </div>
            <div class="card__text">
              <p class="card__label"><i class="ti ti-mail" aria-hidden="true"></i>Lettres de motivation</p>
              <h3 class="card__title">Une première version en quelques secondes.</h3>
              <p class="card__desc">Rédigée à partir de l'offre et de votre profil, que vous relisez et ajustez.</p>
            </div>
          </article>

          <!-- ═══ 3. Analytics ═══ -->
          <article class="card">
            <div class="mock mock--chart" aria-hidden="true">
              <div class="chart">
                @for (bar of chartBars; track $index) {
                  <span class="chart__bar" [style.height.%]="bar"></span>
                }
              </div>
              <span class="chart__legend">Candidatures par semaine</span>
            </div>
            <div class="card__text">
              <p class="card__label"><i class="ti ti-chart-bar" aria-hidden="true"></i>Analytics</p>
              <h3 class="card__title">Voyez ce qui fonctionne.</h3>
              <p class="card__desc">Taux de réponse, secteurs les plus porteurs et rythme de vos envois.</p>
            </div>
          </article>

          <!-- ═══ 4. Filtres (carte large, bandeau) ═══ -->
          <article class="card card--band">
            <div class="card__text">
              <p class="card__label"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i>Recherche</p>
              <h3 class="card__title">Filtrez par secteur, contrat et télétravail.</h3>
            </div>
            <div class="chips" aria-hidden="true">
              <span class="chip is-on">CDI</span>
              <span class="chip is-on">Télétravail</span>
              <span class="chip">Orléans</span>
              <span class="chip">CDD</span>
              <span class="chip is-on">Informatique / Tech</span>
              <span class="chip">Moins de 7 jours</span>
            </div>
            <a routerLink="/auth/register" class="card__link">
              Essayer <i class="ti ti-arrow-right" aria-hidden="true"></i>
            </a>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      --paper: #f3f5f4; --surface: #ffffff; --surface-sunk: #f7f8f8;
      --ink: #17202a; --ink-soft: #3a4652; --muted: #66727e;
      --line: #dde2e5; --line-strong: #c5ccd2;
      --accent: #155e63; --accent-soft: #e2efee; --signal: #b7791f;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
      display: block;
      font-family: var(--font);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --paper: #0f1519; --surface: #161e23; --surface-sunk: #12191d;
        --ink: #e6ebee; --ink-soft: #c3ccd2; --muted: #8d9aa4;
        --line: #253038; --line-strong: #34424c;
        --accent: #5fb3b3; --accent-soft: #19302f; --signal: #e0a64a;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }
    p, h2, h3 { margin: 0; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    .features { padding: 80px 24px; background: var(--surface); border-bottom: 1px solid var(--line); }
    .features__inner { max-width: 1120px; margin: 0 auto; }
    .features__head { max-width: 620px; margin-bottom: 40px; }

    .eyebrow {
      font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--accent);
    }

    .features__title {
      margin-top: 8px;
      font-size: clamp(26px, 3.2vw, 36px);
      font-weight: 700; line-height: 1.15; letter-spacing: -0.025em;
      text-wrap: balance;
    }

    /* ── Grille bento ───────────────────────────────────── */
    .bento {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .card {
      display: flex;
      flex-direction: column;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
    }

    .card--wide {
      grid-column: span 2;
      grid-row: span 2;
    }

    .card--band {
      grid-column: 1 / -1;
      flex-direction: row;
      align-items: center;
      gap: 24px;
      padding-right: 24px;
    }

    .card__text { padding: 24px; }
    .card--band .card__text { flex-shrink: 0; max-width: 340px; }

    .card__label {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--accent);
    }

    .card__label .ti { font-size: 16px; }

    .card__title {
      margin-top: 8px;
      font-size: 19px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em;
    }

    .card--wide .card__title { font-size: 24px; letter-spacing: -0.02em; }

    .card__desc { margin-top: 8px; font-size: 14px; line-height: 1.6; color: var(--ink-soft); max-width: 56ch; }

    .card__link {
      display: inline-flex; align-items: center; gap: 6px;
      margin-left: auto; flex-shrink: 0;
      font-size: 14px; font-weight: 600; color: var(--accent); text-decoration: none;
      border-radius: 6px;
    }

    .card__link .ti { transition: transform 0.15s ease; }
    .card__link:hover .ti { transform: translateX(3px); }

    /* ── Aperçus (communs) ──────────────────────────────── */
    .mock {
      background-color: var(--accent-soft);
      background-image: radial-gradient(color-mix(in srgb, var(--accent) 16%, transparent) 1px, transparent 1px);
      background-size: 18px 18px;
    }

    /* 1. Liste scorée */
    .mock--list {
      flex: 1;
      display: flex; flex-direction: column; justify-content: center; gap: 8px;
      margin: 0 24px 24px;
      padding: 20px;
      border-radius: 12px;
    }

    .row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 10px;
    }

    .row:first-child { border-color: var(--accent); box-shadow: 0 8px 20px -14px rgba(13, 58, 62, 0.5); }

    .row__icon {
      display: grid; place-items: center;
      width: 34px; height: 34px; flex-shrink: 0;
      border-radius: 9px; background: var(--accent-soft); color: var(--accent);
    }

    .row__icon svg { width: 17px; height: 17px; }

    .row__text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .row__title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row__meta { font-size: 12px; color: var(--muted); }

    .row__score { display: flex; align-items: center; gap: 10px; flex-shrink: 0; --c: var(--accent); }
    .row__score.is-low { --c: var(--signal); }
    .row__score strong { width: 24px; text-align: right; font-size: 14px; font-variant-numeric: tabular-nums; color: var(--c); }

    .row__bar { width: 72px; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
    .row__bar span { display: block; height: 100%; border-radius: 3px; background: var(--c); }

    /* 2. Lettre */
    .mock--letter {
      position: relative;
      height: 150px;
      display: grid; place-items: center;
      border-bottom: 1px solid var(--line);
    }

    .letter {
      display: flex; flex-direction: column; gap: 7px;
      width: 62%; padding: 16px;
      background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    }

    .letter__line { display: block; height: 5px; border-radius: 3px; background: var(--line-strong); }
    .letter__line.w-40 { width: 40%; background: var(--ink-soft); opacity: 0.5; }
    .w-60 { width: 60%; } .w-80 { width: 80%; } .w-90 { width: 90%; }

    .letter__line.is-typing {
      background: linear-gradient(90deg, var(--accent) 0 70%, var(--line-strong) 70%);
      background-size: 200% 100%;
      animation: typing 2.4s ease-in-out infinite;
    }

    @keyframes typing {
      from { background-position: 100% 0; }
      to { background-position: 0 0; }
    }

    .letter__btn {
      position: absolute; right: 14%; bottom: 18px;
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 10px;
      font-size: 12px; font-weight: 600;
      background: var(--accent); color: #fff; border-radius: 6px;
      box-shadow: 0 6px 14px -8px rgba(13, 58, 62, 0.6);
    }

    /* 3. Graphique */
    .mock--chart {
      height: 150px;
      display: flex; flex-direction: column; justify-content: flex-end; gap: 8px;
      padding: 20px 24px 14px;
      border-bottom: 1px solid var(--line);
    }

    .chart { display: flex; align-items: flex-end; gap: 8px; height: 90px; }

    .chart__bar {
      flex: 1;
      border-radius: 4px 4px 0 0;
      background: color-mix(in srgb, var(--accent) 35%, transparent);
    }

    .chart__bar:last-child { background: var(--accent); }

    .chart__legend { font-size: 11px; font-weight: 600; color: var(--muted); }

    /* 4. Filtres */
    .chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 24px 0; }

    .chip {
      padding: 6px 12px;
      font-size: 13px; font-weight: 500;
      background: var(--surface); color: var(--ink-soft);
      border: 1px solid var(--line-strong); border-radius: 999px;
    }

    .chip.is-on { background: var(--accent); border-color: var(--accent); color: #fff; }

    @media (prefers-color-scheme: dark) {
      .letter__btn, .chip.is-on { color: #0f1519; }
    }

    /* ── Responsive ─────────────────────────────────────── */
    @media (max-width: 960px) {
      .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .card--wide { grid-column: 1 / -1; grid-row: auto; }
      .card--band { flex-direction: column; align-items: stretch; padding: 0 24px 24px; gap: 0; }
      .card--band .card__text { padding: 24px 0 0; max-width: none; }
      .card__link { margin-left: 0; }
    }

    @media (max-width: 640px) {
      .features { padding: 56px 20px; }
      .bento { grid-template-columns: 1fr; }
      .mock--list { margin: 0 16px 16px; padding: 12px; }
      .row__bar { width: 44px; }
      .card--wide .card__title { font-size: 20px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .letter__line.is-typing { animation: none; background-position: 0 0; }
      .card__link .ti { transition: none; }
    }
  `],
})
export class FeaturesSectionComponent {
  readonly scoreRows = [
    { title: 'Développeur full-stack Java / Angular', meta: 'CGI, Orléans', score: 93, icon: SECTOR_ICONS['TECH'] },
    { title: 'Ingénieur DevOps', meta: 'Capgemini, Tours', score: 81, icon: SECTOR_ICONS['TECH'] },
    { title: 'Développeur Java junior', meta: 'Sopra Steria, Paris', score: 74, icon: SECTOR_ICONS['TECH'] },
    { title: 'Technicien support', meta: 'Orange, Orléans', score: 52, icon: SECTOR_ICONS['MAINTENANCE'] },
  ];

  readonly chartBars = [30, 45, 38, 62, 55, 80, 92];
}