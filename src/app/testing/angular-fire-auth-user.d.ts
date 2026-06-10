import type { MockUser } from './mock-firebase-auth';

declare module '@angular/fire/auth' {
  export type User = MockUser;
}
