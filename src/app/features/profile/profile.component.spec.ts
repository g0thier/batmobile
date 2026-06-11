import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { CurrentUserProfileService } from '../../core/profile/current-user-profile';
import { SensorOrientationService } from '../../core/sensor-orientation/sensor-orientation.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let sensorOrientationServiceSpy: jasmine.SpyObj<SensorOrientationService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['signOut']);
    authServiceSpy.signOut.and.resolveTo();
    sensorOrientationServiceSpy = jasmine.createSpyObj<SensorOrientationService>('SensorOrientationService', [
      'startListening',
      'stopListening',
    ]);
    sensorOrientationServiceSpy.startListening.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: SensorOrientationService, useValue: sensorOrientationServiceSpy },
        {
          provide: CurrentUserProfileService,
          useValue: {
            setProfilePictureCache: jasmine.createSpy('setProfilePictureCache'),
            clearProfilePictureCache: jasmine.createSpy('clearProfilePictureCache'),
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

  it('caches the captured profile photo', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const profilePhotoCacheSpy = TestBed.inject(CurrentUserProfileService) as unknown as {
      setProfilePictureCache: jasmine.Spy;
    };

    fixture.componentInstance.onProfilePhotoCaptured('data:image/png;base64,abc');

    expect(profilePhotoCacheSpy.setProfilePictureCache).toHaveBeenCalledWith('data:image/png;base64,abc');
  });

  it('clears the cached profile photo', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const profilePhotoCacheSpy = TestBed.inject(CurrentUserProfileService) as unknown as {
      clearProfilePictureCache: jasmine.Spy;
    };

    fixture.componentInstance.onProfilePhotoDeleted();

    expect(profilePhotoCacheSpy.clearProfilePictureCache).toHaveBeenCalled();
  });

  it('starts orientation listening when the 3d preview is requested', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);

    await fixture.componentInstance.onProfile3DRequested();

    expect(sensorOrientationServiceSpy.startListening).toHaveBeenCalled();
  });
});
