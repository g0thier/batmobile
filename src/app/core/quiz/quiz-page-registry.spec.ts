import { QUIZ_SESSION_PAGE_LOADERS, QUIZ_STATS_PAGE_LOADERS, isQuizId } from './quiz-page-registry';
import { AttentesQuizComponent } from '../../features/quiz/pages/attentes/attentes-quiz/attentes-quiz.component';
import { AttentesStatsComponent } from '../../features/history/stats/attentes/attentes-stats/attentes-stats.component';

describe('quiz page registry', () => {
  it('recognizes the known quiz ids', () => {
    expect(isQuizId('attentes')).toBeTrue();
    expect(isQuizId('unknown')).toBeFalse();
  });

  it('exposes loaders for every quiz', () => {
    expect(Object.keys(QUIZ_SESSION_PAGE_LOADERS)).toEqual([
      'theorie-x-y',
      'identite-pro',
      'pyramide-besoins',
      'autodetermination',
      'attentes',
      'equite',
      'besoins-acquis',
      'mimetisme',
    ]);
    expect(Object.keys(QUIZ_STATS_PAGE_LOADERS)).toEqual([
      'theorie-x-y',
      'identite-pro',
      'pyramide-besoins',
      'autodetermination',
      'attentes',
      'equite',
      'besoins-acquis',
      'mimetisme',
    ]);
  });

  it('loads the expected quiz page components', async () => {
    const sessionComponent = await QUIZ_SESSION_PAGE_LOADERS['attentes']();
    const statsComponent = await QUIZ_STATS_PAGE_LOADERS['attentes']();

    expect(sessionComponent).toBe(AttentesQuizComponent);
    expect(statsComponent).toBe(AttentesStatsComponent);
  });
});
