import { TestBed } from '@angular/core/testing';
import { QuizSessionContextService } from './quiz-session-context.service';

describe('QuizSessionContextService', () => {
  let service: QuizSessionContextService;

  const createSession = (sessionId: string, quizId: string) => ({
    sessionId,
    quizId,
    responseDeadline: '2025-01-01T12:00:00.000Z',
    status: 'started',
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T11:00:00.000Z',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QuizSessionContextService],
    });

    service = TestBed.inject(QuizSessionContextService);
  });

  it('stores a single normalized session', () => {
    service.setSingleSession(createSession('  session-1  ', '  ATTENTES '));

    expect(service.getCurrentMode()).toBe('single');
    expect(service.isMixedMode()).toBeFalse();
    expect(service.getCurrentSession()?.sessionId).toBe('session-1');
    expect(service.getCurrentSession()?.quizId).toBe('attentes');
  });

  it('deduplicates mixed sessions and picks one at random', () => {
    spyOn(Math, 'random').and.returnValue(0.75);

    service.setMixedPool([
      createSession('session-1', 'attentes'),
      createSession('session-1', 'attentes'),
      createSession('session-2', 'equite'),
    ]);

    expect(service.getCurrentMode()).toBe('mixed');
    expect(service.getCurrentSession()?.sessionId).toBe('session-2');
    expect((service as any).stateSubject.value.mixedPool.map((session: { sessionId: string }) => session.sessionId)).toEqual([
      'session-1',
      'session-2',
    ]);
  });

  it('advances mixed sessions and clears the state when the pool is empty', () => {
    spyOn(Math, 'random').and.returnValue(0);

    service.setMixedPool([createSession('session-1', 'attentes')]);
    expect(service.advance(true)).toBeNull();
    expect(service.getCurrentSession()).toBeNull();
    expect(service.getCurrentMode()).toBe('idle');
  });
});

