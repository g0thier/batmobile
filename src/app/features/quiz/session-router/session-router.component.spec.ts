import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import {
  QuizSessionContextService,
  type QuizSessionContextState,
} from '../../../core/quiz/quiz-session-context.service';
import { UserQuizSessionViewModel } from '../../../core/quiz/user-quiz-sessions.service';
import { SessionRouterComponent } from './session-router.component';

const createSession = (sessionId: string, quizId: string): UserQuizSessionViewModel => ({
  sessionId,
  quizId,
  responseDeadline: '2025-01-01T13:00:00.000Z',
  status: 'started',
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-01T10:00:00.000Z',
});

describe('SessionRouterComponent', () => {
  let stateSubject: Subject<QuizSessionContextState>;
  let currentSession: UserQuizSessionViewModel | null;
  let routerSpy: jasmine.SpyObj<Router>;
  let quizSessionContextServiceSpy: jasmine.SpyObj<QuizSessionContextService> & {
    state$: Subject<QuizSessionContextState>;
  };

  beforeEach(async () => {
    stateSubject = new Subject<QuizSessionContextState>();
    currentSession = null;

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    quizSessionContextServiceSpy = jasmine.createSpyObj<QuizSessionContextService>(
      'QuizSessionContextService',
      ['getCurrentSession', 'clearCurrentSession'],
    ) as jasmine.SpyObj<QuizSessionContextService> & {
      state$: Subject<QuizSessionContextState>;
    };
    quizSessionContextServiceSpy.state$ = stateSubject;
    quizSessionContextServiceSpy.getCurrentSession.and.callFake(() => currentSession);
    quizSessionContextServiceSpy.clearCurrentSession.and.callFake(() => {
      currentSession = null;
    });

    await TestBed.configureTestingModule({
      imports: [SessionRouterComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: QuizSessionContextService, useValue: quizSessionContextServiceSpy },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    stateSubject.complete();
  });

  it('recreates the active page when the session changes', async () => {
    const fixture = TestBed.createComponent(SessionRouterComponent);
    fixture.detectChanges();

    const createComponentSpy = jasmine.createSpy('createComponent');
    const clearSpy = jasmine.createSpy('clear');
    (fixture.componentInstance as any).sessionHost = {
      clear: clearSpy,
      createComponent: createComponentSpy,
    };

    currentSession = createSession('session-1', 'theorie-x-y');
    stateSubject.next({
      mode: 'mixed',
      currentSession,
      mixedPool: [currentSession],
    });
    await fixture.whenStable();

    currentSession = createSession('session-2', 'theorie-x-y');
    stateSubject.next({
      mode: 'mixed',
      currentSession,
      mixedPool: [currentSession],
    });
    await fixture.whenStable();

    expect(clearSpy).toHaveBeenCalled();
    expect(createComponentSpy).toHaveBeenCalledTimes(2);
  });
});
