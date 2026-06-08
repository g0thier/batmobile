import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { BehaviorSubject } from 'rxjs';
import { QuizSessionContextService } from '../../core/quiz/quiz-session-context.service';
import {
  UserQuizSessionViewModel,
  UserQuizSessionsService,
  UserQuizSessionsState,
} from '../../core/quiz/user-quiz-sessions.service';
import { QuizComponent } from './quiz.component';

const nowIso = '2025-01-01T12:00:00.000Z';
const nowMs = new Date(nowIso).getTime();

const createSession = (
  sessionId: string,
  overrides: Partial<UserQuizSessionViewModel> = {},
): UserQuizSessionViewModel => ({
  sessionId,
  quizId: 'attentes',
  responseDeadline: '2025-01-01T13:00:00.000Z',
  status: 'invited',
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-01T10:00:00.000Z',
  ...overrides,
});

describe('QuizComponent', () => {
  let stateSubject: BehaviorSubject<UserQuizSessionsState>;
  let routerSpy: jasmine.SpyObj<Router>;
  let quizSessionContextServiceSpy: jasmine.SpyObj<QuizSessionContextService>;
  let userQuizSessionsServiceSpy: Pick<UserQuizSessionsService, 'state$'> & {
    refresh: jasmine.Spy;
  };

  beforeEach(async () => {
    stateSubject = new BehaviorSubject<UserQuizSessionsState>({
      upcomingQuiz: [],
      pastQuiz: [],
      isLoading: true,
      loadError: '',
    });

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    quizSessionContextServiceSpy = jasmine.createSpyObj<QuizSessionContextService>('QuizSessionContextService', [
      'setMixedPool',
      'clearCurrentSession',
      'getCurrentSession',
      'getCurrentMode',
      'isMixedMode',
      'setSingleSession',
      'advance',
    ]);

    userQuizSessionsServiceSpy = {
      state$: stateSubject.asObservable(),
      refresh: jasmine.createSpy('refresh'),
    };

    await TestBed.configureTestingModule({
      imports: [QuizComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: routerSpy },
        { provide: QuizSessionContextService, useValue: quizSessionContextServiceSpy },
        { provide: UserQuizSessionsService, useValue: userQuizSessionsServiceSpy },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    stateSubject.complete();
  });

  it('filters the mixed pool to playable upcoming sessions only', async () => {
    const fixture = TestBed.createComponent(QuizComponent);
    fixture.detectChanges();

    stateSubject.next({
      upcomingQuiz: [
        createSession('open-session'),
        createSession('completed-session', {
          status: 'completed',
        }),
        createSession('archived-session', {
          status: 'archived',
        }),
        createSession('expired-session', {
          status: 'started',
          responseDeadline: '2024-12-31T23:59:59.000Z',
        }),
      ],
      pastQuiz: [
        createSession('past-session', {
          status: 'invited',
          responseDeadline: '2025-01-01T13:00:00.000Z',
        }),
      ],
      isLoading: false,
      loadError: '',
    });

    spyOn(Date, 'now').and.returnValue(nowMs);

    await fixture.componentInstance.onLauncherTap({
      buttonLabel: 'Question du jour',
      action: 'session',
      selectedSession: null,
      isLoading: false,
      loadError: '',
    });

    expect(quizSessionContextServiceSpy.setMixedPool).toHaveBeenCalledTimes(1);
    const mixedPool = quizSessionContextServiceSpy.setMixedPool.calls.mostRecent().args[0] as UserQuizSessionViewModel[];
    expect(mixedPool.map((session) => session.sessionId)).toEqual(['open-session']);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/quiz-session');
  });

  it('falls back to history when no playable mixed session remains', async () => {
    const fixture = TestBed.createComponent(QuizComponent);
    fixture.detectChanges();

    stateSubject.next({
      upcomingQuiz: [
        createSession('completed-session', {
          status: 'completed',
        }),
        createSession('archived-session', {
          status: 'archived',
        }),
        createSession('expired-session', {
          status: 'started',
          responseDeadline: '2024-12-31T23:59:59.000Z',
        }),
      ],
      pastQuiz: [],
      isLoading: false,
      loadError: '',
    });

    spyOn(Date, 'now').and.returnValue(nowMs);

    await fixture.componentInstance.onLauncherTap({
      buttonLabel: "Voir l'historique",
      action: 'history',
      selectedSession: null,
      isLoading: false,
      loadError: '',
    });

    expect(quizSessionContextServiceSpy.setMixedPool).not.toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/history');
  });
});
