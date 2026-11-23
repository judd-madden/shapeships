import type { AccountOperationError, AccountResult, NameCheckBody } from './types';

export const NAME_HINT = '3–20 letters or numbers, no spaces or symbols.';
export const VERIFICATION_UNAVAILABLE = "Verification isn't available right now. Please try again later.";
export const NAME_MESSAGES = {
  claimed: 'This name has already been claimed. Please choose another.',
  banned: 'This name is on the banned list. Please enter a different name.',
  reserved: 'This name is reserved. Please choose another.',
} as const;

export type NameCheckResult = AccountResult<NameCheckBody> | null;
export type ClaimNameInput = { name: string; password: string; turnstileToken: string };
export type ClaimNameResult = { kind: 'ok' } | { kind: 'error'; error: AccountOperationError } | { kind: 'cancelled' };
export interface ClaimNameActions {
  checkName(name: string): Promise<NameCheckResult>;
  invalidateNameChecks(): void;
  claim(input: ClaimNameInput): Promise<ClaimNameResult>;
}
export interface ClaimFeedback {
  name?: string;
  password?: string;
  verification?: string;
  form?: string;
}

export function isValidAccountName(name: string): boolean {
  return /^[A-Za-z0-9]{3,20}$/.test(name);
}

export function passwordCodePointLength(password: string): number {
  return Array.from(password.normalize('NFC')).length;
}

export function nameFieldError(name: string, outcome?: NameCheckBody['outcome'], serverError?: string): string | undefined {
  if (/[^A-Za-z0-9]/.test(name) || name.length > 20) return NAME_HINT;
  if (serverError) return serverError;
  return outcome && outcome !== 'available' ? NAME_MESSAGES[outcome] : undefined;
}

export function isClaimEnabled({ name, password, outcome, nameError, token, submitting }: {
  name: string;
  password: string;
  outcome?: NameCheckBody['outcome'];
  nameError?: string;
  token: string | null;
  submitting: boolean;
}): boolean {
  const length = passwordCodePointLength(password);
  return isValidAccountName(name) && (!outcome || outcome === 'available') && !nameError
    && length >= 10 && length <= 128 && Boolean(token) && !submitting;
}

export function mapClaimError(error: AccountOperationError | null): ClaimFeedback {
  switch (error?.code) {
    case 'NAME_TAKEN': return { name: NAME_MESSAGES.claimed };
    case 'NAME_BANNED': return { name: NAME_MESSAGES.banned };
    case 'NAME_RESERVED': return { name: NAME_MESSAGES.reserved };
    case 'INVALID_NAME': return { name: NAME_HINT };
    case 'INVALID_PASSWORD': return { password: 'Use 10–128 characters.' };
    case 'CAPTCHA_REQUIRED':
    case 'CAPTCHA_INVALID':
    case 'CAPTCHA_REPLAY': return { verification: 'Verification failed. Please complete the check again.' };
    case 'CAPTCHA_UNAVAILABLE': return { verification: VERIFICATION_UNAVAILABLE };
    case 'RATE_LIMITED': return { form: 'Too many attempts. Please try again later.' };
    case 'AUTH_BUSY': return { form: 'The server is busy. Please try again in a moment.' };
    case 'ACCOUNT_SERVICE_UNAVAILABLE':
    case 'INTERNAL_ERROR': return { form: "Couldn't reach the account service. Please try again." };
    case 'GAME_SESSION_INVALID': return { form: 'Please try again.' };
    default: return { form: "Couldn't create your account. Please try again." };
  }
}
