declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { deriveAncientSolarHoverValues } from '../../gameSession/ancient/ancientSolarHoverValues';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`,
    );
  }
}

function deriveDiceHoverValues(effectiveDiceValue: number) {
  return deriveAncientSolarHoverValues({
    effectiveDiceValue,
    chargeScopedFleet: [],
    canCastManualSolarPowerById: {
      SLIF: false,
      SSTA: true,
      SAST: false,
      SSUP: true,
      SCON: false,
      SVOR: false,
    },
    siphonSelector: { maxSpend: 0, canOpen: false },
    canCastBlackHole: false,
    blackHoleDamagePreview: 0,
  });
}

Deno.test('Solar hover values use Star Birth dice +4 while Supernova remains dice +3', () => {
  assertEquals(
    deriveDiceHoverValues(1),
    {
      SSTA: { healing: 5 },
      SSUP: { damage: 4 },
    },
    'low dice boundary should use each power-specific bonus',
  );
  assertEquals(
    deriveDiceHoverValues(6),
    {
      SSTA: { healing: 10 },
      SSUP: { damage: 9 },
    },
    'high dice boundary should use each power-specific bonus',
  );
});
