import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  route: string;
  fragment?: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

@Component({
  selector: 'jr-site-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="footer__inner">

        <div class="footer__top">
          <div class="footer__brand">
            <a routerLink="/" class="brand">
              <span class="brand__mark" aria-hidden="true"><i class="ti ti-radar-2"></i></span>
              <span class="brand__name">JobRadar</span>
            </a>
            <p class="footer__tagline">
              Les offres de 14 secteurs, classées selon votre profil.
              Gratuit pour les candidats.
            </p>
          </div>

          <nav class="footer__cols" aria-label="Liens du pied de page">
            @for (col of columns; track col.title) {
              <div class="col">
                <p class="col__title">{{ col.title }}</p>
                <ul class="col__list">
                  @for (link of col.links; track link.label) {
                    <li>
                      <a class="col__link" [routerLink]="link.route" [fragment]="link.fragment">{{ link.label }}</a>
                    </li>
                  }
                </ul>
              </div>
            }
          </nav>
        </div>

        <div class="footer__bottom">
          <p>© {{ year }} JobRadar. Tous droits réservés.</p>
          <p class="footer__source">
            <i class="ti ti-database" aria-hidden="true"></i>
            Offres issues de l'API France Travail
          </p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      --paper: #f3f5f4; --surface: #ffffff; --surface-sunk: #f7f8f8;
      --ink: #17202a; --ink-soft: #3a4652; --muted: #66727e;
      --line: #dde2e5; --accent: #155e63;
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
        --line: #253038; --accent: #5fb3b3;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }

    *, *::before, *::after { box-sizing: border-box; }
    p, ul { margin: 0; }
    ul { list-style: none; padding: 0; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    .footer { background: var(--surface); border-top: 1px solid var(--line); }
    .footer__inner { max-width: 1120px; margin: 0 auto; padding: 56px 24px 28px; }

    .footer__top {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr);
      gap: 48px;
      padding-bottom: 40px;
    }

    /* Marque */
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; border-radius: 8px; }

    .brand__mark {
      display: grid; place-items: center;
      width: 32px; height: 32px;
      border-radius: 9px; background: var(--accent); color: #fff; font-size: 19px;
    }

    .brand__name { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }

    .footer__tagline { margin-top: 14px; max-width: 32ch; font-size: 14px; line-height: 1.6; color: var(--ink-soft); }

    /* Colonnes */
    .footer__cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }

    .col__title {
      font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--muted);
      margin-bottom: 14px;
    }

    .col__list { display: flex; flex-direction: column; gap: 10px; }

    .col__link {
      font-size: 14px; color: var(--ink-soft); text-decoration: none;
      border-radius: 4px;
      transition: color 0.15s ease;
    }

    .col__link:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }

    /* Bas */
    .footer__bottom {
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
      font-size: 13px; color: var(--muted);
    }

    .footer__source { display: inline-flex; align-items: center; gap: 6px; }
    .footer__source .ti { font-size: 15px; }

    @media (prefers-color-scheme: dark) {
      .brand__mark { color: #0f1519; }
    }

    @media (max-width: 820px) {
      .footer__top { grid-template-columns: 1fr; gap: 36px; }
    }

    @media (max-width: 480px) {
      .footer__inner { padding: 40px 20px 24px; }
      .footer__cols { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 16px; }
      .footer__bottom { flex-direction: column; }
    }
  `],
})
export class SiteFooterComponent {
  readonly year = new Date().getFullYear();

  // Adapte les routes légales à tes vraies pages
  readonly columns: FooterColumn[] = [
    {
      title: 'Produit',
      links: [
        { label: 'Fonctionnalités', route: '/', fragment: 'fonctionnalites' },
        { label: 'Secteurs', route: '/', fragment: 'secteurs' },
        { label: 'Comment ça marche', route: '/', fragment: 'comment-ca-marche' },
      ],
    },
    {
      title: 'Compte',
      links: [
        { label: 'Créer un compte', route: '/auth/register' },
        { label: 'Se connecter', route: '/auth/login' },
        { label: 'Mot de passe oublié', route: '/auth/forgot-password' },
      ],
    },
    {
      title: 'Légal',
      links: [
        { label: "Conditions d'utilisation", route: '/cgu' },
        { label: 'Confidentialité', route: '/confidentialite' },
        { label: 'Mentions légales', route: '/mentions-legales' },
      ],
    },
  ];
}