import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobOfferModalComponent } from './job-offer-modal.component';

describe('JobOfferModalComponent', () => {
  let component: JobOfferModalComponent;
  let fixture: ComponentFixture<JobOfferModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobOfferModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobOfferModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
