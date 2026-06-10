import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { AutodeterminationSession } from './autodetermination-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('AutodeterminationSession', () => {
  const database = {} as Database;
  let service: AutodeterminationSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AutodeterminationSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(AutodeterminationSession);
  });

  it('caches the atlas payload', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Autodétermination',
          themes: [{ id: 1, label: 'T1' }],
          affirmations: [{ id: 1, theme: 1, label: 'A1' }],
          reponses: [
            { id: 1, label: 'Oui', valeur: 1 },
            { id: 2, label: 'Non', valeur: 0 },
          ],
        }),
      ),
    );

    await service.loadAtlas();
    await service.loadAtlas();

    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it('submits an answer and marks the quiz completed', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Autodétermination',
          themes: [{ id: 1, label: 'T1' }],
          affirmations: [{ id: 1, theme: 1, label: 'A1' }],
          reponses: [
            { id: 1, label: 'Oui', valeur: 1 },
            { id: 2, label: 'Non', valeur: 0 },
          ],
        }),
      ),
    );
    spyOn(firebaseDatabase, 'ref').and.callFake((...args: any[]) => ({ path: args[1] ?? '' } as never));
    spyOn(firebaseDatabase, 'get').and.callFake(async () =>
      createPresentSnapshot({
        status: 'invited',
        updatedAt: '',
        responses: [],
      }) as any,
    );
    const setSpy = spyOn(firebaseDatabase, 'set').and.resolveTo();

    const result = await service.submitAnswer('session-1', 'user-1', {
      affirmationId: 1,
      themeId: 1,
      responseId: 1,
    });

    expect(setSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ path: 'quizSessions/session-1/responsesByUser/user-1' }),
      jasmine.any(Object),
    );
    expect(result).toEqual({
      answeredCount: 1,
      remainingCount: 0,
      isCompleted: true,
    });
  });
});
