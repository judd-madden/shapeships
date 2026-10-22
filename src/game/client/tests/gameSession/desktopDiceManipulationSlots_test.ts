import { describe, expect, it } from 'vitest';
import { mapGameSessionVm } from '../../gameSession/mapVm';
import type { LeftRailDiceManipulationShipDefId } from '../../gameSession/types';

type MapperArgs = Parameters<typeof mapGameSessionVm>[0];
type HelperId = LeftRailDiceManipulationShipDefId;

const p1 = { id: 'p1', role: 'player', name: 'Player 1', species: 'human' };
const p2 = { id: 'p2', role: 'player', name: 'Player 2', species: 'ancient' };
const helperIds: HelperId[] = ['KNO', 'LEV', 'CUB', 'CHR'];
const fleet = (ids: HelperId[], createdTurn: unknown = 1) =>
  ids.map((shipDefId, index) => ({ shipDefId, instanceId: `${shipDefId}-${index}`, createdTurn }));

function mapperArgs(overrides: Partial<MapperArgs> = {}): MapperArgs {
  return {
    isBootstrapping: false,
    viewer: { viewerMode: 'p1_player', isSpectator: false, isPlayerViewer: true, p1Name: p1.name, p2Name: p2.name },
    matchupIntro: null,
    missionChallenge: null,
    winStreak: {
      currentCount: 0, displayCount: 0, streakState: 'hidden', shouldShowContent: false,
      appliedBonus: { count: 0, recipientPlayerId: null, recipientSide: null, turnOneHoverEligible: false },
      reset: { serverCanRestart: false, canSubmit: false, busy: false, retryAvailable: false, error: null },
    },
    me: p1,
    opponent: p2,
    displayLeftPlayer: p1,
    displayRightPlayer: p2,
    displayLeftSpeciesLabel: 'Human',
    displayRightSpeciesLabel: 'Ancient',
    displayLeftSpeciesId: 'human',
    displayRightSpeciesId: 'ancient',
    p1HasJoined: true,
    p2HasJoined: true,
    p1IsReady: false,
    p2IsReady: false,
    p1ClockFormatted: '00:00',
    p2ClockFormatted: '00:00',
    clockIncrementSeconds: null,
    clockIncrementScopeKey: null,
    clockIncrementTurnNumber: null,
    p1StatusTone: 'hidden',
    p2StatusTone: 'hidden',
    turnNumber: 5,
    phaseKey: 'build.dice_roll',
    phaseIcon: 'build',
    turnPhaseProgress: null,
    effectiveGameId: 'test-game',
    allPlayers: [p1, p2],
    activePanelId: 'ap.menu.root',
    tabs: [],
    buildCatalogue: {
      context: 'reference_only', unavailableExplanation: null, canAddShipById: {},
      displayCostByShipId: {}, eligibilityByShipId: {}, catalogueChallengeIndicator: null,
    },
    drawingStage: { kind: 'passive' },
    board: {
      mode: 'board', mySpeciesId: 'human', opponentSpeciesId: 'ancient', turnNumber: 5,
      showTurnStartEconomyPresentation: false,
      myHealth: 25, opponentHealth: 25, myMaxHealth: 25, opponentMaxHealth: 25,
      myFleet: [], opponentFleet: [], myVoidFleet: [], opponentVoidFleet: [],
      myAncientSolarEntries: [], opponentAncientSolarEntries: [],
      myFleetRenderOrder: [], opponentFleetRenderOrder: [],
      mobileDiceModifierSlots: { top: null, bottom: null },
      fleetAnim: { my: {}, opponent: {} },
      myLastTurnHeal: 0, myLastTurnDamage: 0, myLastTurnNet: 0,
      opponentLastTurnHeal: 0, opponentLastTurnDamage: 0, opponentLastTurnNet: 0,
      myLastDamageBreakdownRows: [], opponentLastDamageBreakdownRows: [],
      myLastHealingBreakdownRows: [], opponentLastHealingBreakdownRows: [],
      myBonusLines: 0, opponentBonusLines: 0, myBonusLinesOnEven: 0, opponentBonusLinesOnEven: 0,
      myDisplayedSavedLines: 0, opponentDisplayedSavedLines: 0,
      myDisplayedSavedJoiningLines: 0, opponentDisplayedSavedJoiningLines: 0,
      mySavedJoiningLines: 0, opponentSavedJoiningLines: 0,
      myJoiningBonusLines: 0, opponentJoiningBonusLines: 0,
      myBonusBreakdownRows: [], opponentBonusBreakdownRows: [],
      activationStaggerPlan: { myIndexByShipId: {}, opponentIndexByShipId: {} },
      presentedOpponentRevealBlurSeq: 0,
    },
    healthResolutionLockActive: false,
    healthResolutionPresentationActive: false,
    readyEnabled: true,
    readyDisabledReason: null,
    resumeSyncLocked: false,
    currentTurnDicePresentationSettled: true,
    battleLogHistory: null,
    thisTurn: null,
    presentedThisTurnStats: null,
    getMajorPhaseLabel: () => 'Build',
    getSubphaseLabelFromPhaseKey: () => 'Dice roll',
    chatEntries: [],
    isFinished: false,
    winnerPlayerId: null,
    resultReason: null,
    readyUx: { clickedThisPhase: false, sendingNow: false, sendingKind: null },
    availableActions: [],
    selectedChoiceIdBySourceInstanceId: {},
    allocatedDestroyTargetIdsBySourceInstanceId: {},
    allocatedDestroyTargetIdBySourceInstanceId: {},
    destroyTargetSatisfiedBySourceInstanceId: {},
    gameData: { ships: {} },
    shipsByPlayerId: {},
    presentedChronoswarmRolls: [2, 4, 6],
    presentedCubeDiceValueByPlayerId: { p1: 3, p2: 5 },
    leftRailDiceValue: 2,
    leftRailDiceAnimateKey: 7,
    leftRailChronoswarmAnimateKey: 11,
    leftRailCubeAnimateKey: 13,
    buildPreviewCounts: {},
    frigateSelectedTriggers: [],
    quantumMysticSelectedNumbers: [],
    evolverRowIds: [],
    evolverChoicesByRowId: {},
    ancientAutocastEnabled: false,
    ...overrides,
  };
}

function helpers(overrides: Partial<MapperArgs> = {}) {
  return mapGameSessionVm(mapperArgs(overrides)).leftRail.diceManipulationSlots;
}

function ids(slots: ReturnType<typeof helpers>) {
  return {
    left: slots.left.map((slot) => slot.sourceShipDefId),
    right: slots.right.map((slot) => slot.sourceShipDefId),
  };
}

describe('terminal health-bar handoff isolation', () => {
  it('defers finished-panel redirection without changing the canonical finished result', () => {
    const args = mapperArgs({ isFinished: true, resultReason: 'decisive', winnerPlayerId: 'p1',
      terminalHealthBarPresentationPending: true,
      tabs: [{ tabId: 'tab.menu', label: 'Menu', visible: true, targetPanelId: 'ap.menu.root' }] });
    const pending = mapGameSessionVm(args);
    expect(pending.actionPanel.activePanelId).toBe('ap.menu.root');
    expect(pending.actionPanel.tabs[0].targetPanelId).toBe('ap.menu.root');
    expect(pending.actionPanel.endOfGame).toBeDefined();
    const completed = mapGameSessionVm({ ...args, terminalHealthBarPresentationPending: false });
    expect(completed.actionPanel.activePanelId).toBe('ap.end_of_game.result');
    expect(completed.actionPanel.tabs[0].targetPanelId).toBe('ap.end_of_game.result');
    expect(completed.actionPanel.endOfGame).toEqual(pending.actionPanel.endOfGame);
  });

  it('does not extend next-turn Ready locking or alter published dice/helpers', () => {
    const args = mapperArgs();
    const ordinary = mapGameSessionVm(args);
    const pending = mapGameSessionVm({ ...args, terminalHealthBarPresentationPending: true });
    expect(pending.bottomActionRail).toEqual(ordinary.bottomActionRail);
    expect(pending.leftRail).toEqual(ordinary.leftRail);
    expect(pending.bottomActionRail.readyDisabled).toBe(false);
    expect(pending.actionPanel.tabInteractionLocked).toBe(false);
  });
});

describe('desktop dice helper ownership and collections', () => {
  it('returns empty arrays without authoritative fleets or displayed players', () => {
    expect(helpers()).toEqual({ left: [], right: [] });
    expect(helpers({ gameData: null })).toEqual({ left: [], right: [] });
    expect(helpers({
      gameData: { ships: { p1: fleet(helperIds), p2: fleet(helperIds) } },
      displayLeftPlayer: null, displayRightPlayer: null,
    })).toEqual({ left: [], right: [] });
  });

  it.each(['p1', 'p2'])('places all helper types only on owner %s side', (playerId) => {
    const slots = helpers({ gameData: { ships: { [playerId]: fleet(helperIds) } } });
    expect(ids(slots)).toEqual({
      left: playerId === 'p1' ? helperIds : [],
      right: playerId === 'p2' ? helperIds : [],
    });
  });

  const pairs: HelperId[][] = [
    ['KNO', 'CHR'], ['KNO', 'LEV'], ['KNO', 'CUB'], ['LEV', 'CUB'], ['CUB', 'CHR'],
  ];
  for (const pair of pairs) {
    it(`keeps ${pair.join(' + ')} together on either owner side in stable order`, () => {
      for (const playerId of ['p1', 'p2']) {
        for (const input of [pair, [...pair].reverse()]) {
          expect(ids(helpers({ gameData: { ships: { [playerId]: fleet(input) } } }))).toEqual({
            left: playerId === 'p1' ? pair : [], right: playerId === 'p2' ? pair : [],
          });
        }
      }
    });
  }

  it('deduplicates within owners while preserving matching types across both owners', () => {
    expect(ids(helpers({ gameData: { ships: {
      p1: fleet([...helperIds].reverse().concat(helperIds)),
      p2: fleet(helperIds.concat(helperIds)),
    } } }))).toEqual({ left: helperIds, right: helperIds });
  });

  it.each(['p2_player', 'spectator'] as const)('follows reversed displayed ordering for %s', (viewerMode) => {
    expect(ids(helpers({
      viewer: { viewerMode, isSpectator: viewerMode === 'spectator', isPlayerViewer: viewerMode !== 'spectator', p1Name: p1.name, p2Name: p2.name },
      me: viewerMode === 'spectator' ? null : p2,
      opponent: viewerMode === 'spectator' ? null : p1,
      displayLeftPlayer: p2, displayRightPlayer: p1,
      gameData: { ships: { p1: fleet(['KNO', 'LEV']), p2: fleet(['CUB', 'CHR']) } },
    }))).toEqual({ left: ['CUB', 'CHR'], right: ['KNO', 'LEV'] });
  });

  it('uses current authoritative fleet membership for copied and stolen ships', () => {
    const stolen = { ...fleet(['KNO'])[0], ownerPlayerId: 'p2', originalOwnerPlayerId: 'p2' };
    const copied = { ...fleet(['CHR'])[0], sourcePlayerId: 'p1', copiedFromInstanceId: 'original-chr' };
    expect(ids(helpers({ gameData: { ships: { p1: [stolen], p2: [copied] } } })))
      .toEqual({ left: ['KNO'], right: ['CHR'] });
  });

  it('retains nested fleet and displayed identity compatibility', () => {
    expect(ids(helpers({
      gameData: { gameData: { ships: { p1: fleet(['LEV']), p2: fleet(['KNO']) } } },
      displayLeftPlayer: { playerId: 'p1' }, displayRightPlayer: { sessionId: 'p2' },
    }))).toEqual({ left: ['LEV'], right: ['KNO'] });
    expect(ids(helpers({ gameData: { ships: { p1: null, p2: {} } } })))
      .toEqual({ left: [], right: [] });
  });
});

describe('desktop dice helper eligibility and presented values', () => {
  it.each([5, 6])('excludes every helper type created on turn %s', (createdTurn) => {
    expect(helpers({ gameData: { ships: { p1: fleet(helperIds, createdTurn), p2: fleet(helperIds, createdTurn) } } }))
      .toEqual({ left: [], right: [] });
  });

  it.each([undefined, null, '5', 5.5])('retains compatibility eligibility for createdTurn %s', (createdTurn) => {
    const ships = fleet(helperIds).map((ship) => ({ ...ship, createdTurn }));
    expect(ids(helpers({ gameData: { ships: { p1: ships } } })))
      .toEqual({ left: helperIds, right: [] });
  });

  it('accepts an older eligible duplicate even if another instance was just created', () => {
    expect(ids(helpers({ gameData: { ships: { p1: [...fleet(helperIds, 5), ...fleet(helperIds, 4)] } } })))
      .toEqual({ left: helperIds, right: [] });
  });

  it.each([undefined, [], [4], [5, 2], [6, 1, 3], [0, 2, '3', 7, 4.5, 6]])(
    'uses the same presented shared CHR roll set for both owners: %j', (rolls) => {
      const slots = helpers({
        gameData: { ships: { p1: fleet(['CHR', 'CHR']), p2: fleet(['CHR', 'CHR']) }, chronoswarmRolls: [3, 3, 3] },
        presentedChronoswarmRolls: rolls,
      });
      const expected = [{ sourceShipDefId: 'CHR', diceValues: (rolls ?? []).filter(
        (value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
      ), animateKey: 11 }];
      expect(slots.left).toEqual(expected);
      expect(slots.right).toEqual(expected);
      expect(slots.left[0].diceValues).toBe(slots.right[0].diceValues);
    }
  );

  it('preserves independent Cube presented values, highlights and animation keys', () => {
    const slots = helpers({
      gameData: { ships: { p1: fleet(helperIds), p2: fleet(helperIds) }, cubeRollByPlayerId: { p1: 6, p2: 6 } },
      presentedCubeDiceValueByPlayerId: { p1: 1, p2: 4 }, cubeDiceUsedByPlayerId: { p2: true },
    });
    expect(slots.left).toEqual([
      { sourceShipDefId: 'KNO' }, { sourceShipDefId: 'LEV', diceValues: [6] },
      { sourceShipDefId: 'CUB', diceValues: [1], animateKey: 13, highlighted: false },
      { sourceShipDefId: 'CHR', diceValues: [2, 4, 6], animateKey: 11 },
    ]);
    expect(slots.right.find((slot) => slot.sourceShipDefId === 'CUB'))
      .toEqual({ sourceShipDefId: 'CUB', diceValues: [4], animateKey: 13, highlighted: true });
  });

  it.each([undefined, 0, 7, '3', 3.5, NaN])('omits Cube without a valid presented value: %s', (value) => {
    expect(ids(helpers({
      gameData: { ships: { p1: fleet(['KNO', 'CUB']) } },
      presentedCubeDiceValueByPlayerId: { p1: value },
    }))).toEqual({ left: ['KNO'], right: [] });
  });

  it('ignores pending SSIM copies, build previews, projected fleets and stale Cube values', () => {
    const args = mapperArgs({
      gameData: { ships: {}, ancient: { pendingSimulacrumCopies: helperIds.map((copiedShipDefId) => ({
        ownerPlayerId: 'p1', copiedShipDefId, status: 'pending',
      })) } },
      shipsByPlayerId: { p1: fleet(helperIds) },
      buildPreviewCounts: { KNO: 1, LEV: 1, CUB: 1, CHR: 1 },
    });
    if (args.board.mode !== 'board') throw new Error('Expected board fixture');
    args.board.myFleet = helperIds.map((shipDefId) => ({
      shipDefId, count: 1, stackKey: shipDefId, renderKey: shipDefId,
      memberInstanceIds: [`preview-${shipDefId}`], currentCharges: null, caption: null,
    }));
    expect(mapGameSessionVm(args).leftRail.diceManipulationSlots).toEqual({ left: [], right: [] });
  });

  it('preserves mobile Cube values and animation keys when desktop excludes newly created Cubes', () => {
    const ships = { p1: fleet(['CUB'], 5), p2: fleet(['CUB'], 5) };
    const vm = mapGameSessionVm(mapperArgs({ gameData: { ships }, shipsByPlayerId: ships }));
    expect(vm.leftRail.diceManipulationSlots).toEqual({ left: [], right: [] });
    if (vm.board.mode !== 'board') throw new Error('Expected board fixture');
    expect(vm.board.mobileDiceModifierSlots).toEqual({
      top: { sourceShipDefId: 'CUB', diceValues: [5], animateKey: 13, highlighted: false },
      bottom: { sourceShipDefId: 'CUB', diceValues: [3], animateKey: 13, highlighted: false },
    });
  });
});
