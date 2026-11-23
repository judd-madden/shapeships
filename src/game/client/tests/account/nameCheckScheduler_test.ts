import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNameCheckScheduler } from '../../account/nameCheckScheduler';
import type { NameCheckResult } from '../../account/claimNameForm';
import { deferred } from './fixtures';

afterEach(() => vi.useRealTimers());

function available(name = 'Pilot1'): NameCheckResult {
  return { kind: 'ok', data: { ok: true, nameKey: name.toLowerCase(), displayName: name, outcome: 'available' } };
}
function setup() {
  vi.useFakeTimers();
  const checkName = vi.fn<(name: string) => Promise<NameCheckResult>>(async (name) => available(name));
  const invalidate = vi.fn(), onResult = vi.fn();
  const scheduler = createNameCheckScheduler({ checkName, invalidate, onResult });
  return { scheduler, checkName, invalidate, onResult };
}

describe('reusable name-check scheduler', () => {
  it('checks the opening name immediately and skips unchanged repeats', async () => {
    const h = setup();
    h.scheduler.open('Pilot1');
    expect(h.checkName).toHaveBeenCalledExactlyOnceWith('Pilot1');
    await Promise.resolve();
    h.scheduler.update('Pilot1');
    h.scheduler.open('Pilot1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.checkName).toHaveBeenCalledOnce();
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot1', available());
    h.scheduler.dispose();
  });

  it('debounces until 500ms after the last edit', async () => {
    const h = setup();
    h.scheduler.update('Pilot1');
    await vi.advanceTimersByTimeAsync(400);
    h.scheduler.update('Pilot2');
    await vi.advanceTimersByTimeAsync(499);
    expect(h.checkName).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.checkName).toHaveBeenCalledExactlyOnceWith('Pilot2');
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot2', available('Pilot2'));
    h.scheduler.dispose();
  });

  it.each(['', 'ab', 'Invalid name', 'x'.repeat(21)])('never requests invalid input %s', async (name) => {
    const h = setup();
    h.scheduler.open(name);
    await vi.advanceTimersByTimeAsync(500);
    expect(h.checkName).not.toHaveBeenCalled();
    expect(h.onResult).toHaveBeenLastCalledWith(name, null);
    h.scheduler.dispose();
  });

  it('fences an old result immediately, before the new debounce fires', async () => {
    const h = setup(), old = deferred<NameCheckResult>();
    h.checkName.mockReturnValueOnce(old.promise);
    h.scheduler.open('Pilot1');
    h.scheduler.update('Pilot2');
    old.resolve({ kind: 'ok', data: { ...((available() as Extract<NameCheckResult, { kind: 'ok' }>).data), outcome: 'claimed' } });
    await Promise.resolve();
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot2', null);
    await vi.advanceTimersByTimeAsync(500);
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot2', available('Pilot2'));
    expect(h.invalidate).toHaveBeenCalledTimes(2);
    h.scheduler.dispose();
  });

  it('ignores an earlier result after editing away and back to the same name', async () => {
    const h = setup(), old = deferred<NameCheckResult>();
    h.checkName.mockReturnValueOnce(old.promise);
    h.scheduler.open('Pilot1');
    h.scheduler.update('Pilot2');
    h.scheduler.update('Pilot1');
    old.resolve(available());
    await Promise.resolve();
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot1', null);
    await vi.advanceTimersByTimeAsync(500);
    expect(h.checkName).toHaveBeenCalledTimes(2);
    h.scheduler.dispose();
  });

  it.each([{ kind: 'unavailable' }, { kind: 'error', code: 'RATE_LIMITED' }] as const)(
    'delivers failed lookup %j for the normal-hint fallback', async (failure) => {
      const h = setup();
      h.checkName.mockResolvedValueOnce(failure);
      h.scheduler.open('Pilot1');
      await Promise.resolve();
      expect(h.onResult).toHaveBeenLastCalledWith('Pilot1', failure);
      h.scheduler.dispose();
    },
  );

  it('contains a rejecting callback without exposing transport exceptions', async () => {
    const h = setup();
    h.checkName.mockRejectedValueOnce(new Error('transport'));
    h.scheduler.open('Pilot1');
    await Promise.resolve();
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot1', null);
    h.scheduler.dispose();
  });

  it('cancels the debounce on submit and fences an in-flight result', async () => {
    const h = setup(), old = deferred<NameCheckResult>();
    h.checkName.mockReturnValueOnce(old.promise);
    h.scheduler.open('Pilot1');
    h.scheduler.update('Pilot2');
    h.scheduler.cancel();
    old.resolve(available());
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.checkName).toHaveBeenCalledOnce();
    expect(h.onResult).toHaveBeenLastCalledWith('Pilot2', null);
    h.scheduler.dispose();
  });

  it('cleans up on unmount and cannot restart after disposal', async () => {
    const h = setup(), old = deferred<NameCheckResult>();
    h.checkName.mockReturnValueOnce(old.promise);
    h.scheduler.open('Pilot1');
    h.scheduler.update('Pilot2');
    h.scheduler.dispose();
    const calls = h.onResult.mock.calls.length;
    h.scheduler.update('Pilot3');
    h.scheduler.open('Pilot4');
    old.resolve(available());
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.onResult).toHaveBeenCalledTimes(calls);
    expect(h.checkName).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
