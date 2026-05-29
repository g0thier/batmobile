import { NgComponentOutlet } from '@angular/common';
import { Component, OnInit, Type, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QUIZ_STATS_PAGE_LOADERS, isQuizId } from '../../../core/quiz/quiz-page-registry';

@Component({
  selector: 'app-stats-router',
  standalone: true,
  imports: [NgComponentOutlet],
  templateUrl: './stats-router.component.html',
  styleUrl: './stats-router.component.css',
})
export class StatsRouterComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  componentType: Type<unknown> | null = null;

  ngOnInit(): void {
    const rawQuizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';
    if (!isQuizId(rawQuizId)) {
      void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      return;
    }

    void QUIZ_STATS_PAGE_LOADERS[rawQuizId]()
      .then((componentType) => {
        this.componentType = componentType;
      })
      .catch(() => {
        void this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
      });
  }
}
