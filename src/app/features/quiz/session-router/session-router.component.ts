import { NgComponentOutlet } from '@angular/common';
import { Component, OnInit, Type, inject } from '@angular/core';
import { Router } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly quizSessionContextService = inject(QuizSessionContextService);

  componentType: Type<unknown> | null = null;

  ngOnInit(): void {
    const session = this.quizSessionContextService.getCurrentSession();
    const rawQuizId = session?.quizId.trim().toLowerCase() ?? '';
    if (!session || !isQuizId(rawQuizId)) {
      this.quizSessionContextService.clearCurrentSession();
      void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      return;
    }

    void QUIZ_SESSION_PAGE_LOADERS[rawQuizId]()
      .then((componentType) => {
        this.componentType = componentType;
      })
      .catch(() => {
        this.quizSessionContextService.clearCurrentSession();
        void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      });
  }
}
