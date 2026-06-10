import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/auth/auth';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['signInWithEmail']);
    authServiceSpy.signInWithEmail.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();
  });

  it('validates the email before moving to the password step', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.email = 'not-an-email';

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage).toBe('Saisis une adresse email valide.');
    expect(fixture.componentInstance.step).toBe(1);
  });

  it('trims the email and advances to the password step', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.email = '  ada@example.com  ';

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.email).toBe('ada@example.com');
    expect(fixture.componentInstance.step).toBe(2);
  });

  it('signs in and navigates to the quiz shell', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.email = 'ada@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.componentInstance.step = 2;

    fixture.componentInstance.onSubmit();
    await Promise.resolve();

    expect(authServiceSpy.signInWithEmail).toHaveBeenCalledWith('ada@example.com', 'secret');
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/tabs/quiz', { replaceUrl: true });
  });
});
