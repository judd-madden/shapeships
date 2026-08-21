declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  classifyFirstTurnDiceSignature,
  createTurnStartEconomyPresentationState,
  holdTurnStartDiceModifierPresentation,
  isCurrentTurnDicePresentationSettled,
  normalizeTurnStartDiceModifierPresentation,
  settleTurnStartEconomyPresentation,
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
