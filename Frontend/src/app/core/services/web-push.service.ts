import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PushState = 'unsupported' | 'ios-install' | 'server-off' | 'denied' | 'off' | 'on';

const SW_URL = '/push-sw.js';
const SW_SCOPE = '/push/';
const SUBSCRIBE_TIMEOUT_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class WebPushService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private zone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private base = `${environment.apiUrl}/push`;
  private registration: ServiceWorkerRegistration | null = null;
  private initialized = false;

  readonly state = signal<PushState>('unsupported');
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly enabled = computed(() => this.state() === 'on');

  /** Lit l'état actuel (à l'affichage de la cloche) */
  async init(): Promise<void> {
    if (!this.isBrowser || this.initialized) return;
    this.initialized = true;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      this.state.set(this.isIosWithoutInstall() ? 'ios-install' : 'unsupported');
      return;
    }

    // Clic sur une notification alors que JobRadar est ouvert : navigation dans l'onglet
    navigator.serviceWorker.addEventListener('message', event => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === 'jobradar-push-navigate' && data.url) {
        const path = new URL(data.url).pathname + new URL(data.url).search;
        this.zone.run(() => this.router.navigateByUrl(path));
      }
    });

    try {
      const key = await firstValueFrom(this.http.get<{ publicKey: string | null; enabled: boolean }>(`${this.base}/public-key`));
      if (!key.enabled) {
        this.state.set('server-off');
        return;
      }
      this.registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      const existing = await this.registration.pushManager.getSubscription();
      if (Notification.permission === 'denied') this.state.set('denied');
      else this.state.set(existing ? 'on' : 'off');
      // Réenregistre l'abonnement (utile après un changement de compte sur le même navigateur)
      if (existing) await this.save(existing);
    } catch {
      this.state.set('unsupported');
    }
  }

  /** Bouton « Activer » : autorisation du navigateur, abonnement, envoi au serveur */
  async enable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.state.set(permission === 'denied' ? 'denied' : 'off');
        this.message.set('Autorisation refusée : les notifications ne peuvent pas être affichées.');
        return;
      }
      const key = await firstValueFrom(this.http.get<{ publicKey: string | null; enabled: boolean }>(`${this.base}/public-key`));
      if (!key.enabled || !key.publicKey) {
        this.state.set('server-off');
        return;
      }
      this.registration ??= await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      // Pas navigator.serviceWorker.ready : il attend un worker qui contrôle CETTE page,
      // or le nôtre a le scope /push/. On attend donc l'activation de notre enregistrement.
      await withTimeout(activated(this.registration), SUBSCRIBE_TIMEOUT_MS);
      const subscription = await withTimeout(
        this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(key.publicKey),
        }),
        SUBSCRIBE_TIMEOUT_MS,
      );
      await this.save(subscription);
      this.state.set('on');
      this.message.set('Notifications activées sur cet appareil.');
    } catch (err) {
      this.message.set(errorText(err, 'L\'activation a échoué. Réessayez.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Bouton « Désactiver » */
  async disable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const subscription = await this.registration?.pushManager.getSubscription();
      if (subscription) {
        await firstValueFrom(this.http.post<void>(`${this.base}/unsubscribe`, { endpoint: subscription.endpoint }));
        await subscription.unsubscribe();
      }
      this.state.set('off');
      this.message.set('Notifications désactivées sur cet appareil.');
    } catch (err) {
      this.message.set(errorText(err, 'La désactivation a échoué. Réessayez.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Bouton « Tester » */
  async test(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const res = await firstValueFrom(this.http.post<{ devices: number; delivered: number }>(`${this.base}/test`, {}));
      this.message.set(res.delivered
        ? `Notification envoyée à ${res.delivered} appareil${res.delivered > 1 ? 's' : ''}.`
        : 'Aucun appareil n\'a reçu la notification. Désactivez puis réactivez.');
    } catch (err) {
      this.message.set(errorText(err, 'L\'envoi de test a échoué.'));
    } finally {
      this.busy.set(false);
    }
  }

  private save(subscription: PushSubscription): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/subscribe`, subscription.toJSON()));
  }

  private isIosWithoutInstall(): boolean {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    return ios && !standalone;
  }
}

/** Clé VAPID (base64 url) → octets attendus par pushManager.subscribe */
function base64UrlToBytes(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

class PushTimeoutError extends Error {}

/** Attend que le service worker de cet enregistrement soit actif */
function activated(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return Promise.resolve();
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return Promise.resolve();
  return new Promise<void>(resolve => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve();
    });
  });
}

/** Abandonne une promesse trop longue au lieu de laisser le bouton bloqué */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PushTimeoutError()), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}


function errorText(err: unknown, fallback: string): string {
  console.warn('[Web Push]', err);
  if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'InvalidStateError')) {
    return 'Le service de notifications du navigateur est indisponible (navigation privée, Brave ou réseau filtré). Essayez avec Chrome, Edge ou Firefox.';
  }
  if (err instanceof PushTimeoutError) {
    return 'Le service de notifications du navigateur ne répond pas. Sur Brave, activez « Utiliser les services Google pour la messagerie push » dans les paramètres.';
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Le serveur JobRadar ne répond pas.';
    return (err.error as { message?: string } | null)?.message || fallback;
  }
  return fallback;
}