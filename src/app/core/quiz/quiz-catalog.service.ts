import { Injectable } from '@angular/core';

export interface QuizCatalogItem {
  id: string;
  title: string;
  coverUrl: string;
}

const QUIZ_CATALOG_BY_ID: Record<string, QuizCatalogItem> = {
  'theorie-x-y': {
    id: 'theorie-x-y',
    title: 'Théorie X-Y',
    coverUrl: '/quiz/covers/theorie-x-y.png',
  },
  'identite-pro': {
    id: 'identite-pro',
    title: 'Identité Pro',
    coverUrl: '/quiz/covers/identite-pro.png',
  },
  'pyramide-besoins': {
    id: 'pyramide-besoins',
    title: 'Besoins de Maslow',
    coverUrl: '/quiz/covers/pyramide-besoins.png',
  },
  autodetermination: {
    id: 'autodetermination',
    title: 'Autodétermination',
    coverUrl: '/quiz/covers/autodetermination.png',
  },
  attentes: {
    id: 'attentes',
    title: 'Attentes',
    coverUrl: '/quiz/covers/attentes.png',
  },
  equite: {
    id: 'equite',
    title: 'Équité',
    coverUrl: '/quiz/covers/equite.png',
  },
  'besoins-acquis': {
    id: 'besoins-acquis',
    title: 'Besoins acquis',
    coverUrl: '/quiz/covers/besoins-acquis.png',
  },
  mimetisme: {
    id: 'mimetisme',
    title: 'Mimétisme',
    coverUrl: '/quiz/covers/mimetisme.png',
  },
};

const normalizeQuizId = (quizId: string): string => quizId.trim().toLowerCase();

@Injectable({
  providedIn: 'root',
})
export class QuizCatalogService {
  getQuiz(quizId: string): QuizCatalogItem {
    const normalizedQuizId = normalizeQuizId(quizId);
    if (!normalizedQuizId) {
      return {
        id: '',
        title: 'Quiz motivation',
        coverUrl: '',
      };
    }

    return (
      QUIZ_CATALOG_BY_ID[normalizedQuizId] ?? {
        id: normalizedQuizId,
        title: 'Quiz motivation',
        coverUrl: '',
      }
    );
  }

  getQuizTitle(quizId: string): string {
    return this.getQuiz(quizId).title;
  }
}
