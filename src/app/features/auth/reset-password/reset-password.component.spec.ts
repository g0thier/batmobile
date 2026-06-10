import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/auth/auth';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['resetPassword']);
    authServiceSpy.resetPassword.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceSpy }, provideIonicAngular()],
    }).compileComponents();
  });

  it('validates the email before sending a reset link', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.componentInstance.email = 'not-an-email';

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage).toBe('Saisis une adresse email valide.');
    expect(authServiceSpy.resetPassword).not.toHaveBeenCalled();
  });

  it('sends the reset email and marks the form as sent', async () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.componentInstance.email = '  ada@example.com  ';

    fixture.componentInstance.onSubmit();
    await Promise.resolve();

    expect(authServiceSpy.resetPassword).toHaveBeenCalledWith('ada@example.com');
    expect(fixture.componentInstance.sent).toBeTrue();
  });
});
