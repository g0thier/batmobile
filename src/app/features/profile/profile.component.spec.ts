import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { CurrentUserProfileService } from '../../core/profile/current-user-profile';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['signOut']);
    authServiceSpy.signOut.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceSpy },
        {
          provide: CurrentUserProfileService,
          useValue: {
            state$: of({
              profile: {
                profilePicture: '',
                firstName: 'Ada',
                lastName: 'Lovelace',
                jobTitle: 'Manager',
                emailAddress: 'ada@example.com',
                phoneNumber: '',
                officeLocation: '',
              },
              subscription: {
                planKey: 'pro',
                planLabel: 'Pro',
                status: 'active',
                currentPeriodEnd: '',
                cancelAtPeriodEnd: false,
                lastPaymentStatus: '',
              },
              isLoading: false,
              loadError: '',
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('formats profile and subscription data', () => {
    const fixture = TestBed.createComponent(ProfileComponent);

    expect(fixture.componentInstance.getFullName({
      profilePicture: '',
      firstName: 'Ada',
      lastName: 'Lovelace',
      jobTitle: '',
      emailAddress: '',
      phoneNumber: '',
      officeLocation: '',
    })).toBe('Ada Lovelace');
    expect(fixture.componentInstance.getDisplayValue('  ')).toBe('Non renseigné');
    expect(fixture.componentInstance.getSubscriptionStatusLabel({
      planKey: '',
      planLabel: '',
      status: 'active',
      currentPeriodEnd: '',
      cancelAtPeriodEnd: false,
      lastPaymentStatus: '',
    })).toBe('Actif');
  });

  it('signs out and redirects to login', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);

    await fixture.componentInstance.onSignOut();

    expect(authServiceSpy.signOut).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});

