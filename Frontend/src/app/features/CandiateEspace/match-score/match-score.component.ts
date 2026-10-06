import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'jr-match-score',
  standalone: true,
  template: `
    <div class="relative" [style.width.px]="size()" [style.height.px]="size()">
      <svg [attr.width]="size()" [attr.height]="size()" [attr.viewBox]="'0 0 ' + size() + ' ' + size()">
        <circle [attr.cx]="size()/2" [attr.cy]="size()/2" [attr.r]="radius()"
                fill="none" [attr.stroke]="trackColor()" [attr.stroke-width]="stroke()" />
        <circle [attr.cx]="size()/2" [attr.cy]="size()/2" [attr.r]="radius()"
                fill="none" [attr.stroke]="ringColor()" [attr.stroke-width]="stroke()"
                [attr.stroke-dasharray]="circumference()"
                [attr.stroke-dashoffset]="offset()"
                [attr.transform]="'rotate(-90 ' + size()/2 + ' ' + size()/2 + ')'"
                stroke-linecap="round" />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center font-medium"
           [style.color]="textColor()" [style.font-size.px]="fontSize()">
        {{ score() }}
      </div>
    </div>
  `,
})
export class MatchScoreComponent {
  score = input.required<number>();
  size = input<number>(56);

  stroke = computed(() => this.size() < 40 ? 3 : 5);
  radius = computed(() => (this.size() - this.stroke() * 2) / 2);
  circumference = computed(() => 2 * Math.PI * this.radius());
  offset = computed(() => this.circumference() * (1 - this.score() / 100));
  fontSize = computed(() => this.size() < 40 ? 11 : 16);

  ringColor = computed(() => {
    const s = this.score();
    if (s >= 70) return '#10B981';
    if (s >= 40) return '#F59E0B';
    return '#E24B4A';
  });

  trackColor = computed(() => {
    const s = this.score();
    if (s >= 70) return '#E1F5EE';
    if (s >= 40) return '#FAEEDA';
    return '#FCEBEB';
  });

  textColor = computed(() => {
    const s = this.score();
    if (s >= 70) return '#0F6E56';
    if (s >= 40) return '#854F0B';
    return '#A32D2D';
  });
}