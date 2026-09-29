import assert from 'node:assert/strict';
import { fleetHasAvailablePowers } from '../../../engine/phase/fleetHasAvailablePowers.ts';
import { advancePhaseCore } from '../../../engine/phase/advancePhase.ts';
import {
  isThirdSpiralFirstStrikeEligible,
  recordThirdSpiralFirstStrikeEligibility,
} from '../../../engine_shared/resolve/thirdSpiralFirstStrikeEligibility.ts';

function spiral(instanceId: string, createdTurn = 3) {
  return { instanceId, shipDefId: 'SPI', createdTurn };
}

function createState(args: {
  spirals?: any[];
  opponentFleet?: any[];
  markerSourceId?: string;
  markerTurnNumber?: number;
  fired?: boolean;
} = {}): any {
  const turnNumber = 3;
  const markerSourceId = args.markerSourceId;
  return {
    gameId: 'third-spiral-first-strike-test',
    status: 'active',
    turnNumber,
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 25, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      ships: {
        p1: args.spirals ?? [],
        p2: args.opponentFleet ?? [{ instanceId: 'enemy-def', shipDefId: 'DEF' }],
      },
      powerMemory: args.fired && markerSourceId
        ? { onceOnlyFired: { [`${markerSourceId}::SPI#0`]: true } }
        : {},
      phaseReadiness: [],
      turnData: {
        turnNumber,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        ...(markerSourceId
          ? {
              thirdSpiralFirstStrikeEligibilityByPlayerId: {
                p1: {
                  sourceInstanceId: markerSourceId,
                  turnNumber: args.markerTurnNumber ?? turnNumber,
                },
              },
            }
          : {}),
      },
    },
  };
}

Deno.test('second-Spiral marker recorder is exact and the third cannot replace it', () => {
  const state = createState();
  recordThirdSpiralFirstStrikeEligibility({
    state,
    playerId: 'p1',
    sourceInstanceId: 'first',
    turnNumber: 3,
    controlledSpiralCountBeforeCreation: 0,
  });
  assert.equal(state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId, undefined);

  recordThirdSpiralFirstStrikeEligibility({
    state,
    playerId: 'p1',
    sourceInstanceId: 'qualifying',
    turnNumber: 3,
    controlledSpiralCountBeforeCreation: 1,
  });
  recordThirdSpiralFirstStrikeEligibility({
    state,
    playerId: 'p1',
    sourceInstanceId: 'replacement-attempt',
    turnNumber: 3,
    controlledSpiralCountBeforeCreation: 2,
  });
  assert.deepEqual(
    state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId,
    { p1: { sourceInstanceId: 'qualifying', turnNumber: 3 } },
  );
});

Deno.test('first, second, and unmarked third Spirals never pause First Strike', () => {
  for (const spirals of [
    [spiral('spi-1')],
    [spiral('spi-1'), spiral('spi-2')],
    [spiral('spi-1'), spiral('spi-2'), spiral('spi-3')],
  ]) {
    assert.equal(
      fleetHasAvailablePowers(createState({ spirals }), 'battle.first_strike', 'p1'),
      false,
    );
  }
});

Deno.test('only the marked current-turn second Spiral pauses when a legal target exists', () => {
  const state = createState({
    spirals: [spiral('spi-1'), spiral('spi-2'), spiral('spi-3')],
    markerSourceId: 'spi-2',
  });
  assert.equal(isThirdSpiralFirstStrikeEligible(state, 'p1', 'spi-1'), false);
  assert.equal(isThirdSpiralFirstStrikeEligible(state, 'p1', 'spi-2'), true);
  assert.equal(isThirdSpiralFirstStrikeEligible(state, 'p1', 'spi-3'), false);
  assert.equal(fleetHasAvailablePowers(state, 'battle.first_strike', 'p1'), true);
});

Deno.test('marked Spiral does not pause without legal targets or after firing or expiry', () => {
  const spirals = [spiral('spi-1'), spiral('spi-2'), spiral('spi-3')];
  const protectedOnly = createState({
    spirals,
    markerSourceId: 'spi-2',
    opponentFleet: [{ instanceId: 'enemy-core', shipDefId: 'PLU' }],
  });
  assert.equal(fleetHasAvailablePowers(protectedOnly, 'battle.first_strike', 'p1'), false);

  const fired = createState({ spirals, markerSourceId: 'spi-2', fired: true });
  assert.equal(fleetHasAvailablePowers(fired, 'battle.first_strike', 'p1'), false);

  const expired = createState({ spirals, markerSourceId: 'spi-2', markerTurnNumber: 2 });
  assert.equal(fleetHasAvailablePowers(expired, 'battle.first_strike', 'p1'), false);
});

Deno.test('transfer or recount creates no eligibility marker', () => {
  const state = createState({
    spirals: [spiral('spi-1', 1), spiral('spi-2', 2), spiral('stolen-spi', 3)],
  });
  assert.equal(isThirdSpiralFirstStrikeEligible(state, 'p1', 'stolen-spi'), false);
  assert.equal(fleetHasAvailablePowers(state, 'battle.first_strike', 'p1'), false);
});

Deno.test('new-turn reset clears third-Spiral eligibility scratch', () => {
  const state = createState({
    spirals: [spiral('spi-1'), spiral('spi-2'), spiral('spi-3')],
    markerSourceId: 'spi-2',
  });
  state.currentPhase = 'battle';
  state.currentSubPhase = 'end_of_turn_resolution';
  state.gameData.currentSubPhase = 'end_of_turn_resolution';
  state.gameData.turnData.currentSubPhase = 'end_of_turn_resolution';

  const advanced = advancePhaseCore(state, 1000);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.equal(
    advanced.state.gameData?.turnData?.thirdSpiralFirstStrikeEligibilityByPlayerId,
    undefined,
  );
  assert.equal(advanced.state.gameData?.turnNumber, 4);
});
