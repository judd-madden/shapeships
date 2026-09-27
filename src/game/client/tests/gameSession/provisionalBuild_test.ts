declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import { evaluateProvisionalBuild } from '../../gameSession/provisionalBuild';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function evaluate(args: {
  myShips: Array<{ instanceId: string; shipDefId: string }>;
  choices: Record<string, 'hold' | 'oxite' | 'asterite'>;
}) {
  return evaluateProvisionalBuild({
    turnNumber: 4,
    myShips: args.myShips,
    draftCounts: {},
    nativeSpecies: 'xenite',
    buildEconomy: { ordinaryLinesAvailable: 20, joiningLinesAvailable: 20 },
    frigateSelectedTriggers: [],
    quantumMysticSelectedNumbers: [],
    evolverChoicesByRowId: args.choices,
  });
}

Deno.test('provisional EVO facts include only conversions with an available XEN', () => {
  const result = evaluate({
    myShips: [
      { instanceId: 'evo-1', shipDefId: 'EVO' },
      { instanceId: 'evo-2', shipDefId: 'EVO' },
      { instanceId: 'evo-3', shipDefId: 'EVO' },
      { instanceId: 'xen-1', shipDefId: 'XEN' },
      { instanceId: 'xen-2', shipDefId: 'XEN' },
    ],
    choices: {
      'evo-1': 'oxite',
      'evo-2': 'asterite',
      'evo-3': 'oxite',
    },
  });

  assertEquals(result.successfulEvolverConversions, [
    { sourceKey: 'evo-1', shipDefId: 'OXI' },
    { sourceKey: 'evo-2', shipDefId: 'AST' },
  ]);
});

Deno.test('provisional EVO facts clear when a choice returns to Hold or XEN is lost', () => {
  const ships = [
    { instanceId: 'evo-1', shipDefId: 'EVO' },
    { instanceId: 'xen-1', shipDefId: 'XEN' },
  ];
  assertEquals(
    evaluate({ myShips: ships, choices: { 'evo-1': 'oxite' } })
      .successfulEvolverConversions,
    [{ sourceKey: 'evo-1', shipDefId: 'OXI' }],
  );
  assertEquals(
    evaluate({ myShips: ships, choices: { 'evo-1': 'hold' } })
      .successfulEvolverConversions,
    [],
  );
  assertEquals(
    evaluate({
      myShips: [{ instanceId: 'evo-1', shipDefId: 'EVO' }],
      choices: { 'evo-1': 'oxite' },
    }).successfulEvolverConversions,
    [],
  );
});
