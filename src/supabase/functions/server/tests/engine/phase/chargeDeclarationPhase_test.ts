import assert from 'node:assert/strict';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
import { onEnterPhase } from '../../../engine/phase/onEnterPhase.ts';
import {
  isValidPhaseKey,
  PHASE_SEQUENCE,
} from '../../../engine_shared/phase/PhaseTable.ts';

function createDeclarationState(args: {
  p1Ships?: any[];
  p2Ships?: any[];
  p1Health?: number;
} = {}): any {
  return {
    gameId: 'charge-declaration-phase-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'p1', role: 'player', faction: 'human', health: args.p1Health ?? 20, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 20, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      phaseReadiness: [],
      ships: {
        p1: args.p1Ships ?? [],
        p2: args.p2Ships ?? [],
      },
      voidShipsByPlayerId: { p1: [], p2: [] },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        chargePowerUsedByInstanceId: {},
      },
    },
  };
}

function enteredDeclaration(state: any, nowMs = 100): { state: any; events: any[] } {
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.turnData.currentSubPhase = 'charge_declaration';
  return onEnterPhase(state, 'battle.first_strike', 'battle.charge_declaration', nowMs);
}

function directEndOfTurnEvent(events: any[]): boolean {
  return events.some((event) =>
    event.type === 'PHASE_ADVANCED' &&
    event.from === 'battle.charge_declaration' &&
    event.to === 'battle.end_of_turn_resolution'
  );
}

Deno.test('Battle phase sequence makes Charge Declaration the final choice window', () => {
  assert.deepEqual(PHASE_SEQUENCE.slice(-4), [
    'battle.reveal',
    'battle.first_strike',
    'battle.charge_declaration',
    'battle.end_of_turn_resolution',
  ]);
  assert.equal(isValidPhaseKey('battle.charge_response'), false);
});

Deno.test('no-input Charge Declaration auto-readies and advances directly through End of Turn', () => {
  const result = enteredDeclaration(createDeclarationState());

  assert.equal(directEndOfTurnEvent(result.events), true);
  assert.equal(result.state.gameData.turnNumber, 4);
  assert.equal(result.state.gameData.turnData.chargeDeclarationVisibilitySnapshot, undefined);
  assert.equal(result.state.gameData.turnData.chargeDeclarationAcknowledgements, undefined);
});

Deno.test('mixed Declaration eligibility waits for the active player then advances directly through End of Turn', async () => {
  const entered = enteredDeclaration(createDeclarationState({
    p2Ships: [{ instanceId: 'p2-int', shipDefId: 'INT', chargesCurrent: 1 }],
  }));

  assert.equal(entered.state.gameData.currentSubPhase, 'charge_declaration');
  assert.equal(
    entered.state.gameData.phaseReadiness.some((entry: any) =>
      entry.playerId === 'p1' && entry.isReady === true &&
      entry.currentStep === 'battle.charge_declaration'
    ),
    true,
  );
  assert.equal(
    entered.state.gameData.phaseReadiness.some((entry: any) => entry.playerId === 'p2'),
    false,
  );

  const action = await applyIntent(entered.state, 'p2', {
    gameId: entered.state.gameId,
    intentType: 'ACTION',
    turnNumber: 3,
    nonce: 'mixed-p2-charge',
    payload: {
      actionType: 'power',
      actionId: 'INT#0',
      sourceInstanceId: 'p2-int',
      choiceId: 'damage',
    },
  }, 101);
  assert.equal(action.ok, true, action.rejected?.message);
  assert.equal(action.state.gameData.currentSubPhase, 'charge_declaration');

  const ready = await applyIntent(action.state, 'p2', {
    gameId: action.state.gameId,
    intentType: 'DECLARE_READY',
    turnNumber: 3,
    nonce: 'mixed-p2-ready',
    payload: {},
  }, 102);

  assert.equal(ready.ok, true, ready.rejected?.message);
  assert.equal(directEndOfTurnEvent(ready.events), true);
  assert.equal(ready.state.players.find((player: any) => player.id === 'p1').health, 15);
  assert.equal(ready.state.gameData.turnData.chargeDeclarationVisibilitySnapshot, undefined);
  assert.equal(ready.state.gameData.turnData.chargeDeclarationAcknowledgements, undefined);
});
