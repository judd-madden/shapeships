import { isValidAccountName, type NameCheckResult } from './claimNameForm';
import type { AccountOperationError, ChangePasswordRequest, SignInRequest } from './types';
import type { NameCheckTimers } from './nameCheckScheduler';

export interface EntryNotice { name: string; code: string }
export interface EntryMessage { title: string; detail: string; discord?: boolean }
export type EntryResult = { kind: 'ok' } | { kind: 'passwordChangeRequired' }
  | { kind: 'error'; error: AccountOperationError } | { kind: 'cancelled' };
export interface EntryAccountActions {
  checkName(name: string): Promise<NameCheckResult>;
  invalidateNameChecks(): void;
  signIn(input: SignInRequest): Promise<EntryResult>;
  changePassword(input: ChangePasswordRequest): Promise<EntryResult>;
  retryRemembered(): Promise<EntryResult>;
  leaveSignIn(): void;
}
export interface PasswordChangeContext {
  name: string;
  displayName: string;
  temporaryPassword: string;
  captchaRequired: boolean;
}

export const ENTRY_NAME_ERROR = 'Name must be 3–20 letters or numbers only (no spaces or symbols)';
export const DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

export function mapEntryError(error: AccountOperationError, displayName: string): EntryMessage {
  switch (error.code) {
    case 'CLAIMED_NAME_REQUIRES_ACCOUNT': return {
      title: `Enter password for "${displayName}" or try a different name.`, detail: 'This name has been claimed.',
    };
    case 'INVALID_CREDENTIALS':
    case 'INVALID_PASSWORD': return { title: 'Incorrect Password.', detail: 'Please contact juddly via our Discord if you want to reset.', discord: true };
    case 'NAME_BANNED': return { title: 'This name is on the banned list.', detail: 'Please enter a different name.' };
    case 'NAME_RESERVED': return { title: 'This name is reserved.', detail: 'Please enter a different name.' };
    case 'ACCOUNT_BLOCKED': return { title: 'This account has been blocked.', detail: 'Please contact juddly via our Discord.', discord: true };
    case 'CAPTCHA_REQUIRED': return { title: 'Please complete the check below.', detail: 'Then press PLAY again.' };
    case 'CAPTCHA_INVALID':
    case 'CAPTCHA_REPLAY': return { title: 'Verification failed.', detail: 'Please complete the check again.' };
    case 'CAPTCHA_UNAVAILABLE': return { title: "Verification isn't available right now.", detail: 'Please try again later.' };
    case 'RATE_LIMITED': {
      const seconds = error.retryAfterSeconds;
      const amount = seconds === undefined ? undefined : seconds < 60 ? seconds : Math.ceil(seconds / 60);
      const unit = seconds !== undefined && seconds < 60 ? 'second' : 'minute';
      return { title: 'Too many attempts.', detail: amount === undefined ? 'Please try again later.'
        : `Please try again in ${amount} ${unit}${amount === 1 ? '' : 's'}.` };
    }
    case 'AUTH_BUSY': return { title: 'The server is busy.', detail: 'Please try again in a moment.' };
    case 'ACCOUNT_SERVICE_UNAVAILABLE':
    case 'INTERNAL_ERROR': return { title: "Couldn't reach the account service.", detail: 'Please try again.' };
    case 'GUEST_SESSION_FAILED': return { title: "Couldn't start your session.", detail: 'Please try again.' };
    default: return { title: "Couldn't sign in.", detail: 'Please try again.' };
  }
}

export function entryState(name: string, lookup: NameCheckResult, error?: AccountOperationError) {
  const checked = lookup?.kind === 'ok' ? lookup.data : undefined;
  const displayName = checked?.outcome === 'claimed' ? checked.displayName : name;
  const outcome = error?.code === 'NAME_BANNED' ? 'banned' : error?.code === 'NAME_RESERVED' ? 'reserved' : checked?.outcome;
  const formatError = /[^A-Za-z0-9]/.test(name) || name.length > 20 || error?.code === 'INVALID_NAME';
  const mode = outcome === 'banned' || outcome === 'reserved' ? outcome
    : outcome === 'claimed' || (error && !['GUEST_SESSION_FAILED', 'INVALID_NAME'].includes(error.code)) ? 'claimed' : 'guest';
  const messageCode = error?.code ?? (mode === 'claimed' ? 'CLAIMED_NAME_REQUIRES_ACCOUNT'
    : mode === 'banned' ? 'NAME_BANNED' : mode === 'reserved' ? 'NAME_RESERVED' : undefined);
  return { mode, displayName, formatError, message: !formatError && messageCode ? mapEntryError(error ?? { code: messageCode }, displayName) : undefined };
}

export function isEntryEnabled({ name, mode, password, captchaRequired, token, submitting, formatError }: {
  name: string; mode: string; password: string; captchaRequired: boolean; token: string | null;
  submitting: boolean; formatError?: boolean;
}): boolean {
  return isValidAccountName(name) && !formatError && !submitting && mode !== 'banned' && mode !== 'reserved'
    && (mode !== 'claimed' || (password.length > 0 && (!captchaRequired || Boolean(token))));
}

/** Only lookup waiting is bounded; the existing guest session request keeps its own timeout. */
export async function resolveEntryPlay(name: string, scheduler: {
  flush(name: string): Promise<NameCheckResult>; cancel(): void;
}, timers: NameCheckTimers = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
}): Promise<NameCheckResult> {
  let timeout: unknown;
  let timedOut = false;
  try {
    return await Promise.race([
      scheduler.flush(name),
      new Promise<null>((resolve) => { timeout = timers.setTimeout(() => { timedOut = true; resolve(null); }, 2000); }),
    ]);
  } finally {
    if (timeout !== undefined) timers.clearTimeout(timeout);
    if (timedOut) scheduler.cancel();
  }
}
