import { Component } from '@angular/core';
import { NavBarComponent } from './components/nav-bar/nav-bar.component';
import { HeroSectionComponent } from './components/hero-section/hero-section.component';
import { SectorsGridComponent } from './components/sectors-grid/sectors-grid.component';
import { HowItWorksComponent } from './components/how-it-works/how-it-works.component';

@Component({
  selector: 'jr-landing',
  standalone: true,
  imports: [
    NavBarComponent,
    HeroSectionComponent,
    SectorsGridComponent,
    HowItWorksComponent,   // ← assure-toi qu'il est bien là
  ],
  template: `
    <div class="min-h-screen bg-mist">
      <jr-nav-bar />
      <jr-hero-section />
      <jr-sectors-grid />
      <jr-how-it-works />
    </div>
  `,
})
export class LandingComponent {}