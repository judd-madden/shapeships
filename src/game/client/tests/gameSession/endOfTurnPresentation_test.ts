declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  transitionThisTurnResolutionSnapshot,
} from '../../gameSession/clienteffects/useEndOfTurnPresentation';
import type { ThisTurnResolutionSnapshot } from '../../gameSession/types';

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
