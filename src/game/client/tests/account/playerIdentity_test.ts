import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPlayerName } from '../../gameSession/playerName';
import { guestEntryFailure, SessionRequestError } from '../../gameSession/accountSessionWiring';
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
  it.each(['INVALID_NAME', 'NAME_RESERVED', 'NAME_BANNED', 'CLAIMED_NAME_REQUIRES_ACCOUNT'])('retains the typed %s refusal for inline presentation', (code) => {
    expect(guestEntryFailure(new SessionRequestError('server text', code, 403))).toEqual({ kind: 'error', error: { code } });
  });

  it('keeps other failures generic without parsing their messages', () => {
    expect(guestEntryFailure(new Error('NAME_BANNED'))).toEqual({ kind: 'error', error: { code: 'GUEST_SESSION_FAILED' } });
    expect(guestEntryFailure(new SessionRequestError('unavailable', 'INTERNAL_ERROR', 500)))
      .toEqual({ kind: 'error', error: { code: 'GUEST_SESSION_FAILED' } });
  });
});
