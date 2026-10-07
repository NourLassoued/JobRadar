import { TestBed } from '@angular/core/testing';

import { JoobleService } from './jooble.service';

describe('JoobleService', () => {
  let service: JoobleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JoobleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
