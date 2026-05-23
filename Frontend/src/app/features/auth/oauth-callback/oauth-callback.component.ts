import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'jr-oauth-callback',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-mist">
      <div class="text-center">
        <div class="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-600/30">
          <i class="ti ti-loader-2 text-white text-3xl animate-spin"></i>
        </div>
        <h1 class="text-2xl font-medium text-ink mb-2">Connexion en cours…</h1>
        <p class="text-sm text-muted">Nous finalisons votre authentification.</p>
      </div>
    </div>
  `,
})
export class OauthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (error) {
      this.router.navigate(['/auth/login'], {
        queryParams: { error: 'oauth_failed' },
      });
      return;
    }

    if (token) {
      this.auth.handleOAuthCallback(token);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }
}