import { NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, Type, inject } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuizSessionContextService } from '../../../core/quiz/quiz-session-context.service';
import { QUIZ_SESSION_PAGE_LOADERS, isQuizId } from '../../../core/quiz/quiz-page-registry';

@Component({
  selector: 'app-session-router',
  standalone: true,
  imports: [NgComponentOutlet],
  templateUrl: './session-router.component.html',
  styleUrl: './session-router.component.css',
})
export class SessionRouterComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly quizSessionContextService = inject(QuizSessionContextService);

  componentType: Type<unknown> | null = null;

  ngOnInit(): void {
    this.quizSessionContextService.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      void this.loadCurrentSessionComponent(state.currentSession);
    });
  }

  private async loadCurrentSessionComponent(
    currentSession: ReturnType<QuizSessionContextService['getCurrentSession']>,
  ): Promise<void> {
    this.componentType = null;

    if (!currentSession) {
      void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      return;
    }

    const rawQuizId = currentSession.quizId.trim().toLowerCase();
    if (!isQuizId(rawQuizId)) {
      this.quizSessionContextService.clearCurrentSession();
      void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      return;
    }

    try {
      const componentType = await QUIZ_SESSION_PAGE_LOADERS[rawQuizId]();

      if (this.quizSessionContextService.getCurrentSession()?.sessionId !== currentSession.sessionId) {
        return;
      }

      this.componentType = componentType;
    } catch {
      this.quizSessionContextService.clearCurrentSession();
      void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
    }
  }
}
