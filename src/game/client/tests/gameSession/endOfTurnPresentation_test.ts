declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

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
