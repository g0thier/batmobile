import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { QuizCatalogService } from '../quiz/quiz-catalog.service';
import {
  SuccessProgressService,
  buildSuccessPageState,
  type SuccessLiveSessionSnapshot,
} from './success-progress';
import { createTestUser } from '../../testing/spec-helpers';
import {
  assiduityTimeline,
  catalogSnapshots,
  createSuccessProgressProviders,
  createSuccessSnapshot,
  duplicateTimelineSnapshots,
  questionMilestoneTimeline,
  quizCatalogForSuccessProgressTests as quizCatalog,
  recordSnapshots,
  toIso,
} from '../../testing/success-progress-fixtures';

describe('success progress', () => {
  it('unlocks the hidden question milestones progressively', () => {
    const state = buildSuccessPageState([createSuccessSnapshot('attentes')], questionMilestoneTimeline, quizCatalog);
    const cards = state.sections.find((section) => section.id === 'questions')?.cards;

    expect(cards?.map((card) => card.isUnlocked)).toEqual([true, true, true, false]);
    expect(cards?.map((card) => card.title)).toEqual(['Explorateur', 'Aventurier', 'Héros', 'Légendaire']);
    expect(cards?.map((card) => card.coverUrl)).toEqual([
      '/success/milestone/explorateur.webp',
      '/success/milestone/aventurier.webp',
      '/success/milestone/heros.webp',
      '/success/milestone/legendaire.webp',
    ]);
  });

  it('unlocks the catalog card only when every quiz is completed at least once', () => {
    const cards = buildSuccessPageState(catalogSnapshots, [toIso(1)], quizCatalog).sections.find(
      (section) => section.id === 'catalog',
    )?.cards;

    expect(cards?.filter((card) => card.id !== 'all-quizzes').every((card) => card.isUnlocked)).toBeTrue();
    expect(cards?.find((card) => card.id === 'all-quizzes')?.isUnlocked).toBeTrue();
  });

  it('unlocks record cards when a later session beats a previous best', () => {
    const cards = buildSuccessPageState(
      recordSnapshots,
      [toIso(1), toIso(6), toIso(15), toIso(30), toIso(45), toIso(48)],
      quizCatalog,
    ).sections.find((section) => section.id === 'records')?.cards;

    expect(cards?.every((card) => card.isUnlocked)).toBeTrue();
    expect(cards?.length).toBe(6);
    expect(cards?.map((card) => card.coverUrl)).toEqual([
      quizCatalog.getQuiz('attentes').coverUrl,
      quizCatalog.getQuiz('autodetermination').coverUrl,
      quizCatalog.getQuiz('equite').coverUrl,
      quizCatalog.getQuiz('identite-pro').coverUrl,
      quizCatalog.getQuiz('pyramide-besoins').coverUrl,
      quizCatalog.getQuiz('theorie-x-y').coverUrl,
    ]);
  });

  it('unlocks assiduity milestones when responses become close enough', () => {
    const cards = buildSuccessPageState([createSuccessSnapshot('attentes')], assiduityTimeline, quizCatalog).sections.find(
      (section) => section.id === 'rhythm',
    )?.cards;

    expect(cards?.map((card) => card.isUnlocked)).toEqual([true, true, true, false, false]);
    expect(cards?.map((card) => card.title)).toEqual(['Tortue', 'Lièvre', 'Gazelle', 'Faucon', 'Guépard']);
    expect(cards?.map((card) => card.coverUrl)).toEqual([
      '/success/assiduite/tortue.webp',
      '/success/assiduite/lievre.webp',
      '/success/assiduite/gazelle.webp',
      '/success/assiduite/faucon.webp',
      '/success/assiduite/guepard.webp',
    ]);
  });

  it('keeps a stable state when duplicate timestamps are present', () => {
    const state = buildSuccessPageState(duplicateTimelineSnapshots, [toIso(1), toIso(2), toIso(2)], quizCatalog);

    expect(state.overviewCards[0]?.value).toBe('2');
    expect(state.sections.find((section) => section.id === 'questions')?.cards?.[0]?.isUnlocked).toBeFalse();
  });

  it('emits an empty dashboard when nobody is signed in', async () => {
    const authUser$ = new BehaviorSubject<ReturnType<typeof createTestUser> | null>(null);

    TestBed.configureTestingModule({
      providers: [SuccessProgressService, QuizCatalogService, ...createSuccessProgressProviders(authUser$)],
    });

    const state = await firstValueFrom(TestBed.inject(SuccessProgressService).state$);

    expect(state.isLoading).toBeFalse();
    expect(state.sections).toEqual([]);
  });

  it('builds a live dashboard from snapshot data', async () => {
    const authUser$ = new BehaviorSubject<ReturnType<typeof createTestUser> | null>(createTestUser());

    TestBed.configureTestingModule({
      providers: [SuccessProgressService, QuizCatalogService, ...createSuccessProgressProviders(authUser$)],
    });

    const service = TestBed.inject(SuccessProgressService);
    spyOn<any>(service, 'buildLiveState').and.resolveTo({
      snapshots: [
        createSuccessSnapshot('attentes', {
          sessionId: 'session-attentes',
          updatedAt: toIso(1),
          lastAnsweredAt: toIso(1),
          status: 'completed',
        }) as SuccessLiveSessionSnapshot,
      ],
      answerTimeline: [toIso(1), toIso(2)],
    });

    const state = await firstValueFrom(service.state$);

    expect(state.overviewCards[0]?.value).toBe('2');
    expect(state.sections.find((section) => section.id === 'catalog')?.cards.some((card) => card.isUnlocked)).toBeTrue();
  });
});
