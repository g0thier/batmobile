import { Injectable } from '@angular/core';

export type QuizId =
  | 'theorie-x-y'
  | 'identite-pro'
  | 'pyramide-besoins'
  | 'autodetermination'
  | 'attentes'
  | 'equite'
  | 'besoins-acquis'
  | 'mimetisme';

export interface QuizCatalogItem {
  id: QuizId | string;
  title: string;
  coverUrl: string;
}

const QUIZ_CATALOG_BY_ID: Record<QuizId, QuizCatalogItem> = {
  'theorie-x-y': {
    id: 'theorie-x-y',
    title: 'Théorie X-Y',
    coverUrl: '/quiz/covers/theorie-x-y.webp',
  },
  'identite-pro': {
    id: 'identite-pro',
    title: 'Identité Pro',
    coverUrl: '/quiz/covers/identite-pro.webp',
  },
  'pyramide-besoins': {
    id: 'pyramide-besoins',
    title: 'Besoins de Maslow',
    coverUrl: '/quiz/covers/pyramide-besoins.webp',
  },
  autodetermination: {
    id: 'autodetermination',
    title: 'Autodétermination',
    coverUrl: '/quiz/covers/autodetermination.webp',
  },
  attentes: {
    id: 'attentes',
    title: 'Attentes',
    coverUrl: '/quiz/covers/attentes.webp',
  },
  equite: {
    id: 'equite',
    title: 'Équité',
    coverUrl: '/quiz/covers/equite.webp',
  },
  'besoins-acquis': {
    id: 'besoins-acquis',
    title: 'Besoins acquis',
    coverUrl: '/quiz/covers/besoins-acquis.webp',
  },
  mimetisme: {
    id: 'mimetisme',
    title: 'Mimétisme',
    coverUrl: '/quiz/covers/mimetisme.webp',
  },
};

const KNOWN_QUIZ_IDS = Object.keys(QUIZ_CATALOG_BY_ID) as QuizId[];

const normalizeQuizId = (quizId: string): string => quizId.trim().toLowerCase();

@Injectable({
  providedIn: 'root',
})
export class QuizCatalogService {
  getKnownQuizIds(): QuizId[] {
    return [...KNOWN_QUIZ_IDS];
  }

  isKnownQuizId(quizId: string): quizId is QuizId {
    const normalizedQuizId = normalizeQuizId(quizId);
    return KNOWN_QUIZ_IDS.includes(normalizedQuizId as QuizId);
  }

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
      QUIZ_CATALOG_BY_ID[normalizedQuizId as QuizId] ?? {
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
