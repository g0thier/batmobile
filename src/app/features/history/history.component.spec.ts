import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { QuizCatalogService } from '../../core/quiz/quiz-catalog.service';
import { QuizSessionContextService } from '../../core/quiz/quiz-session-context.service';
import { UserQuizSessionsService } from '../../core/quiz/user-quiz-sessions.service';
import { HistoryComponent } from './history.component';

describe('HistoryComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let quizSessionContextSpy: jasmine.SpyObj<QuizSessionContextService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    quizSessionContextSpy = jasmine.createSpyObj<QuizSessionContextService>('QuizSessionContextService', [
      'setSingleSession',
    ]);

    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: QuizSessionContextService, useValue: quizSessionContextSpy },
        { provide: QuizCatalogService, useValue: new QuizCatalogService() },
        {
          provide: UserQuizSessionsService,
          useValue: {
            state$: of({
              upcomingQuiz: [],
              pastQuiz: [],
              isLoading: false,
              loadError: '',
            }),
            refresh: jasmine.createSpy('refresh'),
          },
        },
      ],
    }).compileComponents();
  });

  it('formats statuses and dates consistently', () => {
    const fixture = TestBed.createComponent(HistoryComponent);

    expect(fixture.componentInstance.getStatusLabel('started')).toBe('En cours');
    expect(fixture.componentInstance.getTodoBadgeLabel({ status: 'started' } as never)).toBe('En cours');
    expect(fixture.componentInstance.getTodoStatusLabel({ status: 'invited' } as never)).toBe('À faire');
    const formattedDate = fixture.componentInstance.formatDateTime('2025-01-01T00:00:00.000Z');
    expect(formattedDate).toContain('mercredi');
    expect(formattedDate).toContain('janvier');
  });

  it('routes to the session or stats screens from cards', async () => {
    const fixture = TestBed.createComponent(HistoryComponent);

    await fixture.componentInstance.onUpcomingQuizCardTap({
      sessionId: 'session-1',
      quizId: 'attentes',
      responseDeadline: '2025-01-01T12:00:00.000Z',
      status: 'started',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T11:00:00.000Z',
    });

    expect(quizSessionContextSpy.setSingleSession).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/quiz-session');

    await fixture.componentInstance.onPastQuizCardTap({
      sessionId: 'session-2',
      quizId: 'EQUITE',
      responseDeadline: '2025-01-01T12:00:00.000Z',
      status: 'completed',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T11:00:00.000Z',
    });

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/quiz-stats/equite/session-2');
  });
});
