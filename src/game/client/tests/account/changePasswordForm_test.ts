import { describe, expect, it } from 'vitest';
import { confirmationError, isPasswordChangeEnabled, mapPasswordChangeError } from '../../account/changePasswordForm';

const valid = { password: 'new-password', confirm: 'new-password', captchaRequired: false, token: null, submitting: false };
describe('forced password validation', () => {
  it.each([[9, false], [10, true], [128, true], [129, false]] as const)('checks %i NFC code points', (length, expected) => {
    const password = 'e\u0301'.repeat(length);
    expect(isPasswordChangeEnabled({ ...valid, password, confirm: password })).toBe(expected);
  });
  it('counts astral characters once without trimming whitespace', () => {
    for (const password of ['🚀'.repeat(10), ' '.repeat(10)]) {
      expect(isPasswordChangeEnabled({ ...valid, password, confirm: password })).toBe(true);
    }
  });
  it('compares confirmation exactly, including case and normalization spelling', () => {
    expect(isPasswordChangeEnabled({ ...valid, confirm: 'NEW-PASSWORD' })).toBe(false);
    expect(isPasswordChangeEnabled({ ...valid, password: 'é'.repeat(10), confirm: 'e\u0301'.repeat(10) })).toBe(false);
  });
  it('shows mismatch only after submit/eligible blur with both fields filled', () => {
    expect(confirmationError('new-password', 'different', false)).toBeUndefined();
    expect(confirmationError('new-password', '', true)).toBeUndefined();
    expect(confirmationError('new-password', 'different', true)).toBe("Passwords don't match.");
    expect(confirmationError('new-password', 'new-password', true)).toBeUndefined();
  });
  it('requires a fresh proof when sign-in escalation is carried into this screen', () => {
    expect(isPasswordChangeEnabled(valid)).toBe(true);
    expect(isPasswordChangeEnabled({ ...valid, captchaRequired: true })).toBe(false);
    expect(isPasswordChangeEnabled({ ...valid, captchaRequired: true, token: 'fresh-password-proof' })).toBe(true);
    expect(isPasswordChangeEnabled({ ...valid, submitting: true })).toBe(false);
  });
});
describe('forced password errors', () => {
  it.each([
    ['INVALID_PASSWORD', 'Use 10–128 characters.'],
    ['PASSWORD_UNCHANGED', 'Choose a different password from your temporary one.'],
  ])('maps %s to the new-password field', (code, password) => expect(mapPasswordChangeError({ code })).toEqual({ password }));
  it.each(['INVALID_CREDENTIALS', 'ACCOUNT_BLOCKED', 'NAME_BANNED'])('returns %s to Entry', (code) => {
    expect(mapPasswordChangeError({ code })).toEqual({ entryCode: code });
  });
  it.each(['CAPTCHA_REQUIRED', 'CAPTCHA_INVALID', 'CAPTCHA_REPLAY', 'CAPTCHA_UNAVAILABLE', 'RATE_LIMITED', 'AUTH_BUSY',
    'ACCOUNT_SERVICE_UNAVAILABLE', 'INTERNAL_ERROR', 'GAME_SESSION_INVALID', 'SESSION_LINK_CONFLICT'])('keeps %s as form feedback', (code) => {
    expect(mapPasswordChangeError({ code }).form).toBeTruthy();
    expect(mapPasswordChangeError({ code }).entryCode).toBeUndefined();
  });
  it('uses SAVE PASSWORD in escalation directions and formats retry delays', () => {
    expect(mapPasswordChangeError({ code: 'CAPTCHA_REQUIRED' }).form).toBe('Please complete the check below. Then press SAVE PASSWORD again.');
    expect(mapPasswordChangeError({ code: 'RATE_LIMITED', retryAfterSeconds: 61 }).form).toContain('2 minutes.');
  });
});
