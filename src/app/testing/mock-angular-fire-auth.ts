import { Observable } from 'rxjs';
import { firebaseAuth, type MockUser } from './mock-firebase-auth';

export class Auth {}

export const authState = (_auth: Auth): Observable<MockUser | null> => firebaseAuth.authState(_auth);
export const signInWithEmailAndPassword = (...args: Parameters<typeof firebaseAuth.signInWithEmailAndPassword>) =>
  firebaseAuth.signInWithEmailAndPassword(...args);
export const sendPasswordResetEmail = (...args: Parameters<typeof firebaseAuth.sendPasswordResetEmail>) =>
  firebaseAuth.sendPasswordResetEmail(...args);
export const signOut = (...args: Parameters<typeof firebaseAuth.signOut>) => firebaseAuth.signOut(...args);

export const getAuth = (): Auth => new Auth();
export const provideAuth = (): never[] => [];
