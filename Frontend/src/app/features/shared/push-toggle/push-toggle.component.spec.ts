import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PushToggleComponent } from './push-toggle/push-toggle.component';

describe('PushToggleComponent', () => {
  let component: PushToggleComponent;
  let fixture: ComponentFixture<PushToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PushToggleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PushToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
