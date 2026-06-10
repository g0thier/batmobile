import { TestBed } from '@angular/core/testing';
import { QuizCatalogService } from './quiz-catalog.service';

describe('QuizCatalogService', () => {
  let service: QuizCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QuizCatalogService],
    });

    service = TestBed.inject(QuizCatalogService);
  });

  it('returns all known quiz ids', () => {
    expect(service.getKnownQuizIds()).toEqual([
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

  it('normalizes quiz ids before lookup', () => {
    expect(service.isKnownQuizId('  IDENTITE-PRO  ')).toBeTrue();
    expect(service.getQuizTitle('  equite  ')).toBe('Équité');
  });

  it('falls back to the motivation placeholder for unknown quizzes', () => {
    expect(service.getQuiz('')).toEqual({
      id: '',
      title: 'Quiz motivation',
      coverUrl: '',
    });

    expect(service.getQuiz('unknown')).toEqual({
      id: 'unknown',
      title: 'Quiz motivation',
      coverUrl: '',
    });
  });
});

