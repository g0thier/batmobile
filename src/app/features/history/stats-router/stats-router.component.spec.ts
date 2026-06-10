import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { QUIZ_STATS_PAGE_LOADERS } from '../../../core/quiz/quiz-page-registry';
import { StatsRouterComponent } from './stats-router.component';

@Component({
  standalone: true,
  template: '',
})
class TestStatsPageComponent {}

describe('StatsRouterComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let originalLoader: typeof QUIZ_STATS_PAGE_LOADERS['attentes'];

  beforeEach(() => {
    originalLoader = QUIZ_STATS_PAGE_LOADERS['attentes'];
    QUIZ_STATS_PAGE_LOADERS['attentes'] = async () => TestStatsPageComponent as never;
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
  });

  afterEach(() => {
    QUIZ_STATS_PAGE_LOADERS['attentes'] = originalLoader;
  });

  it('loads the matching stats component', async () => {
    await TestBed.configureTestingModule({
      imports: [StatsRouterComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ quizId: 'attentes', sessionId: 'session-1' }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StatsRouterComponent);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();

    expect(fixture.componentInstance.componentType).toBe(TestStatsPageComponent);
  });

  it('redirects invalid quiz ids back to history', async () => {
    await TestBed.configureTestingModule({
      imports: [StatsRouterComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ quizId: 'unknown', sessionId: 'session-1' }),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StatsRouterComponent);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/history', { replaceUrl: true });
  });
});
