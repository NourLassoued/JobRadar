import { TestBed } from '@angular/core/testing';

import { TheMuseService } from './core/services/the-muse.service';

describe('TheMuseService', () => {
  let service: TheMuseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TheMuseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
