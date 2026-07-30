import assert from 'node:assert/strict';
import { evaluateForeignBuildLegality } from '../../../engine/intent/buildForeignLegality.ts';

Deno.test('foreign interactive upgrades use ordinary build legality', () => {
  const foreignUpgrades = [
    { shipDefId: 'FRI', shipSpecies: 'human' },
    { shipDefId: 'GUA', shipSpecies: 'human' },
    { shipDefId: 'SAC', shipSpecies: 'xenite' },
    { shipDefId: 'KNO', shipSpecies: 'centaur' },
    { shipDefId: 'DOM', shipSpecies: 'centaur' },
  ];

  for (const upgrade of foreignUpgrades) {
    assert.deepEqual(
      evaluateForeignBuildLegality({
        nativeSpecies: 'ancient',
        shipDefId: upgrade.shipDefId,
        shipSpecies: upgrade.shipSpecies,
        shipType: 'Upgraded',
      }),
      { allowed: true },
      upgrade.shipDefId,
    );
  }
});

Deno.test('foreign basics remain prohibited', () => {
  assert.deepEqual(
    evaluateForeignBuildLegality({
      nativeSpecies: 'ancient',
      shipDefId: 'DEF',
      shipSpecies: 'human',
      shipType: 'Basic',
    }),
    {
      allowed: false,
      restrictionCode: 'foreign_basic',
    },
  );
});

Deno.test('native and unresolved species behavior remains unchanged', () => {
  for (const scenario of [
    { nativeSpecies: 'human', shipSpecies: 'human' },
    { nativeSpecies: 'unknown', shipSpecies: 'human' },
    { nativeSpecies: 'ancient', shipSpecies: 'unknown' },
  ]) {
    assert.deepEqual(
      evaluateForeignBuildLegality({
        ...scenario,
        shipDefId: 'DEF',
        shipType: 'Basic',
      }),
      { allowed: true },
    );
  }
});
