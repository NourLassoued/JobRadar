import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplyButtonComponentTsComponent } from './apply-button.component.ts.component';

describe('ApplyButtonComponentTsComponent', () => {
  let component: ApplyButtonComponentTsComponent;
  let fixture: ComponentFixture<ApplyButtonComponentTsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplyButtonComponentTsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplyButtonComponentTsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
