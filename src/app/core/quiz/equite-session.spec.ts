import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { EquiteSession } from './equite-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('EquiteSession', () => {
  const database = {} as Database;
  let service: EquiteSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EquiteSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(EquiteSession);
  });

  it('loads the atlas once', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Équité',
          themes: [{ id: 1, label: 'T1' }],
          oppositions: [{ id: 1, theme: 1, label: 'Opposition 1' }],
          reponses: [
            { id: 1, label: 'Gauche', valeur: -1 },
            { id: 2, label: 'Droite', valeur: 1 },
          ],
        }),
      ),
    );

    await service.loadAtlas();
    await service.loadAtlas();

    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it('submits an answer and returns a completion result', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Équité',
          themes: [{ id: 1, label: 'T1' }],
          oppositions: [{ id: 1, theme: 1, label: 'Opposition 1' }],
          reponses: [
            { id: 1, label: 'Gauche', valeur: -1 },
            { id: 2, label: 'Droite', valeur: 1 },
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
      oppositionId: 1,
      themeId: 1,
      responseId: 2,
    });

    expect(setSpy).toHaveBeenCalled();
    expect(result).toEqual({
      answeredCount: 1,
      remainingCount: 0,
      isCompleted: true,
    });
  });
});
