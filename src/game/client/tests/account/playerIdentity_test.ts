import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPlayerName } from '../../gameSession/playerName';
import { getEntrySessionErrorMessage, SessionRequestError } from '../../gameSession/accountSessionWiring';
import { cleanup, harness, SESSION_TOKEN } from './fixtures';

afterEach(cleanup);

describe('explicit player names', () => {
  it('uses account casing immediately on sign-in/resume and no identity during checking', async () => {
    const h = harness();
    expect(getPlayerName('EntryGuest', h.store.getSnapshot())).toBe('EntryGuest');
    await h.signIn();
    expect(getPlayerName('EntryGuest', h.store.getSnapshot())).toBe('Pilot1');
    const resume = h.store.resume(SESSION_TOKEN);
    expect(getPlayerName('EntryGuest', h.store.getSnapshot())).toBe('');
    await resume;
    expect(getPlayerName('', h.store.getSnapshot())).toBe('Pilot1');
    await h.store.logout();
    expect(getPlayerName('', h.store.getSnapshot())).toBe('');
  });

  it('never reads legacy names or generates a fallback', () => {
    vi.stubGlobal('localStorage', new Proxy({}, { get() { throw new Error('legacy name access'); } }));
    expect(getPlayerName('')).toBe('');
    expect(getPlayerName('   ')).toBe('');
    expect(getPlayerName('Guest')).toBe('Guest');
    expect(getPlayerName('EntryName')).toBe('EntryName');
    const hook = readFileSync(new URL('../../../hooks/usePlayer.tsx', import.meta.url), 'utf8');
    expect(hook).not.toMatch(/createNewPlayer|randomName|randomAdj|const adjectives|const names/);
  });
});

describe('Entry error messages', () => {
  it.each([
    ['INVALID_NAME', 'Use 3–20 letters or numbers, no spaces or symbols.'],
    ['NAME_RESERVED', 'This name is reserved. Please choose another.'],
    ['NAME_BANNED', 'This name is on the banned list. Please enter a different name.'],
    ['CLAIMED_NAME_REQUIRES_ACCOUNT', 'This name has been claimed. Please choose another name.'],
  ])('maps the typed %s refusal', (code, message) => {
    expect(getEntrySessionErrorMessage(new SessionRequestError('server text', code, 403))).toBe(message);
  });

  it('keeps other failures generic without parsing their messages', () => {
    expect(getEntrySessionErrorMessage(new Error('NAME_BANNED'))).toBe('Failed to start session. Please try again.');
    expect(getEntrySessionErrorMessage(new SessionRequestError('unavailable', 'INTERNAL_ERROR', 500)))
      .toBe('Failed to start session. Please try again.');
  });
});
