import { TestBed } from '@angular/core/testing';

import { RecruiterService } from './core/services/recruiter.service';

describe('RecruiterService', () => {
  let service: RecruiterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecruiterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
