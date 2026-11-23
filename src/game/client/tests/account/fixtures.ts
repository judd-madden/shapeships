import { vi } from 'vitest';
import { createAccountApi } from '../../account/accountApi';
import { ACCOUNT_TOKEN_STORAGE_KEY, accountClock, createAccountStore } from '../../account/accountStore';
import type { AccountEntryBody, AccountPreferences, AccountResumeBody } from '../../account/types';
import { createPlayerPreferencesStore, PLAYER_PREFERENCE_DEFAULTS } from '../../preferences/playerPreferences';

export const TOKEN = 'a'.repeat(43);
export const OTHER_TOKEN = 'b'.repeat(43);
export const SESSION_TOKEN = 'tab-session-secret';
export const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
export const BASE_URL = 'https://accounts.invalid/functions/v1/game';
export const ANON_KEY = 'public-test-key';

export function envelope(revision = '1', values = {}): AccountPreferences {
  return { values: { ...PLAYER_PREFERENCE_DEFAULTS, ...values }, revision, updatedAt: '2026-11-23T00:00:00.000Z' };
}
export function entry(accountToken = TOKEN, accountId = ACCOUNT_ID, displayName = 'Pilot1', preferences = envelope()): AccountEntryBody {
  return {
    ok: true, account: { id: accountId, displayName, badge: 'claimed-name' }, preferences,
    accountToken, expiresAt: '2027-02-21T00:00:00.000Z',
    link: { sessionId: 'session_tab', accountId, displayName },
  };
}
export function resumed(withLink = false, preferences = envelope()): AccountResumeBody {
  const { accountToken: _token, link, ...rest } = entry(TOKEN, ACCOUNT_ID, 'Pilot1', preferences);
  return { ...rest, ...(withLink ? { link } : {}) };
}
export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
export function error(code: string, status = 400, extras: Record<string, unknown> = {}, preferences?: AccountPreferences): Response {
  return json({ ok: false, error: { code, message: 'Safe test error.', ...extras }, ...(preferences ? { preferences } : {}) }, status);
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
export function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: Storage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
    clear: vi.fn(() => { data.clear(); }),
  };
  return { storage, data };
}

const cleanups: (() => void)[] = [];
export function cleanup(): void {
  cleanups.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

export function harness({ savedToken, storage: suppliedStorage }: { savedToken?: string; storage?: Storage | null } = {}) {
  const memory = memoryStorage(savedToken ? { [ACCOUNT_TOKEN_STORAGE_KEY]: savedToken } : {});
  const storage = suppliedStorage === undefined ? memory.storage : suppliedStorage;
  const events = new EventTarget();
  let remote = envelope();
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input).split('/accounts/')[1];
    if (path === 'name-check') return json({ ok: true, nameKey: 'pilot1', displayName: 'Pilot1', outcome: 'available' });
    if (path === 'claim') return json(entry(), 201);
    if (path === 'sign-in' || path === 'password') return json(entry());
    if (path === 'resume') return json(resumed(new Headers(init?.headers).has('X-Session-Token')));
    if (path === 'logout') return new Response(null, { status: 204 });
    if (path === 'preferences') {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        remote = envelope(String(BigInt(body.expectedRevision) + 1n), { ...remote.values, ...body.patch });
      }
      return json({ ok: true, preferences: remote });
    }
    throw new Error('Unexpected test route');
  });
  const api = createAccountApi({ baseUrl: BASE_URL, anonKey: ANON_KEY, fetch: fetchMock, timeoutMs: 12000 });
  const preferences = createPlayerPreferencesStore({ storage, eventTarget: events });
  const store = createAccountStore({ api, storage, eventTarget: events, clock: accountClock, preferences });
  cleanups.push(() => { store.dispose(); preferences.dispose(); });
  return {
    ...memory, storage, events, fetchMock, api, preferences, store,
    signIn: () => store.signIn({ name: 'Pilot1', password: 'synthetic-password' }, SESSION_TOKEN),
    external(key: string | null, newValue: string | null, storageArea: Storage | null = storage): void {
      const oldValue = key === null ? null : storage?.getItem(key) ?? null;
      if (key === null) storage?.clear();
      else if (newValue === null) storage?.removeItem(key);
      else storage?.setItem(key, newValue);
      events.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, oldValue, storageArea }));
    },
  };
}

export function putBodies(fetchMock: ReturnType<typeof harness>['fetchMock']) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(String(init?.body)));
}
