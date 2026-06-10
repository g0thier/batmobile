import type { User } from '@angular/fire/auth';

export interface TestSnapshot<T> {
  exists(): boolean;
  val(): T;
}

export const createPresentSnapshot = <T>(value: T): TestSnapshot<T> => ({
  exists: () => true,
  val: () => value,
});

export const createMissingSnapshot = <T>(): TestSnapshot<T> => ({
  exists: () => false,
  val: () => undefined as never,
});

export const createFetchResponse = <T>(payload: T, ok = true): Response =>
  ({
    ok,
    json: async () => payload,
  }) as Response;

export const createTestUser = (overrides: Partial<User> = {}): User =>
  ({
    uid: 'user-1',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    photoURL: 'https://example.com/avatar.png',
    ...overrides,
  }) as User;

