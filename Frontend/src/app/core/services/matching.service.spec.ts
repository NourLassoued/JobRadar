import { TestBed } from '@angular/core/testing';

import { MatchingService } from './core/services/matching.service';

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MatchingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
