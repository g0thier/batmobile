import { firebaseDatabase, type MockDatabaseReference, type MockDataSnapshot, type Unsubscribe } from './mock-firebase-database';

export class Database {}

export type Reference = MockDatabaseReference;
export type DataSnapshot<T = unknown> = MockDataSnapshot<T>;
export type UnsubscribeFn = Unsubscribe;

export const ref = (...args: Parameters<typeof firebaseDatabase.ref>) => firebaseDatabase.ref(...args);
export const get = (...args: Parameters<typeof firebaseDatabase.get>) => firebaseDatabase.get(...args);
export const onValue = (...args: Parameters<typeof firebaseDatabase.onValue>) => firebaseDatabase.onValue(...args);
export const set = (...args: Parameters<typeof firebaseDatabase.set>) => firebaseDatabase.set(...args);

export const getDatabase = (): Database => new Database();
export const provideDatabase = (): never[] => [];
