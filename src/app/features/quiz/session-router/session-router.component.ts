import {
  AfterViewInit,
  Component,
  DestroyRef,
  EnvironmentInjector,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuizSessionContextService } from '../../../core/quiz/quiz-session-context.service';
import { QUIZ_SESSION_PAGE_LOADERS, isQuizId } from '../../../core/quiz/quiz-page-registry';

@Component({
  selector: 'app-session-router',
  standalone: true,
  templateUrl: './session-router.component.html',
  styleUrl: './session-router.component.css',
})
export class SessionRouterComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly router = inject(Router);
  private readonly quizSessionContextService = inject(QuizSessionContextService);
  private renderToken = 0;

  @ViewChild('sessionHost', { read: ViewContainerRef })
  private readonly sessionHost?: ViewContainerRef;

  ngAfterViewInit(): void {
    this.quizSessionContextService.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      void this.loadCurrentSessionComponent(state.currentSession);
    });
  }

  private async loadCurrentSessionComponent(
    currentSession: ReturnType<QuizSessionContextService['getCurrentSession']>,
  ): Promise<void> {
    const renderToken = ++this.renderToken;
    this.sessionHost?.clear();

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

      if (
        renderToken !== this.renderToken ||
        this.quizSessionContextService.getCurrentSession()?.sessionId !== currentSession.sessionId
      ) {
        return;
      }

      this.sessionHost?.clear();
      this.sessionHost?.createComponent(componentType, {
        environmentInjector: this.environmentInjector,
      });
    } catch {
      this.quizSessionContextService.clearCurrentSession();
      void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
    }
  }
}
