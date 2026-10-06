import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef,
  inject, input, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTOR_LABELS } from '../../../core/models/candidate';
import { SECTOR_ICONS, sectorIcon, sectorLabel } from '../../../core/models/sector.utils';

/** Un vrai témoignage, publié avec l'accord écrit de la personne */
export interface Testimonial {
  quote: string;
  name: string;   // ex. « Sarah M. »
  role: string;   // ex. « Infirmière, Orléans »
}

/** Une vraie histoire d'utilisateur, publiée avec son accord */
export interface SuccessStory {
  title: string;
  date: string;   // ex. « Mars 2027 »
  description: string;
  tags: string[];
}

/** Une offre récente, pour le bandeau défilant */
export interface LatestOffer {
  title: string;
  city: string;
  sector: string;      // code de l'enum : TECH, HEALTH…
  createdAt: string;   // ISO
}

interface Stat {
  key: string;
  value: number | null; // null = donnée indisponible → carte masquée
  label: string;
  note: string;
  icon: string;
  suffix?: string;
  visual?: 'sectors' | 'score';
}

@Component({
  selector: 'jr-animated-stats-section',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stats" aria-labelledby="stats-title">
      <div class="stats__inner">

        <!-- ═══ En-tête ═══ -->
        <header class="head reveal">
          <div class="head__top">
            <p class="eyebrow">JobRadar en chiffres</p>
            @if (freshness(); as f) {
              <p class="live">
                <span class="live__dot" aria-hidden="true"></span>
                <time [attr.datetime]="lastUpdate()">Mis à jour {{ f }}</time>
              </p>
            }
          </div>
          <h2 class="head__title" id="stats-title">Des offres réelles, mises à jour chaque jour.</h2>
          <p class="head__sub">Toutes les annonces viennent de France Travail et sont classées selon votre profil.</p>
        </header>

        <!-- ═══ Chiffres ═══ -->
        <dl class="grid">
          @for (s of visibleStats(); track s.key; let i = $index) {
            <div class="stat reveal" [style.animation-delay.ms]="120 + i * 90">
              <span class="stat__icon" aria-hidden="true"><i [class]="'ti ' + s.icon"></i></span>
              <dd class="stat__value">{{ format(displayed()[s.key] ?? 0) }}{{ s.suffix ?? '' }}</dd>
              <dt class="stat__label">{{ s.label }}</dt>
              <dd class="stat__note">{{ s.note }}</dd>

              @if (s.visual === 'sectors') {
                <!-- Mosaïque : les 14 secteurs s'allument un par un -->
                <div class="mosaic" aria-hidden="true">
                  @for (sec of sectorTiles; track sec.code; let j = $index) {
                    <span class="mosaic__tile" [attr.title]="sec.label" [style.animation-delay.ms]="300 + j * 70">
                      <svg viewBox="0 0 24 24"><path [attr.d]="sec.icon" /></svg>
                    </span>
                  }
                </div>
              } @else if (s.visual === 'score') {
                <!-- Le score change selon le métier (pondérations du README) -->
                <div class="scorer" (mouseenter)="pauseRotation(true)" (mouseleave)="pauseRotation(false)"
                     (focusin)="pauseRotation(true)" (focusout)="pauseRotation(false)">

                  <div class="scorer__tabs" role="tablist" aria-label="Exemples de pondération par métier">
                    @for (p of profiles; track p.code; let k = $index) {
                      <button type="button" role="tab" class="scorer__tab"
                              [class.is-active]="k === activeProfile()"
                              [attr.aria-selected]="k === activeProfile()"
                              (click)="selectProfile(k)">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="p.icon" /></svg>
                        {{ p.short }}
                      </button>
                    }
                  </div>

                  <div class="scorer__body">
                    <!-- Jauge -->
                    <div class="gauge" aria-hidden="true">
                      <svg class="gauge__svg" viewBox="0 0 120 66">
                        <path class="gauge__track" d="M10 60 A50 50 0 0 1 110 60" pathLength="100" />
                        <path class="gauge__value" d="M10 60 A50 50 0 0 1 110 60" pathLength="100"
                              [style.stroke-dasharray]="(started() ? current().score : 0) + ' 100'" />
                      </svg>
                      <div class="gauge__center">
                        <span class="gauge__num">{{ gaugeNum() }}</span>
                        <span class="gauge__max">/100</span>
                      </div>
                    </div>

                    <!-- Pondérations -->
                    <ul class="weights" aria-live="polite">
                      @for (w of current().weights; track w.label) {
                        <li class="weights__row">
                          <span class="weights__label">{{ w.label }}</span>
                          <span class="weights__track" aria-hidden="true">
                            <span class="weights__fill" [style.width.%]="started() ? w.value * 2 : 0"></span>
                          </span>
                          <span class="weights__value">{{ w.value }} %</span>
                        </li>
                      }
                    </ul>
                  </div>

                  <p class="gauge__caption">
                    <span class="gauge__chip">Exemple</span>
                    <span class="scorer__job">{{ current().job }}</span>
                  </p>

                  <!-- Progression vers le métier suivant -->
                  <span class="scorer__timer" aria-hidden="true">
                    @for (k of [activeProfile()]; track k) {
                      <span [class.is-running]="rotating()"></span>
                    }
                  </span>
                </div>
              } @else {
                <span class="stat__bar" aria-hidden="true">
                  <span [style.animation-delay.ms]="100 + i * 90"></span>
                </span>
              }
            </div>
          }
        </dl>

        <!-- ═══ Dernières offres (bandeau défilant) ═══ -->
        @if (latestOffers().length) {
          <div class="ticker reveal" style="animation-delay: 420ms" aria-label="Dernières offres publiées" role="region">
            <span class="ticker__badge"><span class="live__dot" aria-hidden="true"></span>En direct</span>
            <div class="ticker__viewport">
              <ul class="ticker__track">
                @for (o of latestOffers(); track $index) {
                  <li class="ticker__item">
                    <span class="ticker__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path [attr.d]="icon(o.sector)" /></svg>
                    </span>
                    <span class="ticker__title">{{ o.title }}</span>
                    <span class="ticker__meta">{{ o.city }}, {{ ago(o.createdAt) }}</span>
                  </li>
                }
                <!-- Copie pour une boucle sans saut, ignorée par les lecteurs d'écran -->
                @for (o of latestOffers(); track $index) {
                  <li class="ticker__item" aria-hidden="true">
                    <span class="ticker__icon">
                      <svg viewBox="0 0 24 24"><path [attr.d]="icon(o.sector)" /></svg>
                    </span>
                    <span class="ticker__title">{{ o.title }}</span>
                    <span class="ticker__meta">{{ o.city }}, {{ ago(o.createdAt) }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
        }

        <!-- ═══ Répartition par secteur ═══ -->
        @if (sectorRows().length) {
          <div class="block">
            <div class="block__head reveal">
              <h3 class="block__title">Où sont les offres en ce moment</h3>
              <p class="block__sub">Les secteurs qui recrutent le plus parmi les offres disponibles.</p>
            </div>
            <ul class="bars">
              @for (row of sectorRows(); track row.code; let i = $index) {
                <li class="bars__row reveal" [style.animation-delay.ms]="i * 70">
                  <a class="bars__link" routerLink="/app/offres" [queryParams]="{ secteur: row.code }">
                    <span class="bars__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path [attr.d]="row.icon" /></svg>
                    </span>
                    <span class="bars__label">{{ row.label }}</span>
                    <span class="bars__track" aria-hidden="true">
                      <span class="bars__fill" [style.width.%]="row.percent" [style.animation-delay.ms]="200 + i * 70"></span>
                    </span>
                    <span class="bars__count">{{ format(row.count) }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }

        <!-- ═══ Témoignages (uniquement s'il y en a de vrais) ═══ -->
        @if (testimonials().length) {
          <div class="block" role="region" aria-label="Témoignages des utilisateurs">
            <h3 class="block__title reveal">Ce que disent les candidats</h3>
            <div class="quotes">
              @for (t of testimonials(); track t.name; let i = $index) {
                <figure class="quote reveal" [style.animation-delay.ms]="i * 100">
                  <i class="ti ti-quote quote__mark" aria-hidden="true"></i>
                  <blockquote class="quote__text">{{ t.quote }}</blockquote>
                  <figcaption class="quote__author">
                    <span class="quote__avatar" aria-hidden="true">{{ initials(t.name) }}</span>
                    <span>
                      <span class="quote__name">{{ t.name }}</span>
                      <span class="quote__role">{{ t.role }}</span>
                    </span>
                  </figcaption>
                </figure>
              }
            </div>
          </div>
        }

        <!-- ═══ Histoires de succès (uniquement s'il y en a de vraies) ═══ -->
        @if (stories().length) {
          <div class="block" role="region" aria-label="Histoires de succès">
            <h3 class="block__title reveal">Ils ont trouvé leur poste</h3>
            <ol class="timeline">
              @for (story of stories(); track story.title; let i = $index; let last = $last) {
                <li class="timeline__item reveal" [class.is-last]="last" [style.animation-delay.ms]="i * 120">
                  <span class="timeline__dot" aria-hidden="true"></span>
                  <article class="timeline__card">
                    <time class="timeline__date" [attr.datetime]="formatDate(story.date)">{{ story.date }}</time>
                    <h4 class="timeline__title">{{ story.title }}</h4>
                    <p class="timeline__desc">{{ story.description }}</p>
                    <ul class="tags">
                      @for (tag of story.tags; track tag) { <li class="tag">{{ tag }}</li> }
                    </ul>
                  </article>
                </li>
              }
            </ol>
          </div>
        }

        <!-- ═══ Appel à l'action ═══ -->
        <div class="cta reveal">
          <a routerLink="/auth/register" class="btn btn--primary">
            Commencer gratuitement <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </a>
          <ul class="perks">
            <li><i class="ti ti-circle-check" aria-hidden="true"></i>Gratuit pour les candidats</li>
            <li><i class="ti ti-circle-check" aria-hidden="true"></i>Sans carte bancaire</li>
            <li><i class="ti ti-circle-check" aria-hidden="true"></i>Données jamais revendues</li>
          </ul>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      --paper: #f3f5f4; --surface: #ffffff; --surface-sunk: #f7f8f8;
      --ink: #17202a; --ink-soft: #3a4652; --muted: #66727e;
      --line: #dde2e5; --line-strong: #c5ccd2;
      --accent: #155e63; --accent-hover: #0f4a4e; --accent-soft: #e2efee;
      --live: #1d7a4d;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
      --duration-short: 0.15s; --duration-medium: 0.55s;
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
        --accent: #5fb3b3; --accent-hover: #7cc6c5; --accent-soft: #19302f;
        --live: #5cc38d;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }
    p, h2, h3, h4, dl, dd, ol, ul, figure, blockquote { margin: 0; }
    ol, ul { list-style: none; padding: 0; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    .stats { padding: 80px 24px; background: var(--paper); border-bottom: 1px solid var(--line); }
    .stats__inner { max-width: 1120px; margin: 0 auto; }

    /* Apparition au défilement */
    .reveal { opacity: 0; transform: translateY(14px); }
    :host(.is-visible) .reveal { animation: rise var(--duration-medium) ease-out forwards; }
    @keyframes rise { to { opacity: 1; transform: translateY(0); } }

    /* ── En-tête ────────────────────────────────────────── */
    .head { max-width: 640px; margin-bottom: 36px; }
    .head__top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }

    .eyebrow {
      font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--accent);
    }

    .live {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 3px 10px;
      font-size: 12px; font-weight: 600; color: var(--live);
      background: color-mix(in srgb, var(--live) 10%, transparent);
      border-radius: 999px;
    }

    .live__dot {
      width: 7px; height: 7px; flex-shrink: 0;
      border-radius: 50%; background: var(--live);
      animation: ping 2s ease-out infinite;
    }

    @keyframes ping {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--live) 55%, transparent); }
      70%, 100% { box-shadow: 0 0 0 7px transparent; }
    }

    .head__title {
      margin-top: 10px;
      font-size: clamp(26px, 3.2vw, 36px);
      font-weight: 700; line-height: 1.15; letter-spacing: -0.025em;
      text-wrap: balance;
    }

    .head__sub { margin-top: 10px; font-size: 16px; line-height: 1.6; color: var(--ink-soft); }

    /* ── Chiffres ───────────────────────────────────────── */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }

    .stat {
      position: relative;
      display: flex; flex-direction: column;
      padding: 24px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      transition: border-color var(--duration-short) ease, box-shadow var(--duration-short) ease, translate var(--duration-short) ease;
    }

    .stat:hover { border-color: var(--accent); box-shadow: 0 14px 30px -20px rgba(13, 58, 62, 0.5); translate: 0 -3px; }

    .stat__icon {
      display: grid; place-items: center;
      width: 40px; height: 40px; margin-bottom: 20px;
      border-radius: 11px;
      background: var(--accent-soft); color: var(--accent);
      font-size: 20px;
      transition: background-color var(--duration-short) ease, color var(--duration-short) ease;
    }

    .stat:hover .stat__icon { background: var(--accent); color: var(--surface); }

    .stat__value {
      font-size: clamp(32px, 3.6vw, 44px);
      font-weight: 700; line-height: 1; letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }

    .stat__label { margin-top: 8px; font-size: 14px; font-weight: 600; }
    .stat__note { margin-top: 4px; font-size: 13px; line-height: 1.5; color: var(--muted); }

    .stat__bar { margin-top: 20px; height: 3px; border-radius: 2px; background: var(--line); overflow: hidden; }
    .stat__bar span { display: block; height: 100%; background: var(--accent); transform: scaleX(0); transform-origin: left; }
    :host(.is-visible) .stat__bar span { animation: fill 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    @keyframes fill { to { transform: scaleX(1); } }

    /* ── Mosaïque des secteurs ──────────────────────────── */
    .mosaic {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
      margin-top: 22px;
    }

    .mosaic__tile {
      display: grid; place-items: center;
      aspect-ratio: 1;
      border-radius: 9px;
      background: var(--surface-sunk);
      border: 1px solid var(--line);
      color: var(--line-strong);
    }

    .mosaic__tile svg { width: 55%; height: 55%; max-width: 20px; max-height: 20px; }

    :host(.is-visible) .mosaic__tile { animation: tile-on 0.4s ease-out forwards; }

    @keyframes tile-on {
      to { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent); }
    }

    .stat:hover .mosaic__tile { transition: transform var(--duration-short) ease; }
    .mosaic__tile:hover { transform: translateY(-2px); }

    /* ── Démonstration du score par métier ─────────────── */
    .scorer { position: relative; margin-top: 18px; }

    .scorer__tabs {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 3px;
      background: var(--surface-sunk);
      border: 1px solid var(--line);
      border-radius: 10px;
      width: fit-content;
    }

    .scorer__tab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px;
      font: inherit; font-size: 12px; font-weight: 600;
      color: var(--ink-soft);
      background: transparent;
      border: 0; border-radius: 7px;
      cursor: pointer;
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    .scorer__tab svg { width: 14px; height: 14px; }
    .scorer__tab:hover { color: var(--ink); }
    .scorer__tab.is-active { background: var(--accent); color: #fff; }

    .scorer__body {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 20px;
      align-items: center;
      margin-top: 16px;
    }

    /* Jauge */
    .gauge { position: relative; }
    .gauge__svg { display: block; width: 100%; height: auto; overflow: visible; }
    .gauge__track, .gauge__value { fill: none; stroke-width: 10; stroke-linecap: round; }
    .gauge__track { stroke: var(--surface-sunk); }

    .gauge__value {
      stroke: var(--accent);
      transition: stroke-dasharray 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .gauge__center {
      position: absolute; left: 0; right: 0; top: 44%;
      display: flex; align-items: baseline; justify-content: center; gap: 2px;
    }

    .gauge__num { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .gauge__max { font-size: 12px; color: var(--muted); }

    /* Pondérations */
    .weights { display: flex; flex-direction: column; gap: 9px; }

    .weights__row {
      display: grid;
      grid-template-columns: 84px minmax(0, 1fr) 36px;
      align-items: center;
      gap: 10px;
    }

    .weights__label { font-size: 12px; color: var(--ink-soft); }
    .weights__track { height: 6px; border-radius: 3px; background: var(--surface-sunk); overflow: hidden; }

    .weights__fill {
      display: block; height: 100%;
      border-radius: 3px;
      background: var(--accent);
      transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .weights__row:nth-child(2) .weights__fill { transition-delay: 0.05s; }
    .weights__row:nth-child(3) .weights__fill { transition-delay: 0.1s; }
    .weights__row:nth-child(4) .weights__fill { transition-delay: 0.15s; }

    .weights__value {
      font-size: 12px; font-weight: 700; text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .gauge__caption {
      display: flex; align-items: center; gap: 8px;
      margin-top: 16px;
      font-size: 12px; color: var(--ink-soft);
    }

    .scorer__job { animation: job-in 0.4s ease-out; }
    @keyframes job-in { from { opacity: 0; transform: translateY(4px); } }

    .gauge__chip {
      flex-shrink: 0;
      padding: 1px 7px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
      border-radius: 999px;
      background: var(--accent-soft); color: var(--accent);
    }

    /* Barre de progression vers le métier suivant */
    .scorer__timer { display: block; margin-top: 14px; height: 2px; border-radius: 1px; background: var(--line); overflow: hidden; }
    .scorer__timer span { display: block; height: 100%; background: var(--accent); transform: scaleX(0); transform-origin: left; }
    .scorer__timer span.is-running { animation: timer 3.5s linear forwards; }
    .scorer:hover .scorer__timer span { animation-play-state: paused; }
    @keyframes timer { to { transform: scaleX(1); } }

    @media (prefers-color-scheme: dark) {
      .scorer__tab.is-active { color: #0f1519; }
    }

    @media (max-width: 520px) {
      .scorer__body { grid-template-columns: 1fr; }
      .gauge { max-width: 180px; }
    }

    /* Deux cartes seulement : disposition côte à côte plus équilibrée */
    .grid:has(> .stat:nth-child(2):last-child) .stat { padding: 28px; }

    /* ── Bandeau des dernières offres ───────────────────── */
    .ticker {
      display: flex;
      align-items: center;
      margin-top: 16px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
    }

    .ticker__badge {
      display: inline-flex; align-items: center; gap: 7px;
      flex-shrink: 0;
      align-self: stretch;
      padding: 0 16px;
      font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--live);
      background: color-mix(in srgb, var(--live) 8%, var(--surface));
      border-right: 1px solid var(--line);
    }

    .ticker__viewport {
      flex: 1;
      overflow: hidden;
      mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
    }

    .ticker__track {
      display: flex;
      gap: 10px;
      width: max-content;
      padding: 12px 10px;
      animation: marquee 40s linear infinite;
    }

    .ticker:hover .ticker__track,
    .ticker:focus-within .ticker__track { animation-play-state: paused; }

    @keyframes marquee { to { transform: translateX(-50%); } }

    .ticker__item {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 6px 14px 6px 6px;
      white-space: nowrap;
      background: var(--surface-sunk);
      border: 1px solid var(--line);
      border-radius: 999px;
    }

    .ticker__icon {
      display: grid; place-items: center;
      width: 28px; height: 28px; flex-shrink: 0;
      border-radius: 50%;
      background: var(--accent-soft); color: var(--accent);
    }

    .ticker__icon svg { width: 15px; height: 15px; }
    .ticker__title { font-size: 13px; font-weight: 600; }
    .ticker__meta { font-size: 12px; color: var(--muted); }

    /* ── Répartition par secteur ────────────────────────── */
    .block { margin-top: 56px; }
    .block__head { margin-bottom: 20px; }
    .block__title { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; }
    .block__sub { margin-top: 4px; font-size: 14px; color: var(--muted); }

    .bars {
      display: flex; flex-direction: column; gap: 4px;
      padding: 10px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
    }

    .bars__link {
      display: grid;
      grid-template-columns: 34px minmax(140px, 220px) minmax(0, 1fr) 64px;
      align-items: center;
      gap: 14px;
      padding: 10px 12px;
      border-radius: 10px;
      color: var(--ink);
      text-decoration: none;
      transition: background-color var(--duration-short) ease;
    }

    .bars__link:hover { background: var(--surface-sunk); }
    .bars__link:hover .bars__fill { background: var(--accent-hover); }

    .bars__icon {
      display: grid; place-items: center;
      width: 34px; height: 34px;
      border-radius: 9px;
      background: var(--accent-soft); color: var(--accent);
    }

    .bars__icon svg { width: 17px; height: 17px; }
    .bars__label { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .bars__track { height: 10px; border-radius: 5px; background: var(--surface-sunk); overflow: hidden; }

    .bars__fill {
      display: block; height: 100%;
      border-radius: 5px;
      background: var(--accent);
      transform: scaleX(0); transform-origin: left;
      transition: background-color var(--duration-short) ease;
    }

    :host(.is-visible) .bars__fill { animation: fill 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

    .bars__count {
      font-size: 14px; font-weight: 700; text-align: right;
      font-variant-numeric: tabular-nums; color: var(--ink-soft);
    }

    /* ── Témoignages ────────────────────────────────────── */
    .quotes { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 20px; }

    .quote {
      display: flex; flex-direction: column; gap: 16px;
      padding: 24px;
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    }

    .quote__mark { font-size: 26px; color: var(--accent); opacity: 0.5; }
    .quote__text { font-size: 15px; line-height: 1.6; color: var(--ink-soft); }
    .quote__author { display: flex; align-items: center; gap: 12px; margin-top: auto; }

    .quote__avatar {
      display: grid; place-items: center;
      width: 38px; height: 38px; flex-shrink: 0;
      border-radius: 10px; background: var(--accent-soft); color: var(--accent);
      font-size: 13px; font-weight: 700;
    }

    .quote__name { display: block; font-size: 14px; font-weight: 700; }
    .quote__role { display: block; font-size: 13px; color: var(--muted); }

    /* ── Histoires ──────────────────────────────────────── */
    .timeline { display: flex; flex-direction: column; gap: 16px; margin-top: 20px; }
    .timeline__item { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 16px; }

    .timeline__item::before {
      content: ''; position: absolute;
      left: 9px; top: 24px; bottom: -16px;
      border-left: 1.5px dashed var(--line-strong);
    }

    .timeline__item.is-last::before { display: none; }

    .timeline__dot {
      width: 20px; height: 20px; margin-top: 20px;
      border-radius: 50%; background: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }

    .timeline__card { padding: 20px 22px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
    .timeline__date { font-size: 12px; font-weight: 600; color: var(--accent); }
    .timeline__title { margin-top: 4px; font-size: 17px; font-weight: 700; }
    .timeline__desc { margin-top: 6px; font-size: 14px; line-height: 1.6; color: var(--ink-soft); }

    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .tag { padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }

    /* ── CTA ────────────────────────────────────────────── */
    .cta {
      display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px;
      margin-top: 40px; padding-top: 32px;
      border-top: 1px solid var(--line);
    }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      height: 48px; padding: 0 22px;
      font: inherit; font-size: 15px; font-weight: 600;
      text-decoration: none; border-radius: 8px;
      transition: background-color var(--duration-short) ease;
    }

    .btn .ti { font-size: 17px; transition: transform var(--duration-short) ease; }
    .btn--primary { background: var(--accent); color: #fff; }
    .btn--primary:hover { background: var(--accent-hover); }
    .btn--primary:hover .ti { transform: translateX(3px); }
    .btn--primary:active { transform: scale(0.98); }

    .perks { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; color: var(--ink-soft); }
    .perks li { display: inline-flex; align-items: center; gap: 6px; }
    .perks .ti { font-size: 17px; color: var(--accent); }

    @media (prefers-color-scheme: dark) {
      .btn--primary { color: #0f1519; }
    }

    /* ── Responsive ─────────────────────────────────────── */
    @media (max-width: 720px) {
      .bars__link { grid-template-columns: 34px minmax(0, 1fr) 56px; row-gap: 8px; }
      .bars__track { grid-column: 2 / 4; grid-row: 2; }
      .ticker__badge { padding: 0 12px; font-size: 11px; }
    }

    @media (max-width: 520px) {
      .stats { padding: 56px 20px; }
      .grid { grid-template-columns: 1fr; }
      .cta .btn { width: 100%; }
      .ticker__badge { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      :host { --duration-short: 0s; --duration-medium: 0s; }
      .reveal, :host(.is-visible) .reveal { opacity: 1; transform: none; animation: none; }
      .stat__bar span, .bars__fill, :host(.is-visible) .stat__bar span, :host(.is-visible) .bars__fill { transform: scaleX(1); animation: none; }
      .live__dot { animation: none; }
      .mosaic__tile, :host(.is-visible) .mosaic__tile { animation: none; background: var(--accent-soft); color: var(--accent); }
      .gauge__value, .weights__fill { transition: none; }
      .scorer__job { animation: none; }
      .scorer__timer { display: none; }
      /* Pas de défilement : la liste devient horizontale et scrollable */
      .ticker__track { animation: none; }
      .ticker__viewport { overflow-x: auto; mask-image: none; }
      .ticker__item[aria-hidden='true'] { display: none; }
    }

    @media (forced-colors: active) {
      .stat, .bars, .ticker { border: 2px solid; }
      .bars__fill, .stat__bar span { background: Highlight; }
    }
  `],
})
export class AnimatedStatsSectionComponent {
  private host = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  // ── Données réelles fournies par la page (vide / null = bloc masqué) ──
  totalOffers = input<number | null>(null);
  newToday = input<number | null>(null);
  /** Date ISO du dernier import France Travail */
  lastUpdate = input<string | null>(null);
  /** Nombre d'offres par code secteur, ex. { TECH: 3200, HEALTH: 2100 } */
  bySector = input<Record<string, number> | null>(null);
  /** Quelques offres récentes pour le bandeau (6 à 12 idéalement) */
  latestOffers = input<LatestOffer[]>([]);
  /** Vrais témoignages uniquement */
  testimonials = input<Testimonial[]>([]);
  /** Vraies histoires uniquement */
  stories = input<SuccessStory[]>([]);

  private readonly sectorCount = Object.keys(SECTOR_LABELS).filter(k => k !== 'OTHER').length;

  stats = computed<Stat[]>(() => [
    { key: 'offers', value: this.totalOffers(), icon: 'ti-briefcase',
      label: 'Offres disponibles', note: 'Issues de France Travail, dans toute la France' },
    { key: 'today', value: this.newToday(), icon: 'ti-clock-plus',
      label: "Nouvelles aujourd'hui", note: 'Ajoutées automatiquement chaque jour' },
    { key: 'sectors', value: this.sectorCount, icon: 'ti-category', visual: 'sectors',
      label: 'Familles de métiers', note: 'De la tech à la santé, en passant par le BTP' },
    { key: 'criteria', value: 4, icon: 'ti-target-arrow', suffix: ' critères', visual: 'score',
      label: 'Score de correspondance', note: 'Compétences, diplômes, expérience et savoir-être, pondérés selon le métier' },
  ]);

  visibleStats = computed(() => this.stats().filter(s => s.value !== null));

  /** Tuiles de la mosaïque des secteurs */
  readonly sectorTiles = Object.keys(SECTOR_LABELS)
    .filter(code => code !== 'OTHER')
    .map(code => ({ code, label: sectorLabel(code), icon: SECTOR_ICONS[code] }));

  /**
   * Pondérations par métier (tableau « scoring adaptatif » du README).
   * Le score et l'intitulé sont des exemples, signalés comme tels à l'écran.
   */
  readonly profiles = [
    { code: 'TECH', short: 'Tech', job: 'Développeur Java / Angular, Orléans', score: 87,
      weights: [{ label: 'Compétences', value: 40 }, { label: 'Diplômes', value: 10 }, { label: 'Expérience', value: 20 }, { label: 'Savoir-être', value: 5 }] },
    { code: 'HEALTH', short: 'Santé', job: 'Infirmier(ère) diplômé(e) d\'État, Tours', score: 82,
      weights: [{ label: 'Compétences', value: 15 }, { label: 'Diplômes', value: 40 }, { label: 'Expérience', value: 25 }, { label: 'Savoir-être', value: 5 }] },
    { code: 'COMMERCE', short: 'Commerce', job: 'Conseiller(ère) de vente, Paris', score: 74,
      weights: [{ label: 'Compétences', value: 20 }, { label: 'Diplômes', value: 15 }, { label: 'Expérience', value: 25 }, { label: 'Savoir-être', value: 30 }] },
    { code: 'BTP', short: 'BTP', job: 'Chef de chantier, Lyon', score: 69,
      weights: [{ label: 'Compétences', value: 30 }, { label: 'Diplômes', value: 25 }, { label: 'Expérience', value: 25 }, { label: 'Savoir-être', value: 5 }] },
  ].map(p => ({ ...p, icon: SECTOR_ICONS[p.code] }));

  activeProfile = signal(0);
  current = computed(() => this.profiles[this.activeProfile()]);
  /** Devient vrai quand la section est visible : déclenche jauge et barres */
  started = signal(false);
  rotating = signal(false);
  gaugeNum = signal(0);

  private paused = false;
  private rotateTimer?: ReturnType<typeof setInterval>;
  private gaugeFrame = 0;
  private readonly ROTATE_MS = 3500;

  /** Les 6 secteurs avec le plus d'offres, en pourcentage du premier */
  sectorRows = computed(() => {
    const data = this.bySector();
    if (!data) return [];
    const rows = Object.entries(data)
      .filter(([code, count]) => code !== 'OTHER' && count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const max = rows[0]?.[1] || 1;
    return rows.map(([code, count]) => ({
      code, count,
      label: sectorLabel(code),
      icon: sectorIcon(code),
      percent: Math.max(4, Math.round((count / max) * 100)),
    }));
  });

  /** « il y a 12 min », « il y a 3 h »… */
  freshness = computed(() => {
    const iso = this.lastUpdate();
    return iso ? this.ago(iso) : null;
  });

  displayed = signal<Partial<Record<string, number>>>({});

  private visible = signal(false);
  private frame = 0;

  constructor() {
    // afterNextRender ne s'exécute que dans le navigateur (jamais en SSR)
    afterNextRender(() => {
      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(this.frame);
        cancelAnimationFrame(this.gaugeFrame);
        clearInterval(this.rotateTimer);
      });

      const el = this.host.nativeElement as HTMLElement;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduce || !('IntersectionObserver' in window)) {
        el.classList.add('is-visible');
        this.visible.set(true);
        return;
      }

      const observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          el.classList.add('is-visible');
          this.visible.set(true);
          observer.disconnect();
        }
      }, { threshold: 0.15 });

      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // Rejoue le compteur si les données arrivent après l'affichage
    effect(() => {
      const stats = this.visibleStats();
      if (this.visible()) this.countUp(stats);
    }, { allowSignalWrites: true });

    // Jauge + rotation des métiers, une fois la section visible
    effect(() => {
      if (!this.visible()) return;
      this.started.set(true);
      this.tweenGauge(this.current().score);
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.visible()) this.startRotation();
    }, { allowSignalWrites: true });
  }

  private countUp(stats: Stat[]): void {
    cancelAnimationFrame(this.frame);
    const targets: Record<string, number> = Object.fromEntries(stats.map(s => [s.key, s.value ?? 0]));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayed.set(targets);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const values: Record<string, number> = {};
      for (const [key, target] of Object.entries(targets)) values[key] = Math.round(target * easeOut(t));
      this.displayed.set(values);
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };

    this.frame = requestAnimationFrame(tick);
  }

  // ── Démonstration du score par métier ─────────────────────
  selectProfile(k: number): void {
    this.activeProfile.set(k);
    this.startRotation(); // repart de zéro après un clic
  }

  pauseRotation(paused: boolean): void {
    this.paused = paused;
    this.rotating.set(!paused && !this.reducedMotion());
  }

  private startRotation(): void {
    clearInterval(this.rotateTimer);
    if (this.reducedMotion()) return;
    this.rotating.set(!this.paused);
    this.rotateTimer = setInterval(() => {
      if (this.paused) return;
      this.activeProfile.update(k => (k + 1) % this.profiles.length);
    }, this.ROTATE_MS);
  }

  private tweenGauge(target: number): void {
    cancelAnimationFrame(this.gaugeFrame);
    if (this.reducedMotion()) {
      this.gaugeNum.set(target);
      return;
    }
    const from = this.gaugeNum();
    const start = performance.now();
    const duration = 800;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.gaugeNum.set(Math.round(from + (target - from) * eased));
      if (t < 1) this.gaugeFrame = requestAnimationFrame(step);
    };
    this.gaugeFrame = requestAnimationFrame(step);
  }

  private reducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Affichage ──────────────────────────────────────────────
  icon(code: string): string {
    return sectorIcon(code);
  }

  format(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }

  ago(iso: string): string {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.round(h / 24);
    return `il y a ${d} jour${d > 1 ? 's' : ''}`;
  }

  initials(name: string): string {
    return name.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  /** « Mars 2027 » → « 2027-03 » pour l'attribut datetime */
  formatDate(dateStr: string): string {
    const months: Record<string, number> = {
      janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
      juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
    };
    const [m, y] = dateStr.toLowerCase().split(' ');
    return months[m] && y ? `${y}-${String(months[m]).padStart(2, '0')}` : dateStr;
  }
}