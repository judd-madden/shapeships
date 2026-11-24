import { afterEach, describe, expect, it, vi } from 'vitest';
import { entryState, isEntryEnabled, mapEntryError, resolveEntryPlay } from '../../account/entryForm';
import { createNameCheckScheduler } from '../../account/nameCheckScheduler';
import type { NameCheckResult } from '../../account/claimNameForm';
import { deferred } from './fixtures';

afterEach(() => vi.useRealTimers());
const lookup = (outcome: 'available' | 'claimed' | 'banned' | 'reserved'): NameCheckResult => ({
  kind: 'ok', data: { ok: true, nameKey: 'pilot1', displayName: 'Pilot1', outcome },
});

describe('Entry messages', () => {
  it.each([
    ['CLAIMED_NAME_REQUIRES_ACCOUNT', 'Enter password for "Pilot1" or try a different name.', 'This name has been claimed.'],
    ...['INVALID_CREDENTIALS', 'INVALID_PASSWORD'].map((code) => [code, 'Incorrect Password.', 'Please contact juddly via our Discord if you want to reset.']),
    ['NAME_BANNED', 'This name is on the banned list.', 'Please enter a different name.'],
    ['NAME_RESERVED', 'This name is reserved.', 'Please enter a different name.'],
    ['ACCOUNT_BLOCKED', 'This account has been blocked.', 'Please contact juddly via our Discord.'],
    ['CAPTCHA_REQUIRED', 'Please complete the check below.', 'Then press PLAY again.'],
    ...['CAPTCHA_INVALID', 'CAPTCHA_REPLAY'].map((code) => [code, 'Verification failed.', 'Please complete the check again.']),
    ['CAPTCHA_UNAVAILABLE', "Verification isn't available right now.", 'Please try again later.'],
    ['RATE_LIMITED', 'Too many attempts.', 'Please try again later.'],
    ['AUTH_BUSY', 'The server is busy.', 'Please try again in a moment.'],
    ...['ACCOUNT_SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'].map((code) => [code, "Couldn't reach the account service.", 'Please try again.']),
    ['GUEST_SESSION_FAILED', "Couldn't start your session.", 'Please try again.'],
    ...['GAME_SESSION_INVALID', 'SESSION_LINK_CONFLICT', 'ACCOUNTS_NOT_ENABLED', 'UNKNOWN'].map((code) => [code, "Couldn't sign in.", 'Please try again.']),
  ])('maps %s without exposing server messages', (code, title, detail) => {
    expect(mapEntryError({ code }, 'Pilot1')).toMatchObject({ title, detail });
  });
  it.each([[0, '0 seconds'], [1, '1 second'], [59, '59 seconds'], [60, '1 minute'], [61, '2 minutes'], [120, '2 minutes']] as const)(
    'formats %i retry seconds', (retryAfterSeconds, text) => {
      expect(mapEntryError({ code: 'RATE_LIMITED', retryAfterSeconds }, '').detail).toBe(`Please try again in ${text}.`);
    },
  );
  it.each(['INVALID_CREDENTIALS', 'INVALID_PASSWORD', 'ACCOUNT_BLOCKED'])('marks the Discord link for %s', (code) => {
    expect(mapEntryError({ code }, '').discord).toBe(true);
  });
});

describe('Entry state and eligibility', () => {
  it.each([null, { kind: 'unavailable' }, { kind: 'error', code: 'RATE_LIMITED' }, { kind: 'error', code: 'ACCOUNTS_NOT_ENABLED' }] as NameCheckResult[])(
    'leaves failed/unfinished lookup %j as guest Entry', (result) => {
      expect(entryState('Pilot1', result)).toMatchObject({ mode: 'guest', message: undefined });
    },
  );
  it('uses lookup casing for claimed-name messages', () => {
    const state = entryState('pilot1', lookup('claimed'));
    expect(state.mode).toBe('claimed');
    expect(state.message?.title).toContain('"Pilot1"');
  });
  it.each(['NAME_BANNED', 'NAME_RESERVED', 'CLAIMED_NAME_REQUIRES_ACCOUNT', 'INVALID_NAME'])(
    'projects server refusal %s over a previous available result', (code) => {
      const state = entryState('Pilot1', lookup('available'), { code });
      if (code === 'INVALID_NAME') expect(state.formatError).toBe(true);
      else expect(state.mode).toBe(code === 'NAME_BANNED' ? 'banned' : code === 'NAME_RESERVED' ? 'reserved' : 'claimed');
    },
  );
  it.each(['bad name', 'a'.repeat(21)])('keeps the existing format-error channel for %s', (name) => {
    expect(entryState(name, lookup('claimed'), { code: 'INVALID_CREDENTIALS' })).toMatchObject({ formatError: true, message: undefined });
  });
  const valid = { name: 'Pilot1', mode: 'guest', password: '', captchaRequired: false, token: null, submitting: false };
  it('allows valid guests before a check is completed', () => expect(isEntryEnabled(valid)).toBe(true));
  it.each(['banned', 'reserved'])('disables %s names', (mode) => expect(isEntryEnabled({ ...valid, mode })).toBe(false));
  it('requires only a nonempty sign-in password, plus a proof after escalation', () => {
    expect(isEntryEnabled({ ...valid, mode: 'claimed' })).toBe(false);
    expect(isEntryEnabled({ ...valid, mode: 'claimed', password: 'x' })).toBe(true);
    expect(isEntryEnabled({ ...valid, mode: 'claimed', password: 'x', captchaRequired: true })).toBe(false);
    expect(isEntryEnabled({ ...valid, mode: 'claimed', password: 'x', captchaRequired: true, token: 'fresh' })).toBe(true);
  });
  it.each([{ name: 'ab' }, { submitting: true }, { formatError: true }])('disables incomplete/busy Entry %j', (change) => {
    expect(isEntryEnabled({ ...valid, ...change })).toBe(false);
  });
});

describe('PLAY lookup deadline', () => {
  it('reuses a completed lookup when a guest retries session startup', async () => {
    const checkName = vi.fn(async () => lookup('available'));
    const scheduler = createNameCheckScheduler({ checkName, invalidate: vi.fn(), onResult: vi.fn() });
    scheduler.open('Pilot1');
    await resolveEntryPlay('Pilot1', scheduler);
    await resolveEntryPlay('Pilot1', scheduler);
    expect(checkName).toHaveBeenCalledOnce();
    scheduler.dispose();
  });
  it('flushes a pending debounce and stops at claimed state before any guest session', async () => {
    vi.useFakeTimers();
    const checkName = vi.fn(async () => lookup('claimed'));
    const session = vi.fn();
    const scheduler = createNameCheckScheduler({ checkName, invalidate: vi.fn(), onResult: vi.fn() });
    scheduler.update('Pilot1');
    const checked = await resolveEntryPlay('Pilot1', scheduler);
    if (entryState('Pilot1', checked).mode === 'guest') session();
    expect(checkName).toHaveBeenCalledExactlyOnceWith('Pilot1');
    expect(session).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    scheduler.dispose();
  });
  it('falls back at 2000ms and ignores a later claimed result', async () => {
    vi.useFakeTimers();
    const pending = deferred<NameCheckResult>(), onResult = vi.fn();
    const scheduler = createNameCheckScheduler({ checkName: () => pending.promise, invalidate: vi.fn(), onResult });
    scheduler.update('Pilot1');
    let finished = false;
    const play = resolveEntryPlay('Pilot1', scheduler).then((result) => { finished = true; return result; });
    await vi.advanceTimersByTimeAsync(1999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await play).toBeNull();
    const calls = onResult.mock.calls.length;
    pending.resolve(lookup('claimed'));
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledTimes(calls);
    expect(vi.getTimerCount()).toBe(0);
    scheduler.dispose();
  });
});
