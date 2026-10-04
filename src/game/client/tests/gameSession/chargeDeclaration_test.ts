declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  getChargeDeclarationFingerprint,
  serializeChargeDeclarationSolarCasts,
  serializeOrdinaryChargeActions,
} from '../../gameSession/chargeDeclaration';
import {
  buildAncientChargeDeclarationPayload,
  isIncompleteAncientBlackHoleSelection,
} from '../../gameSession/ancient/ancientChargeDeclaration';
import type { RenderableServerAction } from '../../gameSession/availableActions';

function assert(condition: unknown, message = 'assertion failed'): void {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function action(
  actionId: string,
  sourceInstanceId: string,
  choices: string[],
  overrides: Partial<RenderableServerAction> = {},
): RenderableServerAction {
  return {
    kind: 'choice',
    actionId,
    shipDefId: actionId.split('#')[0],
    sourceInstanceId,
    choices: choices.map((choiceId) => ({ choiceId })),
    ...overrides,
  };
}

Deno.test('ordinary Charge serializer preserves defaults, holds, source IDs, and action order', () => {
  const result = serializeOrdinaryChargeActions({
    actions: [
      action('ANT#0', 'ant-source', ['damage', 'heal', 'hold']),
      action('INT#0', 'copied-foreign-source', ['heal', 'damage', 'hold']),
      action('WIS#0', 'wis-source', ['damage', 'heal', 'hold']),
      action('FAM#0', 'fam-source', ['damage', 'hold']),
    ],
    selectedChoiceIdBySourceInstanceId: {
      'ant-source': 'hold',
      'wis-source': 'heal',
    },
    allocatedTargetIdsBySourceInstanceId: {},
    allocatedTargetIdBySourceInstanceId: {},
  });
  assert(result.ok);
  if (!result.ok) return;
  assertEquals(result.actions, [
    {
      actionType: 'power', actionId: 'INT#0',
      sourceInstanceId: 'copied-foreign-source', choiceId: 'heal',
    },
    {
      actionType: 'power', actionId: 'WIS#0',
      sourceInstanceId: 'wis-source', choiceId: 'heal',
    },
    {
      actionType: 'power', actionId: 'FAM#0',
      sourceInstanceId: 'fam-source', choiceId: 'damage',
    },
  ]);
});

Deno.test('ordinary Charge serializer emits canonical single and paired target shapes', () => {
  const result = serializeOrdinaryChargeActions({
    actions: [
      action('DOM#0', 'single', ['damage', 'hold'], {
        kind: 'destroy_target', requiredTargetCount: 1,
      }),
      action('EQU#0', 'pair', ['damage', 'hold'], {
        kind: 'paired_destroy_target', requiredTargetCount: 2,
      }),
    ],
    selectedChoiceIdBySourceInstanceId: { single: 'damage', pair: 'damage' },
    allocatedTargetIdsBySourceInstanceId: {
      single: ['target-z'],
      pair: ['target-z', 'target-a'],
    },
    allocatedTargetIdBySourceInstanceId: {},
  });
  assert(result.ok);
  if (!result.ok) return;
  assertEquals(result.actions[0], {
    actionType: 'power', actionId: 'DOM#0', sourceInstanceId: 'single',
    choiceId: 'damage', targetInstanceId: 'target-z',
  });
  assertEquals(result.actions[1], {
    actionType: 'power', actionId: 'EQU#0', sourceInstanceId: 'pair',
    choiceId: 'damage', targetInstanceIds: ['target-a', 'target-z'],
  });
});

Deno.test('ordinary Charge serializer reports incomplete targeting instead of converting it to hold', () => {
  const result = serializeOrdinaryChargeActions({
    actions: [action('EQU#0', 'pair', ['damage', 'hold'], {
      kind: 'paired_destroy_target', requiredTargetCount: 2,
    })],
    selectedChoiceIdBySourceInstanceId: { pair: 'damage' },
    allocatedTargetIdsBySourceInstanceId: { pair: ['only-one'] },
    allocatedTargetIdBySourceInstanceId: {},
  });
  assertEquals(result, {
    ok: false, reason: 'incomplete_targeting', sourceInstanceId: 'pair',
  });
});

Deno.test('normalized declaration combines ordinary actions with ordered complete Solar casts', () => {
  const ordinary = serializeOrdinaryChargeActions({
    actions: [action('INT#0', 'int-source', ['damage', 'hold'])],
    selectedChoiceIdBySourceInstanceId: { 'int-source': 'damage' },
    allocatedTargetIdsBySourceInstanceId: {},
    allocatedTargetIdBySourceInstanceId: {},
  });
  assert(ordinary.ok);
  if (!ordinary.ok) return;
  const payload = {
    contractVersion: 1 as const,
    declarationId: 'ancient-submit',
    ordinaryChargeActions: ordinary.actions,
    solarCasts: serializeChargeDeclarationSolarCasts([
      { solarPowerId: 'SSIP', lockedAmount: 10 },
      { solarPowerId: 'SBLA', targetInstanceIds: ['target-z', 'target-a'] },
      { solarPowerId: 'SSIM', targetInstanceId: 'sim-target' },
      { solarPowerId: 'SVOR' },
    ]),
    autocastEnabled: true,
  };
  assertEquals(payload.solarCasts, [
    { solarPowerId: 'SSIP', lockedAmount: 10 },
    { solarPowerId: 'SBLA', targetInstanceIds: ['target-a', 'target-z'] },
    { solarPowerId: 'SSIM', targetInstanceId: 'sim-target' },
    { solarPowerId: 'SVOR' },
  ]);
  assert(payload.autocastEnabled === true);
  assert(
    getChargeDeclarationFingerprint({ ...payload, declarationId: 'retry-id' }) ===
      getChargeDeclarationFingerprint(payload),
    'declarationId changed semantic identity',
  );
});

Deno.test('Black Hole selection is incomplete only while required targets are missing', () => {
  assert(
    isIncompleteAncientBlackHoleSelection({
      selectorMode: 'blackHole',
      requiredTargetCount: 2,
      selectedTargetCount: 1,
    }),
    'partial required targeting was treated as complete',
  );
  assert(
    !isIncompleteAncientBlackHoleSelection({
      selectorMode: 'blackHole',
      requiredTargetCount: 2,
      selectedTargetCount: 2,
    }),
    'complete required targeting was treated as incomplete',
  );
  assert(
    !isIncompleteAncientBlackHoleSelection({
      selectorMode: null,
      requiredTargetCount: 2,
      selectedTargetCount: 0,
    }),
    'cancelled targeting was treated as incomplete',
  );
  assert(
    !isIncompleteAncientBlackHoleSelection({
      selectorMode: 'siphon',
      requiredTargetCount: 2,
      selectedTargetCount: 0,
    }),
    'a non-Black-Hole selector was treated as incomplete',
  );
  assert(
    !isIncompleteAncientBlackHoleSelection({
      selectorMode: 'blackHole',
      requiredTargetCount: 0,
      selectedTargetCount: 0,
    }),
    'a valid zero-target Black Hole was treated as incomplete',
  );
});

Deno.test('Ancient declaration builder preserves completed and zero-target Black Hole casts', () => {
  const result = buildAncientChargeDeclarationPayload({
    declarationId: 'black-hole-preview',
    actions: [],
    selectedChoiceIdBySourceInstanceId: {},
    allocatedTargetIdsBySourceInstanceId: {},
    allocatedTargetIdBySourceInstanceId: {},
    localManualSolarCasts: [
      { solarPowerId: 'SBLA', targetInstanceIds: ['target-z', 'target-a'] },
      { solarPowerId: 'SBLA', targetInstanceIds: [] },
    ],
    autocastEnabled: false,
  });
  assert(result.ok);
  if (!result.ok) return;
  assertEquals(result.payload.solarCasts, [
    { solarPowerId: 'SBLA', targetInstanceIds: ['target-a', 'target-z'] },
    { solarPowerId: 'SBLA', targetInstanceIds: [] },
  ]);
});
