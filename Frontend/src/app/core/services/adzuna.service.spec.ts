import { TestBed } from '@angular/core/testing';

import { AdzunaService } from '../core/services/adzuna.service';

describe('AdzunaService', () => {
  let service: AdzunaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdzunaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
