import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth';
import { createPresentSnapshot, createTestUser } from '../../testing/spec-helpers';
import { UserQuizSessionsService, type UserQuizSessionsState } from './user-quiz-sessions.service';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('UserQuizSessionsService', () => {
  let authUser$: BehaviorSubject<ReturnType<typeof createTestUser> | null>;
  let service: UserQuizSessionsService;
  let refSpy: jasmine.Spy;
  let getSpy: jasmine.Spy;
  let onValueSpy: jasmine.Spy;

  beforeEach(() => {
    authUser$ = new BehaviorSubject<ReturnType<typeof createTestUser> | null>(null);
    refSpy = spyOn(firebaseDatabase, 'ref').and.callFake((...args: any[]) => ({ path: args[1] ?? '' } as never));
    getSpy = spyOn(firebaseDatabase, 'get').and.callFake((reference: any) => {
      if (reference.path === 'quizSessions/session-1') {
        return Promise.resolve(
          createPresentSnapshot({
            selectedGuests: [{ uid: 'user-1' }],
            responsesByUser: {
              'user-1': {
                status: 'started',
                updatedAt: '2025-01-01T09:00:00.000Z',
              },
            },
          }) as any,
        );
      }

      if (reference.path === 'quizSessions/session-2') {
        return Promise.resolve(
          createPresentSnapshot({
            selectedGuests: [{ uid: 'other-user' }],
            responsesByUser: {},
          }) as any,
        );
      }

      if (reference.path === 'quizSessions/session-3') {
        return Promise.resolve(
          createPresentSnapshot({
            responsesByUser: {
              'user-1': {
                status: 'completed',
                updatedAt: '2024-12-31T22:00:00.000Z',
              },
            },
          }) as any,
        );
      }

      return Promise.resolve(createPresentSnapshot({}) as any);
    });
    onValueSpy = spyOn(firebaseDatabase, 'onValue').and.callFake((reference: any, next: any) => {
      if (reference.path === 'users/user-1/quizSessions') {
        next(
          createPresentSnapshot({
            'session-1': {
              sessionId: 'session-1',
              quizId: 'attentes',
              responseDeadline: '2025-01-01T13:00:00.000Z',
              status: 'invited',
              createdAt: '2025-01-01T10:00:00.000Z',
              updatedAt: '2025-01-01T10:00:00.000Z',
            },
            'session-2': {
              sessionId: 'session-2',
              quizId: 'equite',
              responseDeadline: '2025-01-01T14:00:00.000Z',
              status: 'invited',
              createdAt: '2025-01-01T10:00:00.000Z',
              updatedAt: '2025-01-01T10:00:00.000Z',
            },
            'session-3': {
              sessionId: 'session-3',
              quizId: 'theorie-x-y',
              responseDeadline: '2024-12-31T12:00:00.000Z',
              status: 'completed',
              createdAt: '2024-12-31T10:00:00.000Z',
              updatedAt: '2024-12-31T11:00:00.000Z',
            },
          }) as any,
        );
      }

      return jasmine.createSpy('unsubscribe');
    });

    TestBed.configureTestingModule({
      providers: [
        UserQuizSessionsService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { authUser$: authUser$.asObservable() } },
      ],
    });

    service = TestBed.inject(UserQuizSessionsService);
  });

  it('emits an empty state when nobody is signed in', async () => {
    const states: UserQuizSessionsState[] = [];
    const subscription = service.state$.subscribe((state) => states.push(state));

    await Promise.resolve();
    subscription.unsubscribe();

    expect(states.at(-1)).toEqual({
      upcomingQuiz: [],
      pastQuiz: [],
      isLoading: false,
      loadError: '',
    });
  });

  it('filters visible sessions and sorts them by deadline', async () => {
    spyOn(Date, 'now').and.returnValue(new Date('2025-01-01T12:30:00.000Z').getTime());
    const states: UserQuizSessionsState[] = [];
    const subscription = service.state$.subscribe((state) => states.push(state));

    authUser$.next(createTestUser());

    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (states.at(-1)?.isLoading === false) {
        break;
      }
      await Promise.resolve();
    }
    await Promise.resolve();
    await Promise.resolve();
    subscription.unsubscribe();

    expect(refSpy).toHaveBeenCalledWith({}, 'users/user-1/quizSessions');
    expect(getSpy).toHaveBeenCalledWith(jasmine.objectContaining({ path: 'quizSessions/session-1' }));
    expect(states.at(-1)?.upcomingQuiz.map((session) => session.sessionId)).toEqual(['session-1']);
    expect(states.at(-1)?.pastQuiz.map((session) => session.sessionId)).toEqual(['session-3']);
  });
});
