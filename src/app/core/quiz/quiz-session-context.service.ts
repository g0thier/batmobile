import { Injectable } from '@angular/core';
import type { UserQuizSessionViewModel } from './user-quiz-sessions.service';

@Injectable({
  providedIn: 'root',
})
export class QuizSessionContextService {
  private currentSession: UserQuizSessionViewModel | null = null;

  setCurrentSession(session: UserQuizSessionViewModel): void {
    this.currentSession = session;
  }

  getCurrentSession(): UserQuizSessionViewModel | null {
    return this.currentSession;
  }

  clearCurrentSession(): void {
    this.currentSession = null;
  }
}
