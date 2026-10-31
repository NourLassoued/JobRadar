import { HttpClient, HttpDownloadProgressEvent, HttpEventType } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

/** NotificationDtos.NotificationResponse */
export interface AppNotification {
  id: number;
  /** APPLICATION_DECISION, NEW_APPLICATION… */
  type: string;
  title: string;
  body: string | null;
  /** Page à ouvrir au clic */
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationPage {
  items: AppNotification[];
  unread: number;
}

/** Filet de sécurité : relecture complète si le flux temps réel est coupé */
const POLL_MS = 60_000;
/** Reconnexion du flux : 1 s, 2 s, 4 s… jusqu'à 30 s */
const RETRY_MAX_MS = 30_000;
/** La cloche n'affiche pas plus de notifications que le serveur n'en renvoie */
const MAX_ITEMS = 30;

/**
 * Notifications de la cloche (candidat, recruteur, admin).
 * Un seul état partagé dans toute l'application : les cloches du menu et les pages le lisent.
 *
 * Temps réel : le flux GET /api/notifications/stream (Server-Sent Events) reste ouvert et
 * le serveur y écrit chaque nouvelle notification au moment où elle est créée.
 * Le flux passe par HttpClient : votre intercepteur ajoute le JWT comme pour les autres appels.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private base = `${environment.apiUrl}/notifications`;

  private timer: ReturnType<typeof setInterval> | null = null;
  private stream: Subscription | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  readonly loaded = signal(false);
  /** true quand le flux temps réel est ouvert */
  readonly live = signal(false);
  readonly hasUnread = computed(() => this.unread() > 0);

  /** Charge la liste, ouvre le flux temps réel (appelé par la cloche à son affichage) */
  start(): void {
    if (!this.isBrowser || this.timer) return;
    // Relecture seulement si le flux est coupé
    this.timer = setInterval(() => {
      if (!this.live()) this.refresh();
    }, POLL_MS);
    this.refresh();
    this.connect();
  }

  /** Déconnexion : ferme le flux et vide la liste */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timer = null;
    this.retryTimer = null;
    this.stream?.unsubscribe();
    this.stream = null;
    this.retries = 0;
    this.live.set(false);
    this.items.set([]);
    this.unread.set(0);
    this.loaded.set(false);
  }

  refresh(): void {
    this.http.get<NotificationPage>(this.base).subscribe({
      next: page => {
        this.items.set(page.items);
        this.unread.set(page.unread);
        this.loaded.set(true);
      },
      // Non connecté ou serveur arrêté : la cloche reste simplement vide
      error: () => this.loaded.set(true),
    });
  }

  markRead(n: AppNotification): void {
    if (n.read) return;
    this.items.update(list => list.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    this.unread.update(u => Math.max(0, u - 1));
    this.http.patch<void>(`${this.base}/${n.id}/read`, {}).subscribe({ error: () => this.refresh() });
  }

  markAllRead(): void {
    if (!this.unread()) return;
    this.items.update(list => list.map(x => ({ ...x, read: true })));
    this.unread.set(0);
    this.http.patch<void>(`${this.base}/read-all`, {}).subscribe({ error: () => this.refresh() });
  }

  // ── Flux temps réel (Server-Sent Events) ────────────────────

  private connect(): void {
    if (this.stream || !this.timer) return; // déjà ouvert, ou arrêté
    let seen = 0;
    let buffer = '';

    this.stream = this.http
      .get(`${this.base}/stream`, {
        observe: 'events',
        reportProgress: true,
        responseType: 'text',
        headers: { Accept: 'text/event-stream' },
      })
      .subscribe({
        next: event => {
          if (event.type !== HttpEventType.DownloadProgress) return;
          // partialText contient tout ce qui a été reçu depuis l'ouverture : on ne lit que la suite
          const text = (event as HttpDownloadProgressEvent).partialText ?? '';
          buffer += text.slice(seen);
          seen = text.length;
          buffer = this.readEvents(buffer);
          if (!this.live()) {
            this.live.set(true);
            this.retries = 0;
          }
        },
        // Fin normale (délai de 30 min côté serveur) ou coupure : on rouvre
        complete: () => this.reconnect(),
        error: () => this.reconnect(),
      });
  }

  private reconnect(): void {
    this.stream = null;
    this.live.set(false);
    if (!this.timer) return; // stop() a été appelé : pas de reconnexion
    const delay = Math.min(RETRY_MAX_MS, 1000 * 2 ** this.retries++);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.refresh(); // rattrape ce qui a pu arriver pendant la coupure
      this.connect();
    }, delay);
  }

  /** Découpe le texte reçu en événements SSE ; renvoie la partie incomplète à garder */
  private readEvents(buffer: string): string {
    const blocks = buffer.split(/\r?\n\r?\n/);
    const rest = blocks.pop() ?? '';
    for (const block of blocks) {
      let name = 'message';
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        // Les lignes « : ping » sont des commentaires : ignorées
      }
      if (name === 'notification' && data.length) {
        try {
          this.add(JSON.parse(data.join('\n')) as AppNotification);
        } catch {
          // Message illisible : ignoré
        }
      }
    }
    return rest;
  }

  private add(n: AppNotification): void {
    if (this.items().some(x => x.id === n.id)) return;
    this.items.update(list => [n, ...list].slice(0, MAX_ITEMS));
    if (!n.read) this.unread.update(u => u + 1);
    this.loaded.set(true);
  }
}