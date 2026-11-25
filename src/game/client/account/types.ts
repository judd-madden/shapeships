import type { PlayerPreferences } from '../preferences/playerPreferences';

export interface AccountIdentity {
  readonly id: string;
  readonly displayName: string;
  readonly badge: 'claimed-name';
}

export interface AccountPreferences {
  readonly values: Readonly<PlayerPreferences>;
  readonly revision: string;
  readonly updatedAt: string;
}

export type PreferencePatch = Partial<PlayerPreferences>;

export interface AccountLink {
  readonly sessionId: string;
  readonly accountId: string;
  readonly displayName: string;
}

export interface AccountResumeBody {
  readonly ok: true;
  readonly account: AccountIdentity;
  readonly preferences: AccountPreferences;
  readonly expiresAt: string;
  readonly link?: AccountLink;
}

export interface AccountEntryBody extends AccountResumeBody {
  readonly accountToken: string;
  readonly link: AccountLink;
}

export interface NameCheckBody {
  readonly ok: true;
  readonly nameKey: string;
  readonly displayName: string;
  readonly outcome: 'available' | 'claimed' | 'banned' | 'reserved';
}

export interface PreferencesBody {
  readonly ok: true;
  readonly preferences: AccountPreferences;
}

export interface AccountOperationError {
  readonly code: string;
  readonly field?: string;
  readonly retryAfterSeconds?: number;
}

export interface AccountError extends AccountOperationError {
  readonly kind: 'error';
  readonly preferences?: AccountPreferences;
  readonly streak?: AccountStreakSnapshot;
}

export interface AccountUnavailable {
  readonly kind: 'unavailable';
  readonly retryAfterSeconds?: number;
}

export type AccountResult<T> = { readonly kind: 'ok'; readonly data: T } | AccountError | AccountUnavailable;

export interface SignInRequest {
  name: string;
  password: string;
  turnstileToken?: string;
}

export interface ClaimRequest extends SignInRequest {
  turnstileToken: string;
  preferences: Readonly<PlayerPreferences>;
}

export interface ChangePasswordRequest {
  name: string;
  currentPassword: string;
  newPassword: string;
  turnstileToken?: string;
}

export interface AccountApi {
  nameCheck(name: string): Promise<AccountResult<NameCheckBody>>;
  claim(request: ClaimRequest, sessionToken: string): Promise<AccountResult<AccountEntryBody>>;
  signIn(request: SignInRequest, sessionToken: string): Promise<AccountResult<AccountEntryBody>>;
  changePassword(request: ChangePasswordRequest, sessionToken: string): Promise<AccountResult<AccountEntryBody>>;
  resume(accountToken: string, sessionToken?: string): Promise<AccountResult<AccountResumeBody>>;
  logout(accountToken?: string): Promise<AccountResult<void>>;
  getPreferences(accountToken: string): Promise<AccountResult<PreferencesBody>>;
  putPreferences(accountToken: string, patch: PreferencePatch, expectedRevision: string): Promise<AccountResult<PreferencesBody>>;
}

export interface AccountStreakSnapshot {
  readonly accountId: string;
  readonly runId: string;
  readonly currentCount: number;
  readonly revision: string;
  readonly trackedGame: null | {
    readonly gameId: string;
    readonly humanPlayerId: string;
    readonly status: 'unfinished' | 'settled' | 'retired' | 'restart_pending';
  };
  readonly endedStreak: null | { readonly count: number; readonly endingGameId: string };
  readonly updatedAt: string;
}

export interface GuestStreakCandidate {
  readonly currentCount: number;
  readonly anchorGameId: string;
  readonly humanPlayerId: string;
  readonly resultPending: boolean;
}

export interface AccountStreakBody { readonly ok: true; readonly streak: AccountStreakSnapshot }
export interface AccountStreakImportBody extends AccountStreakBody {
  readonly import: {
    readonly anchorGameId: string;
    readonly selection: 'guest' | 'account' | 'declined';
    readonly acceptedCount: number;
    readonly continuation: 'none' | 'authorised';
  };
}
export interface AccountStreakApi {
  state(): Promise<AccountResult<AccountStreakBody>>;
  import(request: { expectedRevision: string; decision: 'compare' | 'decline'; guest: GuestStreakCandidate }): Promise<AccountResult<AccountStreakImportBody>>;
  reset(expectedRevision: string): Promise<AccountResult<AccountStreakBody>>;
}

export interface AccountClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface PreferenceSyncStatus {
  readonly saving: boolean;
  readonly unsaved: boolean;
}

export type AccountState =
  | { readonly status: 'signedOut'; readonly reason?: string }
  | { readonly status: 'resuming' }
  | {
      readonly status: 'signedIn';
      readonly identity: AccountIdentity;
      readonly preferences: AccountPreferences;
      readonly expiresAt: string;
      readonly linkedSessionId: string | null;
      readonly tokenPersistence: 'localStorage' | 'memory';
    }
  | { readonly status: 'passwordChangeRequired'; readonly name: string }
  | { readonly status: 'dormant' }
  | { readonly status: 'unavailable'; readonly retryAfterSeconds?: number };

export type AccountSnapshot = AccountState & {
  readonly lastError: AccountOperationError | null;
  readonly remoteLogoutPending: boolean;
  readonly preferenceSync: PreferenceSyncStatus;
};
