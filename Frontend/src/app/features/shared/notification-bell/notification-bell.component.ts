import { Component, ElementRef, HostListener, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PushToggleComponent } from '../push-toggle/push-toggle.component';
import { AppNotification, NotificationService } from '../../../core/services/notification.service';

const TYPE_ICONS: Record<string, string> = {
  APPLICATION_DECISION: 'ti-mail-check',
  NEW_APPLICATION: 'ti-user-plus',
  INTERVIEW: 'ti-calendar-event',
};

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [PushToggleComponent],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent implements OnInit {
  readonly store = inject(NotificationService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  /** end = la liste s'aligne sur le bord droit de la cloche ; start = sur le bord gauche */
  readonly align = input<'start' | 'end'>('end');
  /** Ouverture vers le haut (cloche placée en bas de l'écran) */
  readonly up = input(false);

  readonly open = signal(false);

  ngOnInit(): void {
    this.store.start();
  }

  toggle(): void {
    this.open.update(v => !v);
    if (this.open()) this.store.refresh();
  }

  select(n: AppNotification): void {
    this.store.markRead(n);
    this.open.set(false);
    if (n.link) this.router.navigateByUrl(n.link);
  }

  icon(n: AppNotification): string {
    return TYPE_ICONS[n.type] ?? 'ti-bell';
  }

  /** « à l'instant », « il y a 5 min », « hier », « 12 nov. » */
  ago(date: string): string {
    const t = new Date(date).getTime();
    if (isNaN(t)) return '';
    const min = Math.floor((Date.now() - t) / 60_000);
    if (min < 1) return 'à l\'instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    if (h < 48) return 'hier';
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  /** Clic en dehors : on ferme */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}