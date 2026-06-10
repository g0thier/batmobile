import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth';
import { createPresentSnapshot, createTestUser } from '../../testing/spec-helpers';
import { CurrentUserProfileService, type CurrentUserProfileState } from './current-user-profile';
import { firebaseDatabase } from '../../testing/firebase-test-modules';

describe('CurrentUserProfileService', () => {
  let authUser$: BehaviorSubject<ReturnType<typeof createTestUser> | null>;
  let service: CurrentUserProfileService;
  let refSpy: jasmine.Spy;
  let onValueSpy: jasmine.Spy;

  beforeEach(() => {
    authUser$ = new BehaviorSubject<ReturnType<typeof createTestUser> | null>(null);
    refSpy = spyOn(firebaseDatabase, 'ref').and.callFake((...args: any[]) => ({ path: args[1] ?? '' } as never));
    onValueSpy = spyOn(firebaseDatabase, 'onValue').and.callFake((reference: any, next: any) => {
      if (reference.path === 'users/user-1') {
        next(
          createPresentSnapshot({
            firstName: 'Ada',
            lastName: 'Lovelace',
            role: 'leader',
            email: 'ada@company.test',
            phone: '+41 22 000 00 00',
            companyId: 'company-1',
            officeId: 'office-1',
          }) as any,
        );
      }

      if (reference.path === 'companies/company-1/addresses/office-1') {
        next(
          createPresentSnapshot({
            alias: 'HQ',
            city: 'Zurich',
            address: 'Bahnhofstrasse 1',
          }) as any,
        );
      }

      if (reference.path === 'companies/company-1') {
        next(
          createPresentSnapshot({
            plan: 'pro',
            status: 'active',
            billing: {
              currentPeriodEnd: '2025-12-31T00:00:00.000Z',
              cancelAtPeriodEnd: false,
              lastPayment: {
                status: 'paid',
              },
            },
          }) as any,
        );
      }

      return jasmine.createSpy('unsubscribe');
    });

    TestBed.configureTestingModule({
      providers: [
        CurrentUserProfileService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { authUser$: authUser$.asObservable() } },
      ],
    });

    service = TestBed.inject(CurrentUserProfileService);
  });

  it('emits an empty state when nobody is signed in', async () => {
    const states: CurrentUserProfileState[] = [];
    const subscription = service.state$.subscribe((state) => states.push(state));

    await Promise.resolve();
    subscription.unsubscribe();

    expect(states.at(-1)).toEqual({
      profile: {
        profilePicture: '',
        firstName: '',
        lastName: '',
        jobTitle: '',
        emailAddress: '',
        phoneNumber: '',
        officeLocation: '',
      },
      subscription: {
        planKey: '',
        planLabel: '',
        status: '',
        currentPeriodEnd: '',
        cancelAtPeriodEnd: false,
        lastPaymentStatus: '',
      },
      isLoading: false,
      loadError: '',
    });
  });

  it('builds the profile and subscription from the live database snapshots', async () => {
    authUser$.next(createTestUser());

    const states: CurrentUserProfileState[] = [];
    const subscription = service.state$.subscribe((state) => states.push(state));

    await Promise.resolve();
    await Promise.resolve();
    subscription.unsubscribe();

    expect(refSpy).toHaveBeenCalledWith({}, 'users/user-1');
    expect(onValueSpy).toHaveBeenCalled();
    expect(states.at(-1)?.profile).toEqual({
      profilePicture: 'https://example.com/avatar.png',
      firstName: 'Ada',
      lastName: 'Lovelace',
      jobTitle: 'Manager',
      emailAddress: 'ada@company.test',
      phoneNumber: '+41 22 000 00 00',
      officeLocation: 'HQ',
    });
    expect(states.at(-1)?.subscription).toEqual({
      planKey: 'pro',
      planLabel: 'Pro',
      status: 'active',
      currentPeriodEnd: '2025-12-31T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      lastPaymentStatus: 'paid',
    });
  });
});
