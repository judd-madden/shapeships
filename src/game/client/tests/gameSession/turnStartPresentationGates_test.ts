declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  classifyFirstTurnDiceSignature,
  holdTurnStartDiceModifierPresentation,
  isCurrentTurnDicePresentationSettled,
  normalizeTurnStartDiceModifierPresentation,
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
