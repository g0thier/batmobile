import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { IdentiteProSession } from './identite-pro-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('IdentiteProSession', () => {
  const database = {} as Database;
  let service: IdentiteProSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IdentiteProSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(IdentiteProSession);
  });

  it('loads the atlas once and can answer a question', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          nom: 'Identité Pro',
          titre: 'Identité Pro',
          dimensions_identite: [
            { id: 1, key: 'identite_de_soi', label: 'Je suis...' },
          ],
          themes: [{ id: 1, label: 'T1' }],
          reponses: [
            { id: 1, label: 'Faible', valeur: 0 },
            { id: 2, label: 'Fort', valeur: 1 },
          ],
          traits: [{ id: 1, label: 'Trait 1', image: '', theme: 1 }],
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

    const prompt = await service.getPromptForSession('session-1', 'user-1');
    const result = await service.submitAnswer('session-1', 'user-1', {
      dimensionId: 1,
      traitId: 1,
      themeId: 1,
      responseId: 2,
    });

    expect(prompt.question?.dimension.key).toBe('identite_de_soi');
    expect(setSpy).toHaveBeenCalled();
    expect(result.isCompleted).toBeTrue();
  });
});
