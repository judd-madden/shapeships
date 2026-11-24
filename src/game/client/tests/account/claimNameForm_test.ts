import { describe, expect, it } from 'vitest';
import {
  isClaimEnabled, isValidAccountName, mapClaimError, nameFieldError, passwordCodePointLength,
  NAME_HINT, NAME_RULE, NAME_MESSAGES, VERIFICATION_UNAVAILABLE,
  type ClaimFeedback,
} from '../../account/claimNameForm';

describe('Claim Name field feedback', () => {
  it('preserves the owner hint while keeping format errors rule-only', () => {
    expect(NAME_RULE).toBe('3–20 letters or numbers, no spaces or symbols.');
    expect(NAME_HINT).toBe(`${NAME_RULE} Names are not case sensitive: jon, Jon and JON are the same name.`);
  });
  it.each(['Pilot1', 'abc', 'A'.repeat(20)])('accepts ASCII name %s', (name) => {
    expect(isValidAccountName(name)).toBe(true);
    expect(nameFieldError(name, 'available')).toBeUndefined();
  });
  it.each(['', 'ab'])('keeps the hint for short input %s', (name) => {
    expect(isValidAccountName(name)).toBe(false);
    expect(nameFieldError(name)).toBeUndefined();
  });
  it.each(['A'.repeat(21), 'Two words', 'ééé', 'pilot!', 'abc\n'])('immediately flags %s', (name) => {
    expect(isValidAccountName(name)).toBe(false);
    expect(nameFieldError(name, 'claimed', 'Server error')).toBe(NAME_RULE);
  });
  it.each(['claimed', 'banned', 'reserved'] as const)('maps %s lookup feedback', (outcome) => {
    expect(nameFieldError('Pilot1', outcome)).toBe(NAME_MESSAGES[outcome]);
  });
  it('uses current server field feedback and clears unavailable lookup feedback', () => {
    expect(nameFieldError('Pilot1', 'available', NAME_MESSAGES.claimed)).toBe(NAME_MESSAGES.claimed);
    expect(nameFieldError('Pilot1')).toBeUndefined();
  });
});

describe('password NFC code-point limits', () => {
  it.each([9, 10, 128, 129])('counts the %i boundary', (length) => {
    expect(passwordCodePointLength('a'.repeat(length))).toBe(length);
  });
  it('counts astral characters once and composes combining characters', () => {
    expect(passwordCodePointLength('🚀'.repeat(10))).toBe(10);
    expect(passwordCodePointLength('e\u0301'.repeat(10))).toBe(10);
    expect(passwordCodePointLength('ﬀ'.repeat(10))).toBe(10);
    expect(passwordCodePointLength(' '.repeat(10))).toBe(10);
  });
});

describe('Claim Name submission eligibility', () => {
  const valid = { name: 'Pilot1', password: 'a'.repeat(10), token: 'synthetic-proof', submitting: false };
  it('allows an unchecked valid name because claim remains authoritative', () => {
    expect(isClaimEnabled(valid)).toBe(true);
    expect(isClaimEnabled({ ...valid, outcome: 'available' })).toBe(true);
  });
  it.each(['claimed', 'banned', 'reserved'] as const)('blocks %s names', (outcome) => {
    expect(isClaimEnabled({ ...valid, outcome })).toBe(false);
  });
  it.each([
    { name: 'ab' }, { name: 'Invalid name' }, { password: 'a'.repeat(9) },
    { password: 'a'.repeat(129) }, { token: null }, { token: '' }, { submitting: true },
    { nameError: NAME_MESSAGES.claimed },
  ])('blocks incomplete or invalid submission %j', (change) => {
    expect(isClaimEnabled({ ...valid, ...change })).toBe(false);
  });
  it('uses normalized code-point boundaries for eligibility', () => {
    expect(isClaimEnabled({ ...valid, password: '🚀'.repeat(128) })).toBe(true);
    expect(isClaimEnabled({ ...valid, password: 'e\u0301'.repeat(128) })).toBe(true);
    expect(isClaimEnabled({ ...valid, password: '🚀'.repeat(129) })).toBe(false);
  });
});

describe('claim error mapping', () => {
  it.each([
    ['NAME_TAKEN', { name: NAME_MESSAGES.claimed }],
    ['NAME_BANNED', { name: NAME_MESSAGES.banned }],
    ['NAME_RESERVED', { name: NAME_MESSAGES.reserved }],
    ['INVALID_NAME', { name: NAME_RULE }],
    ['INVALID_PASSWORD', { password: 'Use 10–128 characters.' }],
    ...['CAPTCHA_REQUIRED', 'CAPTCHA_INVALID', 'CAPTCHA_REPLAY'].map<[string, ClaimFeedback]>((code) => [code, { verification: 'Verification failed. Please complete the check again.' }]),
    ['CAPTCHA_UNAVAILABLE', { verification: VERIFICATION_UNAVAILABLE }],
    ['RATE_LIMITED', { form: 'Too many attempts. Please try again later.' }],
    ['AUTH_BUSY', { form: 'The server is busy. Please try again in a moment.' }],
    ...['ACCOUNT_SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'].map<[string, ClaimFeedback]>((code) => [code, { form: "Couldn't reach the account service. Please try again." }]),
    ['GAME_SESSION_INVALID', { form: 'Please try again.' }],
    ...['SESSION_LINK_CONFLICT', 'ACCOUNTS_NOT_ENABLED', 'UNKNOWN'].map<[string, ClaimFeedback]>((code) => [code, { form: "Couldn't create your account. Please try again." }]),
  ] as const)('maps %s to its field or message', (code, expected) => {
    expect(mapClaimError({ code })).toEqual(expected);
  });
  it('handles a missing error without exposing server details', () => {
    expect(mapClaimError(null)).toEqual({ form: "Couldn't create your account. Please try again." });
  });
});
