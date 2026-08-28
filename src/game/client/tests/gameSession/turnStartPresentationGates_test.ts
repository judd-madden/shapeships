declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  applyTurnStartCataloguePresentationGate,
  classifyFirstTurnDiceSignature,
  createTurnStartEconomyPresentationState,
  deriveBuildDrawingReadyNote,
  holdTurnStartDiceModifierPresentation,
  isCurrentTurnDicePresentationSettled,
  isNormalDrawingInteractionHeld,
  normalizeTurnStartDiceModifierPresentation,
  settleTurnStartEconomyPresentation,
  shouldHoldTurnStartFleetMaterialisation,
  shouldHoldSetupTurnDiceCatchUp,
  syncTurnStartEconomyPresentation,
} from '../../gameSession/clienteffects/turnStartPresentationGates';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

Deno.test('first established dice signature hydrates without presenting a roll', () => {
  assertEquals(
    classifyFirstTurnDiceSignature({ observedEligibleNoSignature: false }),
    'hydrate',
    'reload and mid-turn hydration should not replay a roll'
  );
});

Deno.test('first signature after an eligible no-signature state presents Turn 1 roll', () => {
  assertEquals(
    classifyFirstTurnDiceSignature({ observedEligibleNoSignature: true }),
    'present_roll',
    'setup-to-Turn-1 transition should use the normal roll presentation'
  );
});

Deno.test('Turn 1 economy stays on the pre-turn baseline until dice presentation settles', () => {
  const baseline = {
    myBonusLines: 0,
    opponentBonusLines: 0,
    myBonusLinesOnEven: 0,
    opponentBonusLinesOnEven: 0,
    myDisplayedSavedLines: 3,
    opponentDisplayedSavedLines: 3,
    myDisplayedSavedJoiningLines: 0,
    opponentDisplayedSavedJoiningLines: 0,
    mySavedJoiningLines: 0,
    opponentSavedJoiningLines: 0,
    myJoiningBonusLines: 0,
    opponentJoiningBonusLines: 0,
    myBonusBreakdownRows: [],
    opponentBonusBreakdownRows: [],
  };
  const turnOne = {
    ...baseline,
    myBonusLines: 2,
    opponentBonusLines: 1,
    myDisplayedSavedLines: 8,
    opponentDisplayedSavedLines: 7,
  };
  const initial = createTurnStartEconomyPresentationState({
    gameId: 'mission-game',
    turnNumber: 0,
    economy: baseline,
  });
  const pending = syncTurnStartEconomyPresentation(initial, {
    gameId: 'mission-game',
    turnNumber: 1,
    economy: turnOne,
  });

  assertEquals(
    pending.presented,
    baseline,
    'new-turn economy should remain hidden behind the existing dice settlement gate'
  );
  assertEquals(
    settleTurnStartEconomyPresentation(pending, 1).presented,
    turnOne,
    'Turn 1 economy should release when the existing dice presentation settles'
  );
});

Deno.test('turn-start modifier hold preserves existing dice and seeds new dice at one', () => {
  const held = holdTurnStartDiceModifierPresentation({
    presented: {
      chronoswarmRolls: [3],
      cubeDiceValueByPlayerId: { playerA: 4 },
    },
    authoritative: {
      chronoswarmRolls: [5, 6],
      cubeDiceValueByPlayerId: { playerA: 2, playerB: 6 },
    },
  });

  assertEquals(
    held,
    {
      chronoswarmRolls: [3, 1],
      cubeDiceValueByPlayerId: { playerA: 4, playerB: 1 },
    },
    'existing slots should retain their presented face and new slots should start at one'
  );
});

Deno.test('authoritative modifier targets normalize for release', () => {
  assertEquals(
    normalizeTurnStartDiceModifierPresentation({
      chronoswarmRolls: [5, 6, 9],
      cubeDiceValueByPlayerId: { playerA: 2, invalid: 0 },
    }),
    {
      chronoswarmRolls: [5, 6],
      cubeDiceValueByPlayerId: { playerA: 2 },
    },
    'release targets should contain only valid authoritative dice values'
  );
});

Deno.test('current-turn result UI remains gated until that turn settles', () => {
  assertEquals(
    isCurrentTurnDicePresentationSettled({ turnNumber: 3, settledTurnNumber: 2 }),
    false,
    'the prior turn settle must not expose current results'
  );
  assertEquals(
    isCurrentTurnDicePresentationSettled({ turnNumber: 3, settledTurnNumber: 3 }),
    true,
    'the current result may be exposed after settle'
  );
});

Deno.test('turn-start fleet materialisation hold covers the authoritative turn transition continuously', () => {
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 3,
      previouslyObservedTurnNumber: 3,
      releaseTurnNumber: null,
      settledTurnNumber: null,
    }),
    false,
    'initial hydration should not manufacture a fleet hold'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 4,
      previouslyObservedTurnNumber: 3,
      releaseTurnNumber: null,
      settledTurnNumber: 3,
    }),
    true,
    'the first authoritative new-turn render should retain the previous fleet footprint'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 4,
      previouslyObservedTurnNumber: 4,
      releaseTurnNumber: 4,
      settledTurnNumber: null,
    }),
    true,
    'release bookkeeping catch-up should keep the fleet hold active until settlement'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 4,
      previouslyObservedTurnNumber: 4,
      releaseTurnNumber: 4,
      settledTurnNumber: 4,
    }),
    false,
    'the existing current-turn dice settlement should release the fleet once'
  );
});

Deno.test('turn-start fleet materialisation hold ignores game changes and stale turns', () => {
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: false,
      turnNumber: 4,
      previouslyObservedTurnNumber: 3,
      releaseTurnNumber: 4,
      settledTurnNumber: 3,
    }),
    false,
    'presentation bookkeeping from another game must not hide a hydrated fleet'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 3,
      previouslyObservedTurnNumber: 4,
      releaseTurnNumber: 4,
      settledTurnNumber: 4,
    }),
    false,
    'backward or stale authoritative turns should not create a new hold'
  );
});

Deno.test('setup-entry phase catch-up stays on Dice until current-turn dice settle', () => {
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: true,
      currentTurnDicePresentationSettled: false,
    }),
    true,
    'the live setup-to-turn path should remain at Dice while its presentation is unsettled'
  );
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: true,
      currentTurnDicePresentationSettled: true,
    }),
    false,
    'the normal phase catch-up path should resume as soon as dice settle'
  );
});

Deno.test('dice settlement does not add a phase hold outside setup entry', () => {
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: false,
      currentTurnDicePresentationSettled: false,
    }),
    false,
    'later-turn Dice timing must remain independent of the setup-entry gate'
  );
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: false,
      currentTurnDicePresentationSettled: true,
    }),
    false,
    'hydrated settled turns must not manufacture a new phase hold'
  );
});

Deno.test('unsettled Drawing downgrades only an otherwise buildable catalogue', () => {
  const unsettledDrawing = {
    phaseKey: 'build.drawing',
    currentTurnDicePresentationSettled: false,
  };

  assertEquals(
    applyTurnStartCataloguePresentationGate({
      ...unsettledDrawing,
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      normalContext: 'buildable',
    }),
    'unavailable',
    'newly available Drawing build interaction should remain unavailable until dice settle'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      ...unsettledDrawing,
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      normalContext: 'reference_only',
    }),
    'reference_only',
    'existing reference-only policy should pass through unchanged'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      ...unsettledDrawing,
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      normalContext: 'unavailable',
    }),
    'unavailable',
    'existing unavailable policy should pass through unchanged'
  );
});

Deno.test('settlement and non-Drawing phases preserve the normal catalogue context', () => {
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: true,
      normalContext: 'buildable',
    }),
    'buildable',
    'settled Drawing should restore buildability immediately'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'battle.first_strike',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'unavailable',
    }),
    'unavailable',
    'dice settlement must not redefine non-Drawing catalogue policy'
  );
});

Deno.test('Play Computer catalogue stays unavailable from Mission intro through Turn 1 dice', () => {
  const progression = [
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: true,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'buildable',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: true,
      normalContext: 'buildable',
    }),
  ];

  assertEquals(
    progression,
    ['reference_only', 'unavailable', 'unavailable', 'buildable'],
    'Mission games should progress from species reference through intro/dice unavailable to settled buildable'
  );
});

Deno.test('multiplayer catalogue stays unavailable from matchup intro through Turn 1 dice', () => {
  const progression = [
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: true,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'buildable',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: true,
      normalContext: 'buildable',
    }),
  ];

  assertEquals(
    progression,
    ['reference_only', 'unavailable', 'unavailable', 'buildable'],
    'multiplayer should progress from species reference through matchup/dice unavailable to settled buildable'
  );
});

Deno.test('intro hold flags do not redefine unrelated phases', () => {
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'battle.first_strike',
      missionIntroHoldActive: true,
      matchupIntroHoldActive: true,
      currentTurnDicePresentationSettled: true,
      normalContext: 'reference_only',
    }),
    'reference_only',
    'stale or irrelevant intro flags must not affect non-setup catalogue policy'
  );
});

Deno.test('ordinary Drawing interaction is held without delaying prelude workflows', () => {
  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: false,
    }),
    true,
    'ordinary build and Ready interaction should be held before settlement'
  );
  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'build.drawing',
      drawingStageKind: 'prelude',
      currentTurnDicePresentationSettled: false,
    }),
    false,
    'Drawing preludes should remain outside the ordinary interaction hold'
  );
  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'battle.first_strike',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: false,
    }),
    false,
    'unrelated phases should remain outside the Drawing hold'
  );
});

Deno.test('Drawing Ready economy copy releases exactly at dice settlement', () => {
  const economy = {
    projectedSavedOrdinary: 5,
    projectedSavedJoining: 0,
    projectedSavedCombined: 5,
    projectedSavedWasCapped: false,
  };

  assertEquals(
    deriveBuildDrawingReadyNote({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: false,
      economy,
    }),
    null,
    'unsettled Drawing must not expose projected save-lines copy'
  );
  assertEquals(
    deriveBuildDrawingReadyNote({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: true,
      economy,
    }),
    'Save 5 lines',
    'settlement should restore the ordinary Drawing Ready note without another delay'
  );
});

Deno.test('hydrated current turns already considered settled do not acquire a new gate', () => {
  const currentTurnDicePresentationSettled = isCurrentTurnDicePresentationSettled({
    turnNumber: 4,
    settledTurnNumber: 4,
  });

  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled,
    }),
    false,
    'an already-settled hydrated turn should expose ordinary Drawing immediately'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled,
      normalContext: 'buildable',
    }),
    'buildable',
    'settled hydration and ordinary later turns should retain their normal catalogue context'
  );
});
