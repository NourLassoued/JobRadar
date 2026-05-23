import { Component, input } from '@angular/core';
import { JobPreview } from '../../../../core/models/sector.model';
import { MatchScoreComponent } from '../match-score/match-score.component';

@Component({
  selector: 'jr-job-card-preview',
  standalone: true,
  imports: [MatchScoreComponent],
  template: `
    <div class="bg-white rounded-card p-3 border border-gray-200 shadow-sm w-full">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
             [class]="job().sector.bg">
          <i class="ti text-lg" [class]="job().sector.icon + ' ' + job().sector.text"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-ink truncate">{{ job().title }}</div>
          <div class="text-[10px] text-muted truncate">{{ job().company }} · {{ job().context }}</div>
        </div>
        <jr-match-score [score]="job().score" [size]="36" />
      </div>
    </div>
  `,
})
export class JobCardPreviewComponent {
  job = input.required<JobPreview>();
}