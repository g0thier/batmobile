import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { UserQuizSessionViewModel } from './user-quiz-sessions.service';

export type QuizSessionContextMode = 'idle' | 'single' | 'mixed';

export interface QuizSessionContextState {
  mode: QuizSessionContextMode;
  currentSession: UserQuizSessionViewModel | null;
  mixedPool: UserQuizSessionViewModel[];
}

const EMPTY_STATE: QuizSessionContextState = {
  mode: 'idle',
  currentSession: null,
  mixedPool: [],
};

const readString = (value: string): string => value.trim();

const normalizeSession = (session: UserQuizSessionViewModel): UserQuizSessionViewModel => ({
  ...session,
  sessionId: readString(session.sessionId),
  quizId: readString(session.quizId).toLowerCase(),
  responseDeadline: readString(session.responseDeadline),
  status: readString(session.status),
  createdAt: readString(session.createdAt),
  updatedAt: readString(session.updatedAt),
});

const dedupeSessions = (sessions: UserQuizSessionViewModel[]): UserQuizSessionViewModel[] => {
  const sessionsById = new Map<string, UserQuizSessionViewModel>();

  sessions.forEach((session) => {
    const normalizedSession = normalizeSession(session);
    if (!normalizedSession.sessionId) {
      return;
    }

    sessionsById.set(normalizedSession.sessionId, normalizedSession);
  });

  return [...sessionsById.values()];
};

const pickRandomSession = (sessions: UserQuizSessionViewModel[]): UserQuizSessionViewModel | null => {
  if (sessions.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * sessions.length);
  return sessions[randomIndex] ?? null;
};

@Injectable({
  providedIn: 'root',
})
export class QuizSessionContextService {
  private readonly stateSubject = new BehaviorSubject<QuizSessionContextState>(EMPTY_STATE);

  readonly state$ = this.stateSubject.asObservable();

  getCurrentSession(): UserQuizSessionViewModel | null {
    return this.stateSubject.value.currentSession;
  }

  getCurrentMode(): QuizSessionContextMode {
    return this.stateSubject.value.mode;
  }

  isMixedMode(): boolean {
    return this.getCurrentMode() === 'mixed';
  }

  setSingleSession(session: UserQuizSessionViewModel): void {
    const normalizedSession = normalizeSession(session);
    this.stateSubject.next({
      mode: 'single',
      currentSession: normalizedSession,
      mixedPool: [normalizedSession],
    });
  }

  setMixedPool(sessions: UserQuizSessionViewModel[]): void {
    const normalizedPool = dedupeSessions(sessions);
    const currentSession = pickRandomSession(normalizedPool);

    if (!currentSession) {
      this.clearCurrentSession();
      return;
    }

    this.stateSubject.next({
      mode: 'mixed',
      currentSession,
      mixedPool: normalizedPool,
    });
  }

  advance(completedCurrentSession: boolean): UserQuizSessionViewModel | null {
    const currentState = this.stateSubject.value;
    if (currentState.mode !== 'mixed' || !currentState.currentSession) {
      return currentState.currentSession;
    }

    const currentSessionId = currentState.currentSession.sessionId;
    const nextPool = completedCurrentSession
      ? currentState.mixedPool.filter((session) => session.sessionId !== currentSessionId)
      : currentState.mixedPool;

    if (nextPool.length === 0) {
      this.clearCurrentSession();
      return null;
    }

    const otherSessions = nextPool.filter((session) => session.sessionId !== currentSessionId);
    const candidates = otherSessions.length > 0 ? otherSessions : nextPool;
    const nextSession = pickRandomSession(candidates);

    if (!nextSession) {
      this.clearCurrentSession();
      return null;
    }

    this.stateSubject.next({
      mode: 'mixed',
      currentSession: nextSession,
      mixedPool: nextPool,
    });

    return nextSession;
  }

  clearCurrentSession(): void {
    this.stateSubject.next(EMPTY_STATE);
  }
}
