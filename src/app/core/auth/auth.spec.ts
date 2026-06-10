import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { FirebaseError } from 'firebase/app';
import { AuthService } from './auth';
import { firebaseAuth } from '../../testing/firebase-test-modules';
import { SCREENSHOT_AUTH_EMAIL, SCREENSHOT_AUTH_PASSWORD } from '../../../environments/screenshot.env';

describe('AuthService', () => {
  const authStub = {} as Auth;
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: Auth, useValue: authStub }],
    });

    service = TestBed.inject(AuthService);
  });

  it('signs in with email and password', async () => {
    const signInSpy = spyOn(firebaseAuth, 'signInWithEmailAndPassword').and.resolveTo({} as never);

    await service.signInWithEmail(SCREENSHOT_AUTH_EMAIL, SCREENSHOT_AUTH_PASSWORD);

    expect(signInSpy).toHaveBeenCalledWith(authStub, SCREENSHOT_AUTH_EMAIL, SCREENSHOT_AUTH_PASSWORD);
  });

  it('maps sign in errors to friendly messages', async () => {
    spyOn(firebaseAuth, 'signInWithEmailAndPassword').and.rejectWith(
      new FirebaseError('auth/wrong-password', 'Wrong password'),
    );

    await expectAsync(service.signInWithEmail('ada@example.com', 'wrong')).toBeRejectedWithError(
      'Email ou mot de passe incorrect.',
    );
  });

  it('ignores missing users when resetting a password', async () => {
    spyOn(firebaseAuth, 'sendPasswordResetEmail').and.rejectWith(
      new FirebaseError('auth/user-not-found', 'Missing user'),
    );

    await expectAsync(service.resetPassword('ghost@example.com')).toBeResolved();
  });

  it('maps sign out errors to friendly messages', async () => {
    spyOn(firebaseAuth, 'signOut').and.rejectWith(new FirebaseError('auth/network-request-failed', 'Offline'));

    await expectAsync(service.signOut()).toBeRejectedWithError('Problème réseau. Vérifie ta connexion internet.');
  });
});
