import { Component, OnInit, inject } from '@angular/core';
import { WebPushService } from '../../../core/services/web-push.service';

@Component({
  selector: 'app-push-toggle',
  standalone: true,
  templateUrl: './push-toggle.component.html',
  styleUrl: './push-toggle.component.scss',
})
export class PushToggleComponent implements OnInit {
  readonly push = inject(WebPushService);

  ngOnInit(): void {
    void this.push.init();
  }
}