import {
  getCanonicalShipFamilyDisplayName,
  pluralizeShipName,
} from './ShipDefinitionNames.ts';

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('pluralizeShipName preserves singular names via canonical display helper', () => {
  assertEqual(getCanonicalShipFamilyDisplayName('CAR', 1), 'Carrier');
  assertEqual(getCanonicalShipFamilyDisplayName('VIG', 1), 'Ship of Vigor');
  assertEqual(getCanonicalShipFamilyDisplayName('POW', 1), 'Ark of Power');
});

Deno.test('pluralizeShipName keeps ordinary pluralization behavior', () => {
  assertEqual(pluralizeShipName('Carrier'), 'Carriers');
  assertEqual(pluralizeShipName('Mantis'), 'Mantises');
  assertEqual(pluralizeShipName('Defender'), 'Defenders');
});

Deno.test('pluralizeShipName applies Centaur compound rules before suffix rules', () => {
  assertEqual(pluralizeShipName('Ship of Vigor'), 'Ships of Vigor');
  assertEqual(pluralizeShipName('Ark of Power'), 'Arks of Power');
});

Deno.test('getCanonicalShipFamilyDisplayName resolves compound names from ship definitions', () => {
  assertEqual(getCanonicalShipFamilyDisplayName('VIG', 2), 'Ships of Vigor');
  assertEqual(getCanonicalShipFamilyDisplayName('POW', 2), 'Arks of Power');
});
