import { inject, Injectable } from '@angular/core';
import { Database } from '@angular/fire/database';
import { User } from '@angular/fire/auth';
import { onValue, ref, Unsubscribe } from 'firebase/database';
import { BehaviorSubject, Observable, of, shareReplay, Subscription, switchMap, tap } from 'rxjs';
import { AuthService } from '../auth/auth';

export interface UserProfileViewModel {
  profilePicture: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  emailAddress: string;
  phoneNumber: string;
  officeLocation: string;
}

export interface UserSubscriptionViewModel {
  planKey: string;
  planLabel: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  lastPaymentStatus: string;
}

export interface CurrentUserProfileState {
  profile: UserProfileViewModel;
  subscription: UserSubscriptionViewModel;
  isLoading: boolean;
  loadError: string;
}

const EMPTY_PROFILE: UserProfileViewModel = {
  profilePicture: '',
  firstName: '',
  lastName: '',
  jobTitle: '',
  emailAddress: '',
  phoneNumber: '',
  officeLocation: '',
};

const EMPTY_SUBSCRIPTION: UserSubscriptionViewModel = {
  planKey: '',
  planLabel: '',
  status: '',
  currentPeriodEnd: '',
  cancelAtPeriodEnd: false,
  lastPaymentStatus: '',
};

const INITIAL_STATE: CurrentUserProfileState = {
  profile: EMPTY_PROFILE,
  subscription: EMPTY_SUBSCRIPTION,
  isLoading: true,
  loadError: '',
};

const PROFILE_NOT_LOADED_ERROR = 'Impossible de charger le profil.';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  leader: 'Manager',
  colab: 'Collaborateur',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuit',
  starter: 'Starter',
  basic: 'Basic',
  pro: 'Pro',
  business: 'Business',
  premium: 'Premium',
  enterprise: 'Entreprise',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string => String(value ?? '').trim();

const parseDisplayName = (displayName: string): { firstName: string; lastName: string } => {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
};

const normalizeRoleLabel = (role: string): string => {
  const normalizedRole = readString(role).toLowerCase();
  if (!normalizedRole) {
    return '';
  }
  return ROLE_LABELS[normalizedRole] ?? normalizedRole;
};

const resolvePlanLabel = (planKey: string): string => {
  const normalizedPlan = readString(planKey).toLowerCase();
  if (!normalizedPlan) {
    return '';
  }
  return PLAN_LABELS[normalizedPlan] ?? normalizedPlan;
};

const resolveOfficeLocation = (officeData: Record<string, unknown>): string => {
  const alias = readString(officeData['alias']);
  if (alias) {
    return alias;
  }

  const city = readString(officeData['city']);
  if (city) {
    return city;
  }

  return readString(officeData['address']);
};

const toProfileViewModel = (
  userData: Record<string, unknown>,
  currentUser: User | null,
  cachedProfilePicture: string,
): UserProfileViewModel => {
  const fallbackName = parseDisplayName(readString(currentUser?.displayName));
  return {
    profilePicture:
      readString(cachedProfilePicture) ||
      readString(userData['photoURL']) ||
      readString(currentUser?.photoURL),
    firstName: readString(userData['firstName']) || fallbackName.firstName,
    lastName: readString(userData['lastName']) || fallbackName.lastName,
    jobTitle: normalizeRoleLabel(readString(userData['role'])),
    emailAddress: readString(userData['email']) || readString(currentUser?.email),
    phoneNumber: readString(userData['phone']),
    officeLocation: '',
  };
};

const toSubscriptionViewModel = (
  companyData: Record<string, unknown>,
): UserSubscriptionViewModel => {
  const billingData = asRecord(companyData['billing']);
  const rawCurrentPeriodEnd = billingData['currentPeriodEnd'] ?? billingData['current_period_end'] ?? '';
  const planKey = readString(companyData['plan'] ?? billingData['planKey']).toLowerCase();

  return {
    planKey,
    planLabel: resolvePlanLabel(planKey),
    status: readString(companyData['status'] ?? billingData['status']).toLowerCase(),
    currentPeriodEnd: readString(rawCurrentPeriodEnd),
    cancelAtPeriodEnd: Boolean(billingData['cancelAtPeriodEnd']),
    lastPaymentStatus: readString(asRecord(billingData['lastPayment'])['status']).toLowerCase(),
  };
};

@Injectable({
  providedIn: 'root',
})
export class CurrentUserProfileService {
  private readonly authService = inject(AuthService);
  private readonly database = inject(Database);
  private readonly profilePictureCache$ = new BehaviorSubject<string>('');

  readonly state$ = this.authService.authUser$.pipe(
    tap((currentUser) => {
      if (!currentUser) {
        this.profilePictureCache$.next('');
      }
    }),
    switchMap((currentUser) => {
      if (!currentUser) {
        return of({
          profile: EMPTY_PROFILE,
          subscription: EMPTY_SUBSCRIPTION,
          isLoading: false,
          loadError: '',
        } satisfies CurrentUserProfileState);
      }

      return new Observable<CurrentUserProfileState>((subscriber) => {
        let cachedProfilePicture = this.profilePictureCache$.value;
        let lastUserData: Record<string, unknown> = {};
        let currentState: CurrentUserProfileState = {
          ...INITIAL_STATE,
          profile: toProfileViewModel({}, currentUser, cachedProfilePicture),
        };
        let officeSubscriptionKey = '';
        let companySubscriptionKey = '';
        let unsubscribeUser: Unsubscribe = () => {};
        let unsubscribeOffice: Unsubscribe = () => {};
        let unsubscribeCompany: Unsubscribe = () => {};
        let unsubscribeCache = new Subscription();

        const emitState = () => {
          subscriber.next({
            ...currentState,
            profile: { ...currentState.profile },
            subscription: { ...currentState.subscription },
          });
        };

        const rebuildProfile = (userData: Record<string, unknown>): UserProfileViewModel => {
          const profile = toProfileViewModel(userData, currentUser, cachedProfilePicture);
          profile.officeLocation = currentState.profile.officeLocation;
          return profile;
        };

        const patchState = (nextPatch: Partial<CurrentUserProfileState>) => {
          currentState = {
            ...currentState,
            ...nextPatch,
          };
          emitState();
        };

        emitState();

        unsubscribeCache = this.profilePictureCache$.subscribe((profilePicture) => {
          cachedProfilePicture = profilePicture;
          patchState({
            profile: rebuildProfile(lastUserData),
          });
        });

        const userRef = ref(this.database, `users/${currentUser.uid}`);

        unsubscribeUser = onValue(
          userRef,
          (userSnapshot) => {
            const userData = userSnapshot.exists() ? asRecord(userSnapshot.val()) : {};
            lastUserData = userData;
            const companyId = readString(userData['companyId']);
            const officeId = readString(userData['officeId']);
            const nextOfficeSubscriptionKey = companyId && officeId ? `${companyId}/${officeId}` : '';
            const hasSameOfficeSubscription =
              nextOfficeSubscriptionKey && nextOfficeSubscriptionKey === officeSubscriptionKey;
            const hasSameCompanySubscription =
              companyId.length > 0 && companyId === companySubscriptionKey;

            patchState({
              profile: rebuildProfile(userData),
              isLoading: false,
              loadError: '',
            });

            if (!nextOfficeSubscriptionKey) {
              unsubscribeOffice();
              unsubscribeOffice = () => {};
              officeSubscriptionKey = '';
            }

            if (nextOfficeSubscriptionKey && !hasSameOfficeSubscription) {
              unsubscribeOffice();
              unsubscribeOffice = () => {};
              officeSubscriptionKey = nextOfficeSubscriptionKey;

              const officeRef = ref(this.database, `companies/${companyId}/addresses/${officeId}`);
              unsubscribeOffice = onValue(
                officeRef,
                (officeSnapshot) => {
                  const officeData = officeSnapshot.exists() ? asRecord(officeSnapshot.val()) : {};
                  patchState({
                    profile: {
                      ...currentState.profile,
                      officeLocation: resolveOfficeLocation(officeData),
                    },
                  });
                },
                (officeError: unknown) => {
                  console.error('Impossible de charger le bureau utilisateur :', officeError);
                },
              );
            }

            if (!companyId) {
              unsubscribeCompany();
              unsubscribeCompany = () => {};
              companySubscriptionKey = '';
              patchState({ subscription: EMPTY_SUBSCRIPTION });
            }

            if (companyId && !hasSameCompanySubscription) {
              unsubscribeCompany();
              unsubscribeCompany = () => {};
              companySubscriptionKey = companyId;

              const companyRef = ref(this.database, `companies/${companyId}`);
              unsubscribeCompany = onValue(
                companyRef,
                (companySnapshot) => {
                  const companyData = companySnapshot.exists() ? asRecord(companySnapshot.val()) : {};
                  patchState({ subscription: toSubscriptionViewModel(companyData) });
                },
                (companyError: unknown) => {
                  console.error("Impossible de charger l'abonnement entreprise :", companyError);
                },
              );
            }
          },
          (userError: unknown) => {
            console.error('Impossible de charger le profil utilisateur :', userError);
            patchState({
              isLoading: false,
              loadError: PROFILE_NOT_LOADED_ERROR,
            });
          },
        );

        return () => {
          unsubscribeCache.unsubscribe();
          unsubscribeUser();
          unsubscribeOffice();
          unsubscribeCompany();
        };
      });
    }),
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  setProfilePictureCache(profilePicture: string): void {
    this.profilePictureCache$.next(readString(profilePicture));
  }

  clearProfilePictureCache(): void {
    this.profilePictureCache$.next('');
  }
}
