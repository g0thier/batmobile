import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth-guard';
import { guestGuard } from './core/auth/guards/guest-guard';
import { isQuizId } from './core/quiz/quiz-page-registry';

const quizIdRouteGuard: CanActivateFn = (route) => {
  const quizId = route.paramMap.get('quizId')?.trim().toLowerCase() ?? '';
  if (isQuizId(quizId)) {
    return true;
  }

  return inject(Router).createUrlTree(['/tabs/history']);
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/tabs-shell/tabs-shell.component').then((m) => m.TabsShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'quiz',
      },
      {
        path: 'quiz',
        loadComponent: () => import('./features/quiz/quiz.component').then((m) => m.QuizComponent),
      },
      {
        path: 'quiz-session',
        loadComponent: () =>
          import('./features/quiz/session-router/session-router.component').then(
            (m) => m.SessionRouterComponent,
          ),
      },
      {
        path: 'quiz-stats/:quizId/:sessionId',
        canActivate: [quizIdRouteGuard],
        loadComponent: () =>
          import('./features/history/stats-router/stats-router.component').then(
            (m) => m.StatsRouterComponent,
          ),
      },
      {
        path: 'success',
        loadComponent: () =>
          import('./features/success/success.component').then((m) => m.SuccessComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history.component').then((m) => m.HistoryComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
