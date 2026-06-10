import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SuccessProgressService } from '../../core/success/success-progress';
import { SuccessComponent } from './success.component';

describe('SuccessComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuccessComponent],
      providers: [
        {
          provide: SuccessProgressService,
          useValue: {
            state$: of({
              isLoading: false,
              loadError: '',
              overviewCards: [],
              sections: [],
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('tracks broken covers and stable ids', () => {
    const fixture = TestBed.createComponent(SuccessComponent);

    expect(fixture.componentInstance.hasBrokenCover('card-1')).toBeFalse();
    fixture.componentInstance.onCoverError('card-1');
    expect(fixture.componentInstance.hasBrokenCover('card-1')).toBeTrue();
    expect(fixture.componentInstance.trackByOverviewCardId(0, { id: 'overview' } as never)).toBe('overview');
  });
});

