import { Type } from '@angular/core';
import { QuizId } from './quiz-catalog.service';

export type QuizPageLoader = () => Promise<Type<unknown>>;

export const QUIZ_SESSION_PAGE_LOADERS: Record<QuizId, QuizPageLoader> = {
  'theorie-x-y': () =>
    import('../../features/quiz/pages/theorie-x-y/theorie-x-y-quiz/theorie-x-y-quiz.component').then(
      (m) => m.TheorieXYQuizComponent,
    ),
  'identite-pro': () =>
    import('../../features/quiz/pages/identite-pro/identite-pro-quiz/identite-pro-quiz.component').then(
      (m) => m.IdentiteProQuizComponent,
    ),
  'pyramide-besoins': () =>
    import(
      '../../features/quiz/pages/pyramide-besoins/pyramide-besoins-quiz/pyramide-besoins-quiz.component'
    ).then((m) => m.PyramideBesoinsQuizComponent),
  autodetermination: () =>
    import(
      '../../features/quiz/pages/autodetermination/autodetermination-quiz/autodetermination-quiz.component'
    ).then((m) => m.AutodeterminationQuizComponent),
  attentes: () =>
    import('../../features/quiz/pages/attentes/attentes-quiz/attentes-quiz.component').then(
      (m) => m.AttentesQuizComponent,
    ),
  equite: () =>
    import('../../features/quiz/pages/equite/equite-quiz/equite-quiz.component').then(
      (m) => m.EquiteQuizComponent,
    ),
  'besoins-acquis': () =>
    import(
      '../../features/quiz/pages/besoins-acquis/besoins-acquis-quiz/besoins-acquis-quiz.component'
    ).then((m) => m.BesoinsAcquisQuizComponent),
  mimetisme: () =>
    import('../../features/quiz/pages/mimetisme/mimetisme-quiz/mimetisme-quiz.component').then(
      (m) => m.MimetismeQuizComponent,
    ),
};

export const QUIZ_STATS_PAGE_LOADERS: Record<QuizId, QuizPageLoader> = {
  'theorie-x-y': () =>
    import(
      '../../features/history/stats/theorie-x-y/theorie-x-y-stats/theorie-x-y-stats.component'
    ).then((m) => m.TheorieXYStatsComponent),
  'identite-pro': () =>
    import(
      '../../features/history/stats/identite-pro/identite-pro-stats/identite-pro-stats.component'
    ).then((m) => m.IdentiteProStatsComponent),
  'pyramide-besoins': () =>
    import(
      '../../features/history/stats/pyramide-besoins/pyramide-besoins-stats/pyramide-besoins-stats.component'
    ).then((m) => m.PyramideBesoinsStatsComponent),
  autodetermination: () =>
    import(
      '../../features/history/stats/autodetermination/autodetermination-stats/autodetermination-stats.component'
    ).then((m) => m.AutodeterminationStatsComponent),
  attentes: () =>
    import('../../features/history/stats/attentes/attentes-stats/attentes-stats.component').then(
      (m) => m.AttentesStatsComponent,
    ),
  equite: () =>
    import('../../features/history/stats/equite/equite-stats/equite-stats.component').then(
      (m) => m.EquiteStatsComponent,
    ),
  'besoins-acquis': () =>
    import(
      '../../features/history/stats/besoins-acquis/besoins-acquis-stats/besoins-acquis-stats.component'
    ).then((m) => m.BesoinsAcquisStatsComponent),
  mimetisme: () =>
    import('../../features/history/stats/mimetisme/mimetisme-stats/mimetisme-stats.component').then(
      (m) => m.MimetismeStatsComponent,
    ),
};

export const isQuizId = (value: string): value is QuizId =>
  Object.prototype.hasOwnProperty.call(QUIZ_SESSION_PAGE_LOADERS, value);
