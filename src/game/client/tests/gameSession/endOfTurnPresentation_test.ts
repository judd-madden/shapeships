declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useShipEffectPresentation } from '../../gameSession/clienteffects/useShipEffectPresentation';
import { useGameSound } from '../../audio/useGameSound';
import { usePollingEffect } from '../../gameSession/clienteffects/useNetworkingEffects';
import type { ShipEffectAudioVm } from '../../gameSession/types';

// Exercise production hook cleanup/deadlines without a DOM or a browser runner.
const effectsHarness = vi.hoisted(() => {
  type Cell = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
  const cells: Cell[] = []; let index = 0; let dirty = false;
  const work: Array<() => void> = [];
  const cell = () => cells[index++] ?? (cells[index - 1] = {});
  const effect = (setup: () => void | (() => void), deps?: readonly unknown[]) => {
    const entry = cell();
    if (entry.deps && deps && deps.length === entry.deps.length && deps.every((v, i) => Object.is(v, entry.deps![i]))) return;
    entry.deps = deps;
    work.push(() => { entry.cleanup?.(); entry.cleanup = setup() || undefined; });
  };
  return {
    reset: () => { cells.splice(0).forEach((entry) => entry.cleanup?.()); work.length = 0; },
    render: <T,>(read: () => T): T => {
      let value: T; let count = 0;
      do { dirty = false; index = 0; value = read(); work.splice(0).forEach((run) => run());
        if (++count > 30) throw new Error('Hook did not settle'); } while (dirty);
      return value!;
    },
    useState: (initial: any) => {
      const entry = cell();
      if (!('value' in entry)) entry.value = typeof initial === 'function' ? initial() : initial;
      return [entry.value, (update: any) => {
        const next = typeof update === 'function' ? update(entry.value) : update;
        if (!Object.is(next, entry.value)) { entry.value = next; dirty = true; }
      }];
    },
    useRef: (initial: any) => { const entry = cell(); return entry.value ?? (entry.value = { current: initial }); },
    useEffect: effect, useLayoutEffect: effect,
  };
});
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(),
  useState: effectsHarness.useState, useRef: effectsHarness.useRef,
  useEffect: effectsHarness.useEffect, useLayoutEffect: effectsHarness.useLayoutEffect }));

const audioInstances: AudioDouble[] = [];
class AudioDouble {
  preload = ''; currentTime = 0; muted = false; volume = 1;
  play = vi.fn(() => Promise.resolve()); pause = vi.fn(); load = vi.fn();
  constructor(readonly src: string) { audioInstances.push(this); }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0); audioInstances.length = 0;
  vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('Audio', AudioDouble);
});
afterEach(() => { effectsHarness.reset(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([false, true])('poll observations preserve request cadence and stale acceptance even when an observer throws (%s)', async (throws) => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const head = { gameId: 'g', stateRevision: 1, status: 'active', turnNumber: 3, phaseKey: 'battle.first_strike', clock: null };
  const fetch = vi.fn<Parameters<typeof usePollingEffect>[0]['authenticatedGet']>()
    .mockRejectedValueOnce(new Error('transport unavailable'))
    .mockResolvedValueOnce(new Response(JSON.stringify(head)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...head, stateRevision: 2 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ gameId: 'g' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...head, stateRevision: 2 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ gameId: 'g' })));
  const observations: string[] = [];
  const accept = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  const finish = vi.fn(); let seq = 0;
  const args: Parameters<typeof usePollingEffect>[0] = {
    effectiveGameId: 'g', hasJoinedCurrentGame: true, authenticatedGet: fetch,
    beginGameStateRequest: () => ({ requestSeq: ++seq, unlockEligible: false, resumeLockActivationRequestSeq: null }),
    finishGameStateRequest: finish, maybeUnlockResumeSyncFromGameStateSuccess: vi.fn(), applyAuthoritativeRawState: accept,
    shouldRetryGameStateRequestImmediately: () => false, isResumeSyncLocked: () => false,
    maybeUnlockResumeSyncFromValidatedUnchangedHead: vi.fn(), hasAcceptedFullGameState: () => true,
    getLastAcceptedFullFingerprint: () => head, getLastAcceptedFullSyncAtMs: () => 0, isGameStateRequestInFlight: () => false,
    setLoading: vi.fn(), setError: vi.fn(), isFinished: false, isUntimedAuthoritative: true,
    untimedPollingMode: 'active', foregroundResumeToken: 0,
    observeShipEffectSync: (event) => { observations.push(event); if (throws) throw new Error('observer'); },
  };
  effectsHarness.render(() => usePollingEffect(args));
  await vi.advanceTimersByTimeAsync(0);
  expect(observations).toEqual(['transport_failure']);
  await vi.advanceTimersByTimeAsync(2499); expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(2);
  expect(observations).toEqual(['transport_failure', 'http_response', 'unchanged_head']);
  await vi.advanceTimersByTimeAsync(2000); expect(fetch).toHaveBeenCalledTimes(4);
  expect(observations).not.toContain('accepted_full'); // Existing acceptance rejected this full DTO.
  await vi.advanceTimersByTimeAsync(2000); expect(fetch).toHaveBeenCalledTimes(6);
  expect(observations.filter((event) => event === 'accepted_full')).toHaveLength(1);
  expect(accept).toHaveBeenCalledTimes(2); expect(finish).toHaveBeenCalledTimes(2);
});

it('ship-effect deadlines release terminal waiting when no display component mounts or calls back', () => {
  const ship = { shipDefId: 'DEF', stackKey: 'DEF', renderKey: 'def', count: 1, memberInstanceIds: ['victim'] };
  const input: Parameters<typeof useShipEffectPresentation>[0] = { context: 'game', enabled: true, batches: [],
    previous: { my: [], opponent: [ship] }, fleet: { my: [], opponent: [] }, voidFleet: { my: [], opponent: [ship] },
    leftPlayerId: 'p1', rightPlayerId: 'p2' };
  const read = () => effectsHarness.render(() => useShipEffectPresentation(input));
  read();
  input.batches = [{ key: 'b', seq: 1, turnNumber: 3, phaseKey: 'battle.first_strike', sources: [], resolvedOutcomes: [{
    playerId: 'p1', kind: 'destroy', source: { type: 'ship', shipDefId: 'GUA', instanceId: 'gua', effectId: 'e' },
    targets: [{ playerId: 'p2', shipInstanceId: 'victim' }],
  }] }];
  const active = read(); expect(active.pending).toBe(true);
  vi.advanceTimersByTime(1200); expect(read().pending).toBe(true);
  vi.advanceTimersByTime(800); expect(read().pending).toBe(false);
  expect(read().retained).toEqual([]);
  active.onComplete(Object.values(active.effects.opponent)[0].activationKey, 'victim');
  expect(read().pending).toBe(false);
});

it('recovery cancels ship-effect audio without stopping dice or legacy destroy cues', () => {
  let presentation: ShipEffectAudioVm = { scopeKey: 'game', impactKey: null, suppressedVoidInstanceIds: ['victim'],
    authoritativeVoidInstanceIds: [], baseline: false };
  let dice = 0;
  const read = () => effectsHarness.render(() => useGameSound({ active: true, enabled: true,
    diceAnimateKey: dice, shipEffects: presentation }));
  read();
  presentation = { ...presentation, impactKey: 'group', authoritativeVoidInstanceIds: ['victim'] };
  dice++; read(); vi.runOnlyPendingTimers();
  const [diceAudio, destroyAudio] = audioInstances;
  expect(diceAudio.play).toHaveBeenCalledTimes(1);
  expect(destroyAudio.play).toHaveBeenCalledTimes(1); // No duplicate Void-diff sound.
  const dicePauses = diceAudio.pause.mock.calls.length;
  const destroyPauses = destroyAudio.pause.mock.calls.length;
  presentation = { ...presentation, scopeKey: 'recovery', impactKey: null, baseline: true };
  read();
  expect(diceAudio.pause).toHaveBeenCalledTimes(dicePauses);
  expect(destroyAudio.pause).toHaveBeenCalledTimes(destroyPauses + 1);
  presentation = { ...presentation, baseline: false, suppressedVoidInstanceIds: [], authoritativeVoidInstanceIds: ['victim', 'legacy'] };
  read(); vi.runOnlyPendingTimers();
  const fallbackPauses = destroyAudio.pause.mock.calls.length;
  presentation = { ...presentation, scopeKey: 'another-recovery', baseline: true }; read();
  expect(destroyAudio.pause).toHaveBeenCalledTimes(fallbackPauses);
});

it('recovery cancels a scheduled effect impact and mute does not replay an old impact', () => {
  let enabled = true;
  let presentation: ShipEffectAudioVm = { scopeKey: 'game', impactKey: null, suppressedVoidInstanceIds: [],
    authoritativeVoidInstanceIds: [], baseline: false };
  const read = () => effectsHarness.render(() => useGameSound({ active: true, enabled, diceAnimateKey: 0, shipEffects: presentation }));
  read(); presentation = { ...presentation, impactKey: 'scheduled' }; read();
  presentation = { ...presentation, scopeKey: 'recovery', impactKey: null, baseline: true }; read();
  vi.runOnlyPendingTimers(); expect(audioInstances[1].play).not.toHaveBeenCalled();
  enabled = false; presentation = { ...presentation, baseline: false, impactKey: 'muted' }; read();
  enabled = true; read(); vi.runOnlyPendingTimers();
  expect(audioInstances[1].play).not.toHaveBeenCalled();
});

import {
  transitionThisTurnResolutionSnapshot,
} from '../../gameSession/clienteffects/useEndOfTurnPresentation';
import type { ThisTurnResolutionSnapshot } from '../../gameSession/types';
import {
  captureResolvedHealthSnapshot,
  createResolvedHealthState,
  transitionResolvedHealth,
} from '../../gameSession/resolvedHealth';

function healthSnapshot(terminal = false, resolvedTurnNumber = 4) {
  const result = captureResolvedHealthSnapshot({
    identity: { gameId: 'game-1', viewerId: 'p1', viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2' },
    continuityKey: 'viewer-1', source: 'poll', resolvedTurnNumber,
    state: {
      gameId: 'game-1', turnNumber: resolvedTurnNumber, phaseKey: 'battle.end_of_turn_resolution',
      status: terminal ? 'finished' : 'active', resultReason: terminal ? 'decisive' : null,
      winnerPlayerId: terminal ? 'p1' : null,
      players: [{ id: 'p1', role: 'player', health: 20, maxHealth: 35 }, { id: 'p2', role: 'player', health: 0, maxHealth: 40 }],
      gameData: {
        lastTurnDamageByPlayerId: { p1: 10, p2: 30 }, lastTurnHealByPlayerId: { p1: 0, p2: 0 },
        lastTurnNetByPlayerId: { p1: -10, p2: -30 }, turnData: { phaseHold: { holdReason: 'end_of_turn_health' } },
      },
    },
  });
  assert(result);
  return result;
}

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function snapshot(terminal: boolean): ThisTurnResolutionSnapshot {
  const metric: any = { state: 'value', turnNumber: 4, source: terminal ? 'final_actual' : 'held_actual', total: 2, rows: [] };
  const player: any = { playerId: 'p1', damage: { current: metric, last: metric }, healing: { current: metric, last: metric } };
  return { gameId: 'game-1', resolvedTurnNumber: 4, isTerminalTurn: terminal, me: player, opponent: { ...player, playerId: 'p2' }, liveLog: null };
}

Deno.test('Phase 18 snapshot survives queued and missing dice until delayed N+1 publication', () => {
  const held = snapshot(false);
  let current = transitionThisTurnResolutionSnapshot(null, {
    type: 'capture', snapshot: held,
  });
  // An early N+1 DTO, a missing signature, and scheduling the delayed roll do
  // not publish a turn-start event to the production transition.
  assert(current === held);
  current = transitionThisTurnResolutionSnapshot(current, {
    type: 'turn_start_published', gameId: 'game-1', turnNumber: 4,
  });
  assert(current === held, 'same-turn dice/modifier publication released N');
  current = transitionThisTurnResolutionSnapshot(current, {
    type: 'turn_start_published', gameId: 'game-1', turnNumber: 5,
  });
  assert(current === null, 'delayed N+1 publication did not release N');
});

Deno.test('immediate N+1 publication releases nonterminal N', () => {
  const held = snapshot(false);
  assert(transitionThisTurnResolutionSnapshot(held, {
    type: 'turn_start_published', gameId: 'game-1', turnNumber: 5,
  }) === null);
});

Deno.test('Final Turn survives publication and overlay lifetime until game reset', () => {
  const final = snapshot(true);
  assert(transitionThisTurnResolutionSnapshot(final, {
    type: 'turn_start_published', gameId: 'game-1', turnNumber: 99,
  }) === final);
  assert(transitionThisTurnResolutionSnapshot(final, {
    type: 'turn_start_published', gameId: 'game-2', turnNumber: 99,
  }) === final);
  assert(transitionThisTurnResolutionSnapshot(final, { type: 'game_changed' }) === null);
});

Deno.test('resolved-health N survives N+1 DTOs and missing dice until the existing publication boundary', () => {
  const captured = healthSnapshot();
  const held = transitionResolvedHealth(createResolvedHealthState(), {
    type: 'sync', continuityKey: 'viewer-1', candidate: captured,
  });
  // A newer DTO/history response is a sync, not a release event.
  assert(transitionResolvedHealth(held, { type: 'sync', continuityKey: 'viewer-1' }).snapshot === captured);
  assert(transitionResolvedHealth(held, {
    type: 'turn_start_published', continuityKey: 'viewer-1', gameId: 'game-1', turnNumber: 4,
  }).snapshot === captured);
  const released = transitionResolvedHealth(held, {
    type: 'turn_start_published', continuityKey: 'viewer-1', gameId: 'game-1', turnNumber: 5,
  });
  assert(released.snapshot === null);
  assert(transitionResolvedHealth(released, {
    type: 'sync', continuityKey: 'viewer-1', candidate: captured,
  }).snapshot === null, 'a later history/poll replayed the released resolution');
});

Deno.test('history arriving after publication cannot start a missed live presentation', () => {
  const released = transitionResolvedHealth(
    transitionResolvedHealth(createResolvedHealthState(), { type: 'sync', continuityKey: 'viewer-1' }),
    { type: 'turn_start_published', continuityKey: 'viewer-1', gameId: 'game-1', turnNumber: 5 },
  );
  assert(transitionResolvedHealth(released, {
    type: 'sync', continuityKey: 'viewer-1', candidate: healthSnapshot(),
  }).snapshot === null);
});

Deno.test('canonical terminal data persists; identity/recovery resets reject stale candidates and callbacks', () => {
  const captured = healthSnapshot(true);
  const held = transitionResolvedHealth(createResolvedHealthState(), {
    type: 'sync', continuityKey: 'viewer-1', candidate: captured,
  });
  assert(transitionResolvedHealth(held, {
    type: 'turn_start_published', continuityKey: 'viewer-1', gameId: 'game-1', turnNumber: 5,
  }).snapshot === captured);
  for (const continuityKey of ['different-game', 'different-viewer', 'different-orientation', 'recovery', null]) {
    const reset = transitionResolvedHealth(held, { type: 'sync', continuityKey, candidate: captured });
    assert(reset.snapshot === null);
    assert(transitionResolvedHealth(reset, {
      type: 'turn_start_published', continuityKey: 'viewer-1', gameId: 'game-1', turnNumber: 8,
    }) === reset);
  }
});

Deno.test('a genuinely newer completed resolution replaces N even before its cap is available', () => {
  const held = transitionResolvedHealth(createResolvedHealthState(), {
    type: 'sync', continuityKey: 'viewer-1', candidate: healthSnapshot(),
  });
  const pending = transitionResolvedHealth(held, {
    type: 'sync', continuityKey: 'viewer-1', observedResolvedTurnNumber: 5,
  });
  assert(pending.snapshot === null);
  const next = healthSnapshot(true, 5);
  assert(transitionResolvedHealth(pending, {
    type: 'sync', continuityKey: 'viewer-1', candidate: next,
  }).snapshot === next);
});
