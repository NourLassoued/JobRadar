import { TestBed } from '@angular/core/testing';

import { FranceTravailService } from './france-travail.service';

describe('FranceTravailService', () => {
  let service: FranceTravailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FranceTravailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
