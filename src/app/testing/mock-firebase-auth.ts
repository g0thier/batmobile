import { BehaviorSubject, Observable } from 'rxjs';

type AuthMethod = (...args: any[]) => Promise<unknown>;

export interface MockUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

const defaultAuthMethod: AuthMethod = async () => undefined;

export const firebaseAuth = {
  authUser$: new BehaviorSubject<MockUser | null>(null),
  authState(_auth: unknown): Observable<MockUser | null> {
    return this.authUser$.asObservable();
  },
  signInWithEmailAndPassword: defaultAuthMethod,
  sendPasswordResetEmail: defaultAuthMethod,
  signOut: defaultAuthMethod,
};

export const resetFirebaseAuthMock = (): void => {
  firebaseAuth.authUser$.next(null);
  firebaseAuth.signInWithEmailAndPassword = defaultAuthMethod;
  firebaseAuth.sendPasswordResetEmail = defaultAuthMethod;
  firebaseAuth.signOut = defaultAuthMethod;
};

export const authState = (auth: unknown): Observable<MockUser | null> => firebaseAuth.authState(auth);
export const signInWithEmailAndPassword: AuthMethod = (...args) =>
  firebaseAuth.signInWithEmailAndPassword(...args);
export const sendPasswordResetEmail: AuthMethod = (...args) =>
  firebaseAuth.sendPasswordResetEmail(...args);
export const signOut: AuthMethod = (...args) => firebaseAuth.signOut(...args);
