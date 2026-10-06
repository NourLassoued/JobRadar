import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'jr-cta-section',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="cta" aria-labelledby="cta-title">
      <div class="cta__panel">
        <span class="orbit orbit--1" aria-hidden="true"></span>
        <span class="orbit orbit--2" aria-hidden="true"></span>
        <span class="orbit orbit--3" aria-hidden="true"></span>
        <span class="orbit__sweep" aria-hidden="true"></span>

        <div class="cta__content">
          <h2 class="cta__title" id="cta-title">Votre prochain poste est peut-être déjà publié.</h2>
          <p class="cta__text">
            Créez votre compte en deux minutes et voyez les offres qui vous correspondent dès aujourd'hui.
          </p>
          <div class="cta__actions">
            <a routerLink="/auth/register" class="btn btn--light">
              Créer mon compte gratuit <i class="ti ti-arrow-right" aria-hidden="true"></i>
            </a>
            <a routerLink="/auth/login" class="btn btn--outline">Se connecter</a>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      --brand-bg: #0d3a3e;
      --brand-bg-deep: #082628;
      --brand-line: rgba(182, 227, 224, 0.16);
      --brand-glow: #7fd1cc;
      --paper: #f3f5f4;
      --focus: 0 0 0 3px rgba(127, 209, 204, 0.5);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
      display: block;
      font-family: var(--font);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host { --paper: #0f1519; }
    }

    *, *::before, *::after { box-sizing: border-box; }
    p, h2 { margin: 0; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    .cta { padding: 24px 24px 80px; background: var(--paper); }

    .cta__panel {
      position: relative;
      max-width: 1120px;
      margin: 0 auto;
      padding: 72px 56px;
      border-radius: 20px;
      background: radial-gradient(120% 120% at 85% 50%, var(--brand-bg) 0%, var(--brand-bg-deep) 100%);
      color: #eaf5f4;
      overflow: hidden;
      isolation: isolate;
    }

    /* Cercles de radar à droite (pas de classe "ring" : conflit avec Tailwind) */
    .orbit {
      position: absolute;
      top: 50%;
      right: -80px;
      border: 1px solid var(--brand-line);
      border-radius: 50%;
      transform: translateY(-50%);
      z-index: -1;
    }

    .orbit--1 { width: 520px; height: 520px; }
    .orbit--2 { width: 360px; height: 360px; right: 0; }
    .orbit--3 { width: 200px; height: 200px; right: 80px; background: rgba(127, 209, 204, 0.06); }

    .orbit__sweep {
      position: absolute;
      top: 50%;
      right: -80px;
      width: 520px;
      height: 520px;
      margin-top: -260px;
      border-radius: 50%;
      background: conic-gradient(from 0deg, transparent 0deg, rgba(127, 209, 204, 0.18) 60deg, transparent 60.5deg);
      animation: sweep 8s linear infinite;
      z-index: -1;
    }

    @keyframes sweep { to { transform: rotate(360deg); } }

    .cta__content { position: relative; max-width: 560px; }

    .cta__title {
      font-size: clamp(26px, 3.4vw, 38px);
      font-weight: 700;
      line-height: 1.12;
      letter-spacing: -0.025em;
      color: #fff;
      text-wrap: balance;
    }

    .cta__text {
      margin-top: 14px;
      font-size: 16px;
      line-height: 1.6;
      color: rgba(234, 245, 244, 0.72);
    }

    .cta__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }

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
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .btn .ti { font-size: 17px; transition: transform 0.15s ease; }

    .btn--light { background: var(--brand-glow); color: var(--brand-bg-deep); }
    .btn--light:hover { background: #a3e2de; }
    .btn--light:hover .ti-arrow-right { transform: translateX(3px); }

    .btn--outline { border-color: rgba(234, 245, 244, 0.3); color: #fff; }
    .btn--outline:hover { border-color: #fff; background: rgba(255, 255, 255, 0.06); }

    @media (max-width: 720px) {
      .cta { padding: 16px 16px 56px; }
      .cta__panel { padding: 48px 24px 56px; }
      .orbit, .orbit__sweep { right: -260px; }
      .cta__actions .btn { flex: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .orbit__sweep { animation: none; display: none; }
      .btn, .btn .ti { transition: none; }
    }
  `],
})
export class CtaSectionComponent {}