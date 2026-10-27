import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

/** Valeurs envoyées au backend (enum Java Role) */
export type SignupRole = 'USER' | 'RECRUITER';

interface RoleOption {
  value: SignupRole;
  icon: string;
  title: string;
  text: string;
  points: string[];
}

/**
 * Fenêtre « Vous êtes… candidat ou recruteur ? » affichée au clic sur « Commencer ».
 * Le choix est transmis à la page d'inscription : /auth/register?role=RECRUITER
 *
 * Utilisation :  <jr-signup-role-dialog #signup />  puis  signup.open()
 */
@Component({
  selector: 'jr-signup-role-dialog',
  standalone: true,
  template: `
    <dialog #dialog class="dlg" aria-labelledby="signup-role-title" (click)="onBackdrop($event)" (close)="selected.set(null)">
      <div class="dlg__box">
        <button type="button" class="dlg__close" (click)="close()" aria-label="Fermer">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>

        <p class="dlg__eyebrow">Créer un compte</p>
        <h2 id="signup-role-title">Vous êtes…</h2>
        <p class="dlg__lead">Choisissez votre espace pour adapter votre inscription.</p>

        <div class="roles" role="radiogroup" aria-label="Type de compte">
          @for (r of roles; track r.value) {
            <button type="button" class="role" role="radio"
                    [class.is-on]="selected() === r.value" [attr.aria-checked]="selected() === r.value"
                    (click)="selected.set(r.value)" (dblclick)="choose(r.value)">
              <span class="role__icon"><i [class]="'ti ' + r.icon" aria-hidden="true"></i></span>
              <span class="role__title">{{ r.title }}</span>
              <span class="role__text">{{ r.text }}</span>
              <ul class="role__points">
                @for (p of r.points; track p) { <li><i class="ti ti-check" aria-hidden="true"></i> {{ p }}</li> }
              </ul>
              <span class="role__check" aria-hidden="true"><i class="ti ti-circle-check-filled"></i></span>
            </button>
          }
        </div>

        <div class="dlg__actions">
          <button type="button" class="btn btn--primary btn--block" [disabled]="!selected()" (click)="choose(selected()!)">
            @if (selected() === 'RECRUITER') { Créer mon compte recruteur }
            @else if (selected() === 'USER') { Créer mon compte candidat }
            @else { Choisissez un type de compte }
            <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
          <p class="dlg__login">Déjà inscrit ? <a href="/auth/login" (click)="goLogin($event)">Se connecter</a></p>
        </div>
      </div>
    </dialog>
  `,
  styles: [`
    :host {
      --surface: #ffffff; --surface-sunk: #f7f8f8; --ink: #17202a; --ink-soft: #3a4652; --muted: #66727e;
      --line: #dde2e5; --accent: #155e63; --accent-hover: #0f4a4e; --accent-soft: #e2efee;
      --focus: 0 0 0 3px rgba(21, 94, 99, 0.28);
      --font: 'Schibsted Grotesk', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --surface: #161e23; --surface-sunk: #12191d; --ink: #e6ebee; --ink-soft: #c3ccd2; --muted: #8d9aa4;
        --line: #253038; --accent: #5fb3b3; --accent-hover: #7cc6c5; --accent-soft: #19302f;
        --focus: 0 0 0 3px rgba(95, 179, 179, 0.35);
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    :focus-visible { outline: none; box-shadow: var(--focus); }

    .dlg {
      width: min(640px, calc(100vw - 32px)); max-height: calc(100dvh - 32px);
      padding: 0; border: 1px solid var(--line); border-radius: 16px;
      background: var(--surface); color: var(--ink); font-family: var(--font);
      box-shadow: 0 30px 60px -20px rgba(13, 58, 62, 0.45);
    }
    .dlg[open] { animation: pop 0.18s ease-out; }
    .dlg::backdrop { background: rgba(15, 21, 25, 0.55); backdrop-filter: blur(3px); }

    .dlg__box { position: relative; padding: 28px; display: grid; gap: 6px; }
    .dlg__close {
      position: absolute; top: 14px; right: 14px; display: grid; place-items: center;
      width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent;
      color: var(--muted); font-size: 20px; cursor: pointer;
    }
    .dlg__close:hover { background: var(--surface-sunk); color: var(--ink); }
    .dlg__eyebrow { margin: 0; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    h2 { margin: 0; font-size: 26px; letter-spacing: -0.02em; }
    .dlg__lead { margin: 0 0 14px; color: var(--muted); font-size: 15px; }

    .roles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .role {
      position: relative; display: grid; align-content: start; justify-items: start; gap: 6px;
      padding: 18px; text-align: left; font: inherit; color: inherit; cursor: pointer;
      background: var(--surface); border: 1.5px solid var(--line); border-radius: 12px;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .role:hover { border-color: var(--accent); }
    .role.is-on { border-color: var(--accent); background: var(--accent-soft); }
    .role__icon {
      display: grid; place-items: center; width: 42px; height: 42px; margin-bottom: 4px;
      border-radius: 10px; background: var(--accent-soft); color: var(--accent); font-size: 22px;
    }
    .role.is-on .role__icon { background: var(--accent); color: var(--surface); }
    .role__title { font-size: 17px; font-weight: 700; }
    .role__text { color: var(--ink-soft); font-size: 14px; line-height: 1.45; }
    .role__points { display: grid; gap: 4px; margin: 6px 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 13px; }
    .role__points .ti { color: var(--accent); }
    .role__check { position: absolute; top: 14px; right: 14px; color: var(--accent); font-size: 22px; opacity: 0; transition: opacity 0.15s ease; }
    .role.is-on .role__check { opacity: 1; }

    .dlg__actions { display: grid; gap: 12px; margin-top: 18px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 46px; padding: 0 16px;
      font: inherit; font-size: 15px; font-weight: 600; border: 1px solid transparent; border-radius: 8px; cursor: pointer;
    }
    .btn--primary { background: var(--accent); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn--block { width: 100%; }
    .dlg__login { margin: 0; text-align: center; color: var(--muted); font-size: 14px; }
    .dlg__login a { color: var(--accent); font-weight: 600; }

    @media (prefers-color-scheme: dark) { .btn--primary { color: #0f1519; } }
    @media (max-width: 560px) {
      .dlg__box { padding: 22px 18px; }
      .roles { grid-template-columns: 1fr; }
      .role__points { display: none; }
    }
    @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .dlg[open], .role, .role__check { animation: none; transition: none; } }
  `],
})
export class SignupRoleDialogComponent {
  private router = inject(Router);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly selected = signal<SignupRole | null>(null);

  readonly roles: RoleOption[] = [
    {
      value: 'USER',
      icon: 'ti-user-search',
      title: 'Candidat',
      text: "Je cherche un emploi et je veux les offres qui correspondent à mon profil.",
      points: ['Score de compatibilité', 'CV et lettres générés par IA', 'Suivi des candidatures'],
    },
    {
      value: 'RECRUITER',
      icon: 'ti-building',
      title: 'Recruteur',
      text: 'Je publie des offres et je veux recevoir des candidats qualifiés.',
      points: ['Profil entreprise', "Publication d'offres", 'Candidats triés par score'],
    },
  ];

  open(): void {
    this.selected.set(null);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  choose(role: SignupRole): void {
    this.close();
    this.router.navigate(['/auth/register'], { queryParams: { role } });
  }

  goLogin(event: Event): void {
    event.preventDefault();
    this.close();
    this.router.navigate(['/auth/login']);
  }

  /** Un clic sur le fond sombre (hors de la boîte) ferme la fenêtre */
  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}