import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tabs/quiz',
  },
  {
    path: 'tabs',
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
    redirectTo: 'tabs/quiz',
  },
];
