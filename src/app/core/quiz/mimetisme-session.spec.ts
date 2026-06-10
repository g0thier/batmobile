import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { createFetchResponse, createPresentSnapshot } from '../../testing/spec-helpers';
import { MimetismeSession } from './mimetisme-session';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('MimetismeSession', () => {
  const database = {} as Database;
  let service: MimetismeSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MimetismeSession, { provide: Database, useValue: database }],
    });

    service = TestBed.inject(MimetismeSession);
  });

  it('loads the atlas once and returns a completed prompt when ranking is finished', async () => {
    spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(
        createFetchResponse({
          titre: 'Mimétisme',
          inspiration: [
            { id: 1, label: 'Inspiration 1' },
            { id: 2, label: 'Inspiration 2' },
          ],
          modèles: [
            { id: 1, personnage: 'A', portrait: '', inspiration: 1 },
            { id: 2, personnage: 'B', portrait: '', inspiration: 2 },
          ],
        }),
      ),
    );
    spyOn(firebaseDatabase, 'ref').and.callFake((...args: any[]) => ({ path: args[1] ?? '' } as never));
    spyOn(firebaseDatabase, 'get').and.callFake(async () =>
      createPresentSnapshot({
        status: 'started',
        updatedAt: '',
        responses: [],
        rankingState: {
          sortedModelIds: [1, 2],
          pendingModelIds: [],
          currentModelId: null,
          low: 0,
          high: 0,
          comparisons: 0,
          finished: true,
        },
        ranking: {
          orderedModelIds: [1, 2],
          orderedInspirationIds: [1, 2],
        },
      }) as any,
    );

    const prompt = await service.getPromptForSession('session-1', 'user-1');

    expect(prompt.isCompleted).toBeTrue();
    expect(prompt.pair).toBeNull();
    expect(prompt.rankedCount).toBe(2);
  });
});
