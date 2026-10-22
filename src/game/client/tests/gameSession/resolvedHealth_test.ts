declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  buildSettledHealthPresentation, captureResolvedHealthSnapshot, createResolvedHealthState,
  getIntentResolvedHealthTurn, getResolvedHealthIdentityKey,
  observeHealthResolution, prepareResolvedHealthCapture, transitionResolvedHealth,
  isTerminalHealthBarPresentationPending,
  type HealthResolutionObservation,
} from '../../gameSession/resolvedHealth';
import type { BattleLogHistoryResponse, ResolvedHealthIdentity } from '../../gameSession/types';

function assert(value: unknown, message = 'assertion failed'): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
const identity: ResolvedHealthIdentity = {
  gameId: 'g', viewerId: 'p1', viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
};
const continuityKey = 'g/player/p1/foreground/0';

function state(start = 30, damage = 10, healing = 0, cap = 35): any {
  const final = Math.min(start - damage + healing, cap);
  return {
    gameId: 'g', turnNumber: 4, phaseKey: 'battle.end_of_turn_resolution', status: 'active',
    players: [{ id: 'p1', role: 'player', health: final, maxHealth: cap },
      { id: 'p2', role: 'player', health: 28, maxHealth: 35 }, { id: 's1', role: 'spectator' }],
    gameData: {
      lastTurnDamageByPlayerId: { p1: damage, p2: 2 },
      lastTurnHealByPlayerId: { p1: healing, p2: 0 },
      lastTurnNetByPlayerId: { p1: final - start, p2: -2 },
      turnData: { phaseHold: { holdReason: 'end_of_turn_health' } },
    },
  };
}
function capture(input = state(), viewer = identity, source: 'poll' | 'intent' = 'poll') {
  return captureResolvedHealthSnapshot({ state: input, identity: viewer, continuityKey, resolvedTurnNumber: 4, source });
}
function history(input: any, caps: Record<string, number> = { p1: 35, p2: 35 }): BattleLogHistoryResponse {
  return { gameId: 'g', revision: 8, completedTurnCount: 4, turns: [{
    turnNumber: 4, diceValue: 3,
    players: input.players.filter((p: any) => p.role === 'player').map((p: any) => ({
      playerId: p.id, name: p.id, healthEnd: p.health, maxHealthEnd: caps[p.id],
      healthDelta: input.gameData.lastTurnNetByPlayerId[p.id], fleetValueEnd: 0,
    })),
    buildLinesByPlayerId: {}, battleLinesByPlayerId: {},
    analysisByPlayerId: Object.fromEntries(['p1', 'p2'].map((id) => [id, {
      damageTaken: input.gameData.lastTurnDamageByPlayerId[id],
      healReceived: input.gameData.lastTurnHealByPlayerId[id],
      netHealthDelta: input.gameData.lastTurnNetByPlayerId[id], savedLinesEnd: 0, savedJoiningLinesEnd: 0,
    }])),
  }] };
}
function pending(input: any) {
  const value = prepareResolvedHealthCapture({ state: input, identity, continuityKey, resolvedTurnNumber: 4, source: 'poll' });
  assert(value);
  return value;
}
function resolved(input = state()): any {
  input.gameData.lastTurnHealthResolution = {
    resolvedTurnNumber: 4,
    finalHealthByPlayerId: Object.fromEntries(input.players.filter((p: any) => p.role === 'player').map((p: any) => [p.id, p.health])),
    maxHealthByPlayerId: Object.fromEntries(input.players.filter((p: any) => p.role === 'player').map((p: any) => [p.id, p.maxHealth])),
  };
  input.turnNumber = 5;
  input.phaseKey = 'build.drawing';
  return input;
}
function complete(input: ReturnType<typeof pending>, archive: BattleLogHistoryResponse | null) {
  return captureResolvedHealthSnapshot({ ...input, liveCapture: input, history: archive });
}

Deno.test('terminal bars release only on matching presentation completion, independently of source and overlay timing', () => {
  const snapshot = capture({ ...state(30, 40), status: 'finished', resultReason: 'decisive', winnerPlayerId: 'p2' });
  assert(snapshot);
  const input = { enabled: true, continuityKey, snapshot, completion: null };
  assert(isTerminalHealthBarPresentationPending(input));
  assert(!isTerminalHealthBarPresentationPending({ ...input, completion: snapshot }));
  for (const receipt of [
    { ...snapshot, presentationKey: 'older' }, { ...snapshot, resolvedTurnNumber: 3 },
    { ...snapshot, continuityKey: 'recovered' },
    ...(['gameId', 'viewerId', 'viewerRole', 'leftPlayerId', 'rightPlayerId'] as const).map((field) => ({
      ...snapshot, identity: { ...snapshot.identity, [field]: field === 'viewerRole' ? 'spectator' as const : 'different' },
    })),
  ]) assert(isTerminalHealthBarPresentationPending({ ...input, completion: receipt }));
});

Deno.test('terminal bars never wait for mobile, recovery, unsupported sources or non-health finishes', () => {
  const snapshot = capture({ ...state(30, 40), status: 'finished', resultReason: 'decisive', winnerPlayerId: 'p2' });
  assert(snapshot);
  const input = { enabled: true, continuityKey, snapshot, completion: null };
  assert(!isTerminalHealthBarPresentationPending({ ...input, enabled: false }));
  assert(!isTerminalHealthBarPresentationPending({ ...input, continuityKey: 'recovered' }));
  assert(!isTerminalHealthBarPresentationPending({ ...input, snapshot: null }));
  assert(!isTerminalHealthBarPresentationPending({ ...input, snapshot: { ...snapshot,
    outcome: { isTerminal: true, winnerPlayerId: 'p2', resultReason: 'resignation' } } }));
});

for (const [name, start, damage, healing, cap, end] of [
  ['damage only', 30, 10, 0, 35, 20], ['healing only', 20, 0, 8, 35, 28],
  ['no contributions', 30, 0, 0, 35, 30], ['overheal', 30, 10, 25, 35, 35],
  ['already full', 35, 0, 80, 35, 35], ['zero net large contributions', 25, 85, 85, 35, 25],
  ['below zero then recover', 25, 85, 83, 35, 23], ['increased maximum', 35, 10, 30, 45, 45],
] as const) {
  Deno.test(`resolved health: ${name}`, () => {
    const result = capture(state(start, damage, healing, cap));
    assert(result);
    equal([result.left.startHealth, result.left.damageTaken, result.left.grossHealingReceived,
      result.left.finalHealth, result.left.actualNetDelta, result.left.maxHealth, result.left.damageStageHealth],
    [start, damage, healing, end, end - start, cap, start - damage]);
    equal(result.right.damageTaken, 2);
    const exact = complete(pending(resolved(state(start, damage, healing, cap))), null);
    equal(exact?.left, result.left);
  });
}

Deno.test('both sides, identity and outcomes are frozen and detached from source payloads', () => {
  const input = state(30, 10, 25);
  const viewer = { ...identity };
  const result = capture(input, viewer);
  assert(result);
  input.players[0].health = 99;
  input.players[0].maxHealth = 50;
  input.gameData.lastTurnHealByPlayerId.p1 = 999;
  viewer.leftPlayerId = 'other';
  equal(result.left.grossHealingReceived, 25);
  equal(result.left.maxHealth, 35);
  equal(result.identity.leftPlayerId, 'p1');
  assert([result, result.left, result.right, result.identity, result.outcome].every(Object.isFrozen));
});

Deno.test('live next-turn capture owns exact resolution caps without history despite later health and fleet work', () => {
  const input = resolved(state(30, 10, 25));
  const archive = history(input);
  input.players[0].maxHealth = 50;
  input.players[0].health = 45;
  input.gameData.turnData.shipsMadeThisTurnByPlayerId = { p2: 2 };
  input.gameData.ships = { p2: [{ instanceId: 'new-bot-ship', createdTurn: 5 }] };
  input.gameData.phaseReadiness = [{ playerId: 'p2', isReady: true, currentStep: 'build.drawing' }];
  const owned = pending(input);
  const result = complete(owned, null);
  assert(result);
  equal(result.left.maxHealth, 35);
  equal(result.left.finalHealth, 35);
  equal(result.left.startHealth, 30);
  input.gameData.lastTurnHealthResolution.maxHealthByPlayerId.p1 = 999;
  input.gameData.lastTurnDamageByPlayerId.p1 = 1000;
  input.players[0].health = -900;
  equal(complete(owned, archive)?.left.damageTaken, 10);
  assert(Object.isFrozen(owned.state.players[0]));
});

Deno.test('resolving intent without current caps completes immediately from exact facts', () => {
  const input = resolved();
  const archive = history(input);
  delete input.players[0].maxHealth;
  delete input.players[1].maxHealth;
  const owned = prepareResolvedHealthCapture({ state: input, identity, continuityKey, resolvedTurnNumber: 4, source: 'intent' });
  assert(owned);
  const result = complete(owned, archive);
  assert(result);
  equal(result.source, 'intent');
  equal(result.left.maxHealth, 35);
});

Deno.test('matching terminal poll caps can complete an intent without waiting for history', () => {
  const input = state(); input.status = 'finished'; input.resultReason = 'decisive'; input.winnerPlayerId = 'p1';
  const boundary = structuredClone(input);
  delete input.players[0].maxHealth; delete input.players[1].maxHealth;
  const owned = pending(input);
  const result = captureResolvedHealthSnapshot({ ...owned, liveCapture: owned, boundaryState: boundary });
  assert(result);
  equal(result.left.maxHealth, 35);
  boundary.players[0].health = 21;
  assert(captureResolvedHealthSnapshot({ ...owned, liveCapture: owned, boundaryState: boundary }) === null);
});

Deno.test('post-resolution fleet work is supported only with exact captured provenance', () => {
  for (const change of [
    (s: any) => { s.publicState = { ancient: { materializedSimulacrumFleetInstanceIdsByPlayerId: { p1: ['copy'] } } }; },
    (s: any) => { s.gameData.turnData.shipsMadeThisTurnByPlayerId = { p1: 1 }; },
    (s: any) => { s.gameData.ships = { p1: [{ instanceId: 'new', createdTurn: 5 }] }; },
    (s: any) => { s.publicState = { phaseReadiness: [{ playerId: 'p1', isReady: true }] }; },
  ]) {
    const input = state(30, 0, 0);
    input.turnNumber = 5; input.phaseKey = 'build.drawing';
    input.players[0].maxHealth = 40;
    change(input);
    assert(prepareResolvedHealthCapture({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll' }) === null);
    equal(buildSettledHealthPresentation(input, identity)?.mode, 'settled');
    // Capture N's facts, then simulate independent N+1 fleet/cap changes.
    input.players[0].maxHealth = 35;
    resolved(input);
    input.players[0].maxHealth = 50;
    const exact = complete(pending(input), null);
    assert(exact);
    equal(exact.left.maxHealth, 35);
  }
  const input = state(); input.turnNumber = 5; input.phaseKey = 'build.drawing';
  assert(prepareResolvedHealthCapture({ state: input, identity, continuityKey,
    resolvedTurnNumber: 4, source: 'intent' }) === null);
});

for (const cap of [35, 45]) {
  Deno.test(`exact cap ${cap} requires a live observation, not history or a numeric special case`, () => {
    const input = state(30, 0, 0, cap);
    input.turnNumber = 5;
    input.phaseKey = 'build.drawing';
    const archive = history(input, { p1: cap, p2: 35 });
    assert(captureResolvedHealthSnapshot({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll', history: archive }) === null);
    assert(prepareResolvedHealthCapture({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll' }) === null);
    const result = complete(pending(resolved(input)), null);
    assert(result);
    equal(result.left.maxHealth, cap);
  });
}

Deno.test('sparse/incompatible history settles without manufacturing caps or contributions', () => {
  const input = state();
  input.turnNumber = 5;
  input.phaseKey = 'build.drawing';
  for (const change of [
    (h: any) => { h.turns = []; }, (h: any) => { delete h.turns[0].analysisByPlayerId; },
    (h: any) => { delete h.turns[0].players[0].maxHealthEnd; },
    (h: any) => { h.turns[0].players[0].maxHealthEnd = NaN; },
    (h: any) => { h.turns[0].players[0].maxHealthEnd = 0; },
    (h: any) => { h.gameId = 'other'; }, (h: any) => { h.turns[0].turnNumber = 3; },
    (h: any) => { h.turns[0].players[0].playerId = 'other'; },
    (h: any) => { h.turns[0].analysisByPlayerId.p1.healReceived = 10; },
  ]) {
    const archive = history(input);
    change(archive);
    assert(captureResolvedHealthSnapshot({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll', history: archive }) === null);
  }
  const settled = buildSettledHealthPresentation(input, identity);
  assert(settled?.mode === 'settled');
  equal(settled.left.health, 20);
});

Deno.test('public projection selectors preserve aggregate availability without breakdown rows', () => {
  const input = state();
  input.publicState = { players: input.players, lastTurnStats: {
    damageByPlayerId: input.gameData.lastTurnDamageByPlayerId,
    healByPlayerId: input.gameData.lastTurnHealByPlayerId,
    netByPlayerId: input.gameData.lastTurnNetByPlayerId,
  } };
  delete input.gameData.lastTurnDamageByPlayerId;
  delete input.gameData.lastTurnHealByPlayerId;
  delete input.gameData.lastTurnNetByPlayerId;
  assert(capture(input));
});

Deno.test('exact full-state projections animate adjacent polls in viewer and spectator order', () => {
  const input = resolved();
  const metadata = input.gameData.lastTurnHealthResolution;
  input.publicState = { players: input.players, lastTurnStats: {
    healthResolution: metadata,
    damageByPlayerId: input.gameData.lastTurnDamageByPlayerId,
    healByPlayerId: input.gameData.lastTurnHealByPlayerId,
    netByPlayerId: input.gameData.lastTurnNetByPlayerId,
  } };
  delete input.gameData;
  const observation = observeHealthResolution(observed(4), observed(5));
  equal(observation.resolvedTurnNumber, 4);
  const poll = capture(input); assert(poll);
  equal([poll.left.playerId, poll.left.maxHealth], ['p1', 35]);
  equal(capture(input, { ...identity, viewerId: 'p2', leftPlayerId: 'p2', rightPlayerId: 'p1' })?.left.damageTaken, 2);
  equal(capture(input, { ...identity, viewerId: 's1', viewerRole: 'spectator' })?.left.playerId, 'p1');
  // A stored record never changes the observation gate on load/refresh/resume.
  for (const previous of [null, { ...observed(5), resumeToken: -1 }]) {
    equal(observeHealthResolution(previous, observed(5)), { resolvedTurnNumber: null, recovery: true });
  }
});

Deno.test('malformed explicit facts cannot borrow current caps or matching history', () => {
  for (const change of [
    (s: any) => { s.gameData.lastTurnHealthResolution = null; },
    (s: any) => { s.gameData.lastTurnHealthResolution.resolvedTurnNumber = 3; },
    (s: any) => { delete s.gameData.lastTurnHealthResolution.finalHealthByPlayerId.p2; },
    (s: any) => { s.gameData.lastTurnHealthResolution.maxHealthByPlayerId.p1 = Infinity; },
    (s: any) => { s.gameData.lastTurnHealthResolution.maxHealthByPlayerId.p1 = 0; },
    (s: any) => { s.gameData.lastTurnHealthResolution.finalHealthByPlayerId.p1 = 99; },
    (s: any) => { s.gameData.lastTurnHealthResolution.finalHealthByPlayerId.other = 20; },
    (s: any) => { s.gameData.lastTurnNetByPlayerId.p1 = NaN; },
    (s: any) => { s.gameData.lastTurnHealByPlayerId.p1 = -1; },
  ]) {
    const input = resolved(); const archive = history(input); change(input);
    assert(prepareResolvedHealthCapture({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll' }) === null);
    assert(captureResolvedHealthSnapshot({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll', history: archive }) === null);
  }
});

Deno.test('incomplete public resolution envelopes never mix raw-state totals or provenance', () => {
  for (const missing of ['healthResolution', 'damageByPlayerId', 'healByPlayerId', 'netByPlayerId']) {
    const input = resolved();
    input.publicState = { lastTurnStats: {
      healthResolution: input.gameData.lastTurnHealthResolution,
      damageByPlayerId: input.gameData.lastTurnDamageByPlayerId,
      healByPlayerId: input.gameData.lastTurnHealByPlayerId,
      netByPlayerId: input.gameData.lastTurnNetByPlayerId,
    } };
    delete input.publicState.lastTurnStats[missing];
    assert(prepareResolvedHealthCapture({ state: input, identity, continuityKey,
      resolvedTurnNumber: 4, source: 'poll' }) === null);
    assert(capture(input) === null);
  }
});

Deno.test('requester-relative and spectator ordering use canonical seat selectors', () => {
  const input = state();
  const requester = { ...identity, viewerId: 'p2', leftPlayerId: 'p2', rightPlayerId: 'p1' };
  const spectator: ResolvedHealthIdentity = { ...identity, viewerId: 's1', viewerRole: 'spectator' };
  equal(capture(input, requester)?.left.damageTaken, 2);
  equal(capture(input, requester)?.right.damageTaken, 10);
  equal(capture(input, spectator)?.left.damageTaken, 10);
  assert(getResolvedHealthIdentityKey(requester) !== getResolvedHealthIdentityKey(spectator));
  assert(capture(input, { ...spectator, leftPlayerId: 'p2', rightPlayerId: 'p1' }) === null);
});

Deno.test('invalid game, turn, players, viewer and nonfinite/incoherent values reject capture', () => {
  for (const change of [
    (s: any) => { s.gameId = 'other'; }, (s: any) => { s.turnNumber = 9; },
    (s: any) => { s.players[0].id = 'other'; }, (s: any) => { s.players.push({ ...s.players[0] }); },
    (s: any) => { delete s.gameData.lastTurnDamageByPlayerId.p1; },
    (s: any) => { s.gameData.lastTurnHealByPlayerId.p1 = -1; },
    (s: any) => { s.gameData.lastTurnNetByPlayerId.p1 = NaN; },
    (s: any) => { s.players[0].health = Infinity; },
    (s: any) => { s.gameData.lastTurnNetByPlayerId.p1 = 10; },
  ]) {
    const input = state(); change(input); assert(capture(input) === null);
  }
  assert(capture(state(), { ...identity, viewerId: 's1' }) === null);
  assert(capture(state(), { ...identity, rightPlayerId: 'p1' }) === null);
});

for (const [damage, healing, reason, winner] of [
  [20, 8, 'decisive', 'p2'], [30, 5, 'narrow', 'p1'], [30, 5, 'mutual_destruction', null],
] as const) {
  Deno.test(`canonical terminal ${reason} preserves zero/negative results`, () => {
    const input = state(12, damage, healing);
    input.status = 'finished'; input.result = { resultReason: reason, winnerPlayerId: winner };
    input.players[1].health = -20;
    input.gameData.lastTurnDamageByPlayerId.p2 = 50;
    input.gameData.lastTurnNetByPlayerId.p2 = -50;
    const result = capture(input);
    assert(result);
    equal(result.left.finalHealth, 12 - damage + healing);
    equal(result.outcome, { isTerminal: true, winnerPlayerId: winner, resultReason: reason });
    resolved(input); input.turnNumber = 4;
    equal(capture(input)?.left, result.left);
  });
}

for (const reason of ['resignation', 'timeout', 'agreed_draw', 'restart']) {
  Deno.test(`${reason} remains settled without a synthetic health sequence`, () => {
    const input = state(); input.status = 'finished'; input.resultReason = reason;
    assert(capture(input) === null);
    assert(prepareResolvedHealthCapture({ state: input, identity, continuityKey, resolvedTurnNumber: 4, source: 'poll' }) === null);
    equal(buildSettledHealthPresentation(input, identity)?.mode, 'settled');
  });
}

function observed(turnNumber: number, isFinished = false): HealthResolutionObservation {
  return { gameId: 'g', identityKey: getResolvedHealthIdentityKey(identity), resumeToken: 0, turnNumber, isFinished };
}
Deno.test('adjacent observation identifies N; multi-turn/terminal gaps never label latest totals as N', () => {
  equal(observeHealthResolution(observed(4), observed(5)), { resolvedTurnNumber: 4, recovery: false });
  equal(observeHealthResolution(observed(4), observed(4, true)), { resolvedTurnNumber: 4, recovery: false });
  for (const next of [observed(7), observed(5, true), observed(2)]) {
    equal(observeHealthResolution(observed(4), next), { resolvedTurnNumber: null, recovery: true });
  }
  equal(observeHealthResolution({ ...observed(4), wasLegacyHealthHold: true }, observed(5)),
    { resolvedTurnNumber: null, recovery: true });
});
Deno.test('initial load, refresh, resume and changed orientation seed settled observation', () => {
  for (const previous of [null, { ...observed(4), gameId: 'old' },
    { ...observed(4), identityKey: 'other' }, { ...observed(4), resumeToken: -1 }]) {
    equal(observeHealthResolution(previous, observed(5)), { resolvedTurnNumber: null, recovery: true });
  }
  equal(observeHealthResolution(observed(5), observed(5)), { resolvedTurnNumber: null, recovery: false });
});

Deno.test('explicit intent identity wins; malformed/multiple finalizations do not invent replay turns', () => {
  const result = { ok: true, state: state(), events: [{ type: 'BATTLE_LOG_FINALIZE_TURN', finalizedTurnNumber: 4 }] };
  equal(getIntentResolvedHealthTurn(result, 3), 4);
  equal(getIntentResolvedHealthTurn({ ...result, events: [{ type: 'BATTLE_LOG_FINALIZE_TURN' }] }, 4), null);
  equal(getIntentResolvedHealthTurn({ ...result, events: [...result.events, { ...result.events[0], finalizedTurnNumber: 5 }] }, 4), null);
  const aggregate = { ...result, events: [{ type: 'EFFECT_APPLIED', kind: 'AggregatedHealthChange' }] };
  equal(getIntentResolvedHealthTurn(aggregate, 4), 4);
  equal(getIntentResolvedHealthTurn(aggregate), null);
});

Deno.test('duplicate intent/poll payloads cannot replace an accepted immutable identity', () => {
  const first = capture(state(), identity, 'intent'); assert(first);
  const poll = capture(state(30, 2, 0, 45), identity, 'poll'); assert(poll);
  equal(first.presentationKey, poll.presentationKey);
  const held = transitionResolvedHealth(createResolvedHealthState(), { type: 'sync', continuityKey, candidate: first });
  assert(transitionResolvedHealth(held, { type: 'sync', continuityKey, candidate: poll }) === held);
});
