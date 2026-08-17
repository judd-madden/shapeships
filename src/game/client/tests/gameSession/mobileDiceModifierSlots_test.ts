declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { deriveMobileDiceModifierSlots } from '../../gameSession/mobileDiceModifierSlots';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

const shipsByPlayerId = {
  top: [{ shipDefId: 'CUB', createdTurn: 1 }],
  bottom: [{ shipDefId: 'CHR', createdTurn: 1 }],
};

Deno.test('mobile modifier slots use presentation-safe placeholder values', () => {
  const slots = deriveMobileDiceModifierSlots({
    shipsByPlayerId,
    topPlayerId: 'top',
    bottomPlayerId: 'bottom',
    turnNumber: 2,
    chronoswarmRolls: [1, 1],
    chronoswarmAnimateKey: 7,
    cubeDiceValueByPlayerId: { top: 1 },
    cubeDiceAnimateKeyByPlayerId: { top: 8 },
  });

  assertEquals(slots.top?.diceValues, [1], 'Cube should use the presented placeholder');
  assertEquals(slots.bottom?.diceValues, [1, 1], 'CHR should use presented placeholders');
});

Deno.test('mobile modifier slots expose authoritative targets after release', () => {
  const slots = deriveMobileDiceModifierSlots({
    shipsByPlayerId,
    topPlayerId: 'top',
    bottomPlayerId: 'bottom',
    turnNumber: 2,
    chronoswarmRolls: [4, 6],
    chronoswarmAnimateKey: 9,
    cubeDiceValueByPlayerId: { top: 5 },
    cubeDiceAnimateKeyByPlayerId: { top: 10 },
  });

  assertEquals(slots.top?.diceValues, [5], 'Cube should use the released presented target');
  assertEquals(slots.bottom?.diceValues, [4, 6], 'CHR should use released targets');
});

Deno.test('static LEV and KNO mobile slots remain unaffected', () => {
  const levSlots = deriveMobileDiceModifierSlots({
    shipsByPlayerId: { top: [{ shipDefId: 'LEV', createdTurn: 1 }] },
    topPlayerId: 'top',
    bottomPlayerId: null,
    turnNumber: 2,
  });
  const knoSlots = deriveMobileDiceModifierSlots({
    shipsByPlayerId: { top: [{ shipDefId: 'KNO', createdTurn: 1 }] },
    topPlayerId: 'top',
    bottomPlayerId: null,
    turnNumber: 2,
  });

  assertEquals(levSlots.top?.diceValues, [6], 'LEV should remain a static six');
  assertEquals(knoSlots.top?.diceValues, undefined, 'KNO should remain value-free');
});
