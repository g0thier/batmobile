export interface MockDataSnapshot<T = unknown> {
  exists(): boolean;
  val(): T;
}

export type Unsubscribe = () => void;

export interface MockDatabaseReference {
  database: unknown;
  path: string;
}

type MockDatabaseMethod<TArgs extends any[] = any[], TResult = any> = (...args: TArgs) => TResult;

const defaultRef: MockDatabaseMethod<[unknown, string?], MockDatabaseReference> = (_database: unknown, path?: string) => ({
  database: _database,
  path: String(path ?? ''),
});

const defaultGet: MockDatabaseMethod<[MockDatabaseReference], Promise<MockDataSnapshot>> = async () => ({
  exists: () => false,
  val: () => undefined,
});

const defaultOnValue: MockDatabaseMethod<
  [MockDatabaseReference, (snapshot: MockDataSnapshot) => void, ((error: Error) => void)?],
  Unsubscribe
> = (
  _reference: MockDatabaseReference,
  _next: (snapshot: MockDataSnapshot) => void,
) => () => undefined;

const defaultSet: MockDatabaseMethod<[MockDatabaseReference, unknown], Promise<void>> = async () => undefined;

export const firebaseDatabase = {
  ref: defaultRef,
  get: defaultGet,
  onValue: defaultOnValue,
  set: defaultSet,
};

export const resetFirebaseDatabaseMock = (): void => {
  firebaseDatabase.ref = defaultRef;
  firebaseDatabase.get = defaultGet;
  firebaseDatabase.onValue = defaultOnValue;
  firebaseDatabase.set = defaultSet;
};

export const ref = (...args: Parameters<typeof defaultRef>) => firebaseDatabase.ref(...args);
export const get = (...args: Parameters<typeof defaultGet>) => firebaseDatabase.get(...args);
export const onValue = (...args: Parameters<typeof defaultOnValue>) => firebaseDatabase.onValue(...args);
export const set = (...args: Parameters<typeof defaultSet>) => firebaseDatabase.set(...args);
