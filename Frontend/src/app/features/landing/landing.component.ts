import { Component } from '@angular/core';
import { NavBarComponent } from '../FrontHome/nav-bar/nav-bar.component';
import { HeroSectionComponent } from '../FrontHome/hero-section/hero-section.component';
import { FeaturesSectionComponent } from '../FrontHome/features-section/features-section.component';
import { SectorsGridComponent } from '../FrontHome/sectors-grid/sectors-grid.component';
import { HowItWorksComponent } from '../FrontHome/how-it-works/how-it-works.component';
import { CtaSectionComponent } from '../FrontHome/cta-section/cta-section.component';
import { SiteFooterComponent } from '../FrontHome/site-footer/site-footer.component';
import { AnimatedStatsSectionComponent } from '../FrontHome/animated-stats-section/animated-stats-section.component';


@Component({
  selector: 'jr-landing',
  standalone: true,
  imports: [
    NavBarComponent,
    HeroSectionComponent,
    FeaturesSectionComponent,
    SectorsGridComponent,
    AnimatedStatsSectionComponent,
    HowItWorksComponent,
    CtaSectionComponent,
    SiteFooterComponent,
  ],
  template: `
    <jr-nav-bar />
    <main>
      <jr-hero-section />
      <jr-features-section />
      <jr-sectors-grid />
        <jr-animated-stats-section />  

      <jr-how-it-works />
      <jr-cta-section />
    </main>
    <jr-site-footer />
  `,
})
export class LandingComponent {}