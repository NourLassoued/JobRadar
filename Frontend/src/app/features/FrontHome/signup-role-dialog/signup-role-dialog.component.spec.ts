import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignupRoleDialogComponent } from './signup-role-dialog.component';

describe('SignupRoleDialogComponent', () => {
  let component: SignupRoleDialogComponent;
  let fixture: ComponentFixture<SignupRoleDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupRoleDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignupRoleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
