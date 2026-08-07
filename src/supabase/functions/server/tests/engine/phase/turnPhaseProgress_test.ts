import assert from 'node:assert/strict';
import { advancePhaseCore } from '../../../engine/phase/advancePhase.ts';
import { sanitizeAncientStateForClient } from '../../../engine/state/ancientState.ts';
import {
  ensureFinalizedDiceTurnPhaseProgress,
  initializeDiceRollTurnPhaseProgress,
  markOptionalTurnPhaseOccurred,
  projectPublicTurnPhaseProgress,
  refreshFinalizedDiceTurnPhaseProgress,
  refreshPostFirstStrikeChargesProgress,
  refreshRevealedTurnPhaseProgress,
} from '../../../engine/phase/turnPhaseProgress.ts';

function createState(args: {
  p1Faction?: string;
  p1Ships?: any[];
  p2Ships?: any[];
  effectiveDie?: number;
  ancientEnergy?: any;
  firstStrikeMarker?: boolean;
} = {}): any {
  const turnNumber = 3;
  const p1Ships = args.p1Ships ?? [];
  return {
    gameId: 'turn-phase-progress-test',
    status: 'active',
    turnNumber,
    currentPhase: 'build',
    currentSubPhase: 'dice_roll',
    players: [
      { id: 'p1', role: 'player', faction: args.p1Faction ?? 'human', health: 25 },
      { id: 'p2', role: 'player', faction: 'human', health: 25 },
    ],
    gameData: {
      turnNumber,
      currentPhase: 'build',
      currentSubPhase: 'dice_roll',
      ships: { p1: p1Ships, p2: args.p2Ships ?? [] },
      voidShipsByPlayerId: { p1: [], p2: [] },
      phaseReadiness: [],
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: args.ancientEnergy ?? {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber,
        currentMajorPhase: 'build',
        currentSubPhase: 'dice_roll',
        effectiveDiceRollByPlayerId: {
          p1: args.effectiveDie ?? 1,
          p2: args.effectiveDie ?? 1,
        },
        chargePowerUsedByInstanceId: {},
        ...(args.firstStrikeMarker
          ? {
              thirdSpiralFirstStrikeEligibilityByPlayerId: {
                p1: { sourceInstanceId: 'spi-3', turnNumber },
              },
            }
          : {}),
      },
    },
  };
}

Deno.test('Dice Roll initializes public optional forecasts from current authoritative work', () => {
  const noSources = initializeDiceRollTurnPhaseProgress(createState());
  assert.deepEqual(projectPublicTurnPhaseProgress(noSources), {
    turnNumber: 3,
    firstStrike: { expected: false, occurred: false },
    charges: { expected: false, occurred: false },
  });

  const ordinaryCharge = initializeDiceRollTurnPhaseProgress(createState({
    p1Ships: [{ instanceId: 'int-1', shipDefId: 'INT', chargesCurrent: 1 }],
  }));
  assert.equal(projectPublicTurnPhaseProgress(ordinaryCharge)?.charges.expected, true);

  const firstStrike = initializeDiceRollTurnPhaseProgress(createState({
    p1Ships: [
      { instanceId: 'spi-1', shipDefId: 'SPI', createdTurn: 3 },
      { instanceId: 'spi-2', shipDefId: 'SPI', createdTurn: 3 },
      { instanceId: 'spi-3', shipDefId: 'SPI', createdTurn: 3 },
    ],
    p2Ships: [{ instanceId: 'target', shipDefId: 'DEF' }],
    firstStrikeMarker: true,
  }));
  assert.equal(projectPublicTurnPhaseProgress(firstStrike)?.firstStrike.expected, true);
});

Deno.test('pre-Reveal Ancient forecast includes guaranteed sources, excludes QUA until finalized dice', () => {
  const core = initializeDiceRollTurnPhaseProgress(createState({
    p1Faction: 'ancient',
    p1Ships: [{ instanceId: 'plu-1', shipDefId: 'PLU' }],
  }));
  assert.equal(projectPublicTurnPhaseProgress(core)?.charges.expected, true);

  const solar = initializeDiceRollTurnPhaseProgress(createState({
    p1Faction: 'ancient',
    p1Ships: [{ instanceId: 'sol-1', shipDefId: 'SOL', chargesCurrent: 1 }],
  }));
  assert.equal(projectPublicTurnPhaseProgress(solar)?.charges.expected, true);

  const quantumState = createState({
    p1Faction: 'ancient',
    effectiveDie: 4,
    p1Ships: [{
      instanceId: 'qua-1',
      shipDefId: 'QUA',
      permanentConfiguration: { selectedNumber: 4 },
    }],
    ancientEnergy: {
      p1: {
        battleTurnNumber: 2,
        pool: { green: 9, red: 9, blue: 9 },
        sources: [],
      },
    },
  });
  const diceRoll = initializeDiceRollTurnPhaseProgress(quantumState);
  assert.equal(projectPublicTurnPhaseProgress(diceRoll)?.charges.expected, false);
  const lineGeneration = refreshFinalizedDiceTurnPhaseProgress(diceRoll);
  assert.equal(projectPublicTurnPhaseProgress(lineGeneration)?.charges.expected, true);

  const nonmatching = createState({
    p1Faction: 'ancient',
    effectiveDie: 5,
    p1Ships: quantumState.gameData.ships.p1,
  });
  assert.equal(
    projectPublicTurnPhaseProgress(refreshFinalizedDiceTurnPhaseProgress(nonmatching))?.charges.expected,
    false,
  );
});

Deno.test('Drawing fallback is idempotent and does not recompute an existing snapshot', () => {
  const frozen = initializeDiceRollTurnPhaseProgress(createState());
  frozen.gameData.ships.p1.push({ instanceId: 'hidden-int', shipDefId: 'INT', chargesCurrent: 1 });
  const ensured = ensureFinalizedDiceTurnPhaseProgress(frozen);
  assert.equal(ensured, frozen);
  assert.equal(projectPublicTurnPhaseProgress(ensured)?.charges.expected, false);
  const revealed = refreshRevealedTurnPhaseProgress(ensured);
  assert.equal(projectPublicTurnPhaseProgress(revealed)?.charges.expected, true);
});

Deno.test('Reveal and post-First-Strike refreshes use live gates while occurrences remain latched', () => {
  let state = initializeDiceRollTurnPhaseProgress(createState({
    p1Ships: [{ instanceId: 'int-1', shipDefId: 'INT', chargesCurrent: 1 }],
  }));
  state = refreshRevealedTurnPhaseProgress(state);
  assert.equal(projectPublicTurnPhaseProgress(state)?.charges.expected, true);
  state = markOptionalTurnPhaseOccurred(state, 'firstStrike');
  state = markOptionalTurnPhaseOccurred(state, 'charges');
  state.gameData.ships.p1 = [];
  state = refreshPostFirstStrikeChargesProgress(state);
  assert.deepEqual(projectPublicTurnPhaseProgress(state), {
    turnNumber: 3,
    firstStrike: { expected: false, occurred: true },
    charges: { expected: false, occurred: true },
  });
});

Deno.test('new-turn advance clears the completed turn snapshot', () => {
  const state = markOptionalTurnPhaseOccurred(
    initializeDiceRollTurnPhaseProgress(createState()),
    'firstStrike',
  );
  state.currentPhase = 'battle';
  state.currentSubPhase = 'end_of_turn_resolution';
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'end_of_turn_resolution';
  state.gameData.turnData.currentMajorPhase = 'battle';
  state.gameData.turnData.currentSubPhase = 'end_of_turn_resolution';

  const advanced = advancePhaseCore(state, 1000);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.equal(advanced.state.gameData?.turnNumber, 4);
  assert.equal(advanced.state.gameData?.turnData?.turnPhaseProgress, undefined);
});

Deno.test('shared client-state sanitizer strips the internal progress snapshot', () => {
  const state = initializeDiceRollTurnPhaseProgress(createState());
  const sanitized: any = sanitizeAncientStateForClient(state, 'p1');
  assert.equal('turnPhaseProgress' in sanitized.gameData.turnData, false);

  state.currentPhase = 'setup';
  state.currentSubPhase = 'species_selection';
  state.gameData.currentPhase = 'setup';
  state.gameData.currentSubPhase = 'species_selection';
  assert.equal(projectPublicTurnPhaseProgress(state), undefined);
});
