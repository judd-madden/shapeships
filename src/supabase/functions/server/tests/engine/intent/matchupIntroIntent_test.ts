import assert from 'node:assert/strict';
import { accrueClocks, clocksAreLive } from '../../../engine/clock/clock.ts';
import {
  applyIntent,
  MATCHUP_INTRO_DURATION_MS,
  type IntentRequest,
} from '../../../engine/intent/IntentReducer.ts';
import { RejectionCode } from '../../../engine/intent/IntentTypes.ts';
import { normalizeAncientGameState } from '../../../engine/state/ancientState.ts';

function setupMultiplayerState(timed = true) {
  return normalizeAncientGameState({
    gameId: 'matchup-intro-game',
    status: 'active',
    currentPhase: 'setup',
    currentSubPhase: 'species_selection',
    turnNumber: 0,
    players: [
      { id: 'p1', name: 'Player One', role: 'player', faction: null, health: 25, lines: 3, joiningLines: 0 },
      { id: 'p2', name: 'Player Two', role: 'player', faction: null, health: 25, lines: 3, joiningLines: 0 },
      { id: 'spec', name: 'Spectator', role: 'spectator', faction: null, health: 0, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {},
    gameData: {
      turnNumber: 0,
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      phaseReadiness: [],
      ships: { p1: [], p2: [] },
      ...(timed ? {
        clock: {
          timeControl: { baseMs: 60_000, incrementMs: 0 },
          remainingMsByPlayerId: { p1: 60_000, p2: 60_000 },
          lastUpdateAtMs: 500,
          incrementAppliedTurnByPlayerId: {},
        },
      } : {}),
      turnData: {
        turnNumber: 0,
        currentMajorPhase: 'setup',
        currentSubPhase: 'species_selection',
        commitments: {},
      },
    },
    actions: [],
  }).state;
}

function speciesIntent(playerId: 'p1' | 'p2', species: 'human' | 'xenite'): IntentRequest {
  return {
    gameId: 'matchup-intro-game',
    intentType: 'SPECIES_SUBMIT',
    turnNumber: 0,
    payload: { species },
    nonce: `nonce-${playerId}`,
  };
}

function intent(intentType: IntentRequest['intentType'], payload?: unknown): IntentRequest {
  return {
    gameId: 'matchup-intro-game',
    intentType,
    turnNumber: 0,
    payload,
    nonce: `nonce-${intentType}`,
  };
}

async function createHeldState(timed = true) {
  const first = await applyIntent(setupMultiplayerState(timed), 'p1', speciesIntent('p1', 'human'), 1_000);
  assert.equal(first.ok, true);
  assert.equal(first.state.gameData.turnData.phaseHold, undefined);
  assert.equal(first.state.gameData.turnData.baseDiceRoll, undefined);

  const second = await applyIntent(first.state, 'p2', speciesIntent('p2', 'xenite'), 2_000);
  assert.equal(second.ok, true);
  return second.state;
}

Deno.test('multiplayer species resolution creates one exact authoritative Turn 0 hold', async () => {
  const state = await createHeldState();
  const hold = state.gameData.turnData.phaseHold;
  assert.equal(state.gameData.currentPhase, 'setup');
  assert.equal(state.gameData.currentSubPhase, 'species_selection');
  assert.equal(state.gameData.turnNumber, 0);
  assert.equal(hold.holdReason, 'matchup_intro');
  assert.equal(hold.holdStartedAtMs, 2_000);
  assert.equal(hold.holdUntilMs - hold.holdStartedAtMs, MATCHUP_INTRO_DURATION_MS);
  assert.equal(state.gameData.turnData.baseDiceRoll, undefined);

  const retry = await applyIntent(state, 'p2', speciesIntent('p2', 'xenite'), 2_500);
  assert.equal(retry.ok, true);
  assert.equal(retry.state.gameData.turnData.phaseHold.holdUntilMs, hold.holdUntilMs);
});

Deno.test('continuation is early-safe and releases the normal opening exactly once', async () => {
  const held = await createHeldState();
  const early = await applyIntent(held, 'p1', intent('CONTINUE_PHASE_HOLD'), 4_999);
  assert.equal(early.ok, true);
  assert.equal(early.state.gameData.turnNumber, 0);
  assert.equal(early.state.gameData.turnData.phaseHold.holdReason, 'matchup_intro');
  assert.equal(early.state.gameData.turnData.baseDiceRoll, undefined);

  const released = await applyIntent(early.state, 'p2', intent('CONTINUE_PHASE_HOLD'), 5_000);
  assert.equal(released.ok, true);
  assert.equal(released.state.gameData.turnNumber, 1);
  assert.equal(released.state.gameData.currentPhase, 'build');
  assert.ok(released.events.some((event: any) =>
    event?.type === 'PHASE_ADVANCED' && event?.to === 'build.dice_roll'
  ));
  assert.equal(released.state.gameData.turnData.phaseHold, undefined);
  assert.ok(Number.isInteger(released.state.gameData.turnData.baseDiceRoll));
  const openingRoll = released.state.gameData.turnData.baseDiceRoll;

  const duplicate = await applyIntent(released.state, 'p1', intent('CONTINUE_PHASE_HOLD'), 5_001);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.state.gameData.turnNumber, 1);
  assert.equal(duplicate.state.gameData.turnData.baseDiceRoll, openingRoll);

  const noHold = await applyIntent(setupMultiplayerState(), 'p1', intent('CONTINUE_PHASE_HOLD'), 1_000);
  assert.equal(noHold.ok, true);
  assert.equal(noHold.state.gameData.turnNumber, 0);
});

Deno.test('matchup hold narrows setup interaction and spectators cannot release it', async () => {
  const held = await createHeldState();
  const action = await applyIntent(held, 'p1', intent('ACTION', { actionType: 'power' }), 2_100);
  assert.equal(action.ok, false);
  assert.equal(action.rejected?.code, RejectionCode.PHASE_NOT_ALLOWED);

  const missionAck = await applyIntent(held, 'p1', intent('MISSION_INTRO_ACK'), 2_100);
  assert.equal(missionAck.ok, false);
  assert.equal(missionAck.rejected?.code, RejectionCode.PHASE_NOT_ALLOWED);

  const spectator = await applyIntent(held, 'spec', intent('CONTINUE_PHASE_HOLD'), 5_000);
  assert.equal(spectator.ok, false);
  assert.equal(spectator.rejected?.code, RejectionCode.SPECTATOR_RESTRICTED);
});

Deno.test('clocks remain fresh without intro deduction and surrender hides through finished state', async () => {
  const held = await createHeldState();
  assert.equal(clocksAreLive(held), false);
  const accrued = accrueClocks(held, 4_000);
  assert.deepEqual(accrued.gameData.clock.remainingMsByPlayerId, { p1: 60_000, p2: 60_000 });
  assert.equal(accrued.gameData.clock.lastUpdateAtMs, 4_000);

  const untimed = await createHeldState(false);
  assert.equal(clocksAreLive(untimed), false);
  assert.equal(untimed.gameData.clock, undefined);

  const surrendered = await applyIntent(held, 'p1', intent('SURRENDER'), 2_100);
  assert.equal(surrendered.ok, true);
  assert.equal(surrendered.state.status, 'finished');
  assert.equal(surrendered.state.gameData.turnData.phaseHold.holdReason, 'matchup_intro');
});

Deno.test('computer species resolution keeps Mission gating and never creates a matchup hold', async () => {
  const computer = setupMultiplayerState(false);
  computer.players = computer.players.filter((player: any) => player.role === 'player');
  computer.players[1].name = 'Computer';
  computer.controllersByPlayerId = {
    p1: { kind: 'human' },
    p2: { kind: 'bot', speciesId: null, chosenPlanId: null },
  };

  const result = await applyIntent(computer, 'p1', {
    ...speciesIntent('p1', 'human'),
    payload: { species: 'human', botSpecies: 'xenite' },
  }, 1_000);

  assert.equal(result.ok, true);
  assert.equal(result.state.gameData.turnData.phaseHold?.holdReason, undefined);
  assert.equal(result.state.gameData.turnNumber, 1);
  assert.equal(result.state.missionChallengeAssignment?.introPending, true);
});
