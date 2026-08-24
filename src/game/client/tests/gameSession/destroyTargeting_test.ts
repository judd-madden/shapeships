declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  allocatePinnedTargetIdsForLocators,
  clearDestroyTargetDraftSource,
  deriveDestroyTargetSelectionEdit,
  resolveDestroyTargetFocus,
  type DestroyTargetDraftState,
  type DestroyTargetDraftAction,
} from '../../gameSession/destroyTargetingDraft';
import { clearAncientBlackHoleTargetSelection } from '../../gameSession/ancient/ancientChargeDeclarationDraft';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

function makeDestroyAction(
  overrides: Partial<DestroyTargetDraftAction> = {}
): DestroyTargetDraftAction {
  return {
    kind: 'destroy_target',
    actionId: 'GUA#0',
    shipDefId: 'GUA',
    sourceInstanceId: 'guardian-a',
    choices: [{ choiceId: 'destroy' }, { choiceId: 'hold' }],
    validTargets: [
      { instanceId: 'DEF-1' },
      { instanceId: 'DEF-2' },
      { instanceId: 'DEF-3' },
      { instanceId: 'FIG-1' },
    ],
    requiredTargetCount: 1,
    ...overrides,
  };
}

const visibleTargets = {
  'opponent::DEF': ['DEF-1', 'DEF-2', 'DEF-3'],
  'opponent::FIG': ['FIG-1'],
};

Deno.test('same-stack replacement pins a genuinely different exact target', () => {
  const action = makeDestroyAction();
  const replacement = deriveDestroyTargetSelectionEdit({
    action,
    currentLocatorKeys: ['opponent::DEF'],
    currentExactTargetIds: ['DEF-1'],
    clickedLocatorKey: 'opponent::DEF',
    visibleTargetIdsByLocatorKey: visibleTargets,
    reservedTargetIds: new Set(['DEF-2']),
  });

  assertEquals(
    replacement,
    {
      locatorKeys: ['opponent::DEF'],
      exactTargetIds: ['DEF-3'],
    },
    'replacement excludes the old target and every other source reservation'
  );
  assertEquals(
    allocatePinnedTargetIdsForLocators({
      action,
      locatorKeys: replacement?.locatorKeys ?? [],
      visibleTargetIdsByLocatorKey: visibleTargets,
      reservedTargetIds: new Set(['DEF-2']),
      preferredTargetIds: replacement?.exactTargetIds ?? [],
    }),
    ['DEF-3'],
    'subsequent derivation preserves the replacement pin'
  );
});

Deno.test('clearing or replacing one source preserves untouched exact pins', () => {
  const draft: DestroyTargetDraftState = {
    locatorKeysBySourceInstanceId: {
      'guardian-a': ['opponent::DEF'],
      'guardian-b': ['opponent::DEF'],
    },
    exactTargetIdsBySourceInstanceId: {
      'guardian-a': ['DEF-1'],
      'guardian-b': ['DEF-2'],
    },
  };
  const selectedChoiceBySource = {
    'guardian-a': 'destroy',
    'guardian-b': 'destroy',
  };
  const cleared = clearDestroyTargetDraftSource(draft, 'guardian-a');

  assertEquals(
    cleared,
    {
      locatorKeysBySourceInstanceId: {
        'guardian-b': ['opponent::DEF'],
      },
      exactTargetIdsBySourceInstanceId: {
        'guardian-b': ['DEF-2'],
      },
    },
    'background clear removes only the focused source locator and pin'
  );
  assertEquals(
    selectedChoiceBySource,
    { 'guardian-a': 'destroy', 'guardian-b': 'destroy' },
    'target draft clearing is separate from GUA Hold/action choice state'
  );
  assertEquals(
    allocatePinnedTargetIdsForLocators({
      action: makeDestroyAction({ sourceInstanceId: 'guardian-b' }),
      locatorKeys: ['opponent::DEF'],
      visibleTargetIdsByLocatorKey: visibleTargets,
      preferredTargetIds: cleared.exactTargetIdsBySourceInstanceId['guardian-b'],
    }),
    ['DEF-2'],
    'the untouched source does not fall back to newly available DEF-1'
  );

  const replacement = deriveDestroyTargetSelectionEdit({
    action: makeDestroyAction(),
    currentLocatorKeys: ['opponent::DEF'],
    currentExactTargetIds: ['DEF-1'],
    clickedLocatorKey: 'opponent::FIG',
    visibleTargetIdsByLocatorKey: visibleTargets,
    reservedTargetIds: new Set(['DEF-2']),
  });
  assertEquals(
    replacement?.exactTargetIds,
    ['FIG-1'],
    'editing source A respects source B exact reservation'
  );
});

Deno.test('failed single-target replacement is non-destructive', () => {
  const result = deriveDestroyTargetSelectionEdit({
    action: makeDestroyAction({
      validTargets: [{ instanceId: 'DEF-1' }, { instanceId: 'DEF-2' }],
    }),
    currentLocatorKeys: ['opponent::DEF'],
    currentExactTargetIds: ['DEF-1'],
    clickedLocatorKey: 'opponent::DEF',
    visibleTargetIdsByLocatorKey: {
      'opponent::DEF': ['DEF-1', 'DEF-2'],
    },
    reservedTargetIds: new Set(['DEF-2']),
  });

  assertEquals(result, null, 'a failed replacement produces no draft mutation');
});

Deno.test('completed ordinary multi-target actions require whole-set clear', () => {
  const action = makeDestroyAction({
    actionId: 'DOM#0',
    shipDefId: 'DOM',
    sourceInstanceId: 'dom-a',
    requiredTargetCount: 2,
  });
  const result = deriveDestroyTargetSelectionEdit({
    action,
    currentLocatorKeys: ['opponent::DEF', 'opponent::FIG'],
    currentExactTargetIds: ['DEF-1', 'FIG-1'],
    clickedLocatorKey: 'opponent::DEF',
    visibleTargetIdsByLocatorKey: visibleTargets,
    reservedTargetIds: new Set(),
  });
  const cleared = clearDestroyTargetDraftSource(
    {
      locatorKeysBySourceInstanceId: {
        'dom-a': ['opponent::DEF', 'opponent::FIG'],
      },
      exactTargetIdsBySourceInstanceId: {
        'dom-a': ['DEF-1', 'FIG-1'],
      },
    },
    'dom-a'
  );

  assertEquals(result, null, 'DOM does not gain an ambiguous third-click replacement');
  assertEquals(
    cleared,
    { locatorKeysBySourceInstanceId: {}, exactTargetIdsBySourceInstanceId: {} },
    'DOM background clear removes its complete target set'
  );
});

Deno.test('paired actions preserve their established complete-set reseed', () => {
  const action = makeDestroyAction({
    kind: 'paired_destroy_target',
    actionId: 'EQU#0',
    shipDefId: 'EQU',
    sourceInstanceId: 'equality-a',
    requiredTargetCount: 2,
    validTargets: undefined,
    validOwnTargets: [{ instanceId: 'OWN-1', totalLineCost: 2 }],
    validOpponentTargets: [
      { instanceId: 'DEF-1', totalLineCost: 2 },
      { instanceId: 'DEF-2', totalLineCost: 2 },
    ],
  });
  const result = deriveDestroyTargetSelectionEdit({
    action,
    currentLocatorKeys: ['my::OWN', 'opponent::DEF'],
    currentExactTargetIds: ['OWN-1', 'DEF-1'],
    clickedLocatorKey: 'opponent::DEF',
    visibleTargetIdsByLocatorKey: {
      'my::OWN': ['OWN-1'],
      'opponent::DEF': ['DEF-1', 'DEF-2'],
    },
    reservedTargetIds: new Set(),
  });

  assertEquals(
    result,
    { locatorKeys: ['opponent::DEF'], exactTargetIds: ['DEF-1'] },
    'the existing paired reseed restarts from the clicked side'
  );
});

Deno.test('explicit focus outranks auto-arm and all-complete automatic focus persists', () => {
  assertEquals(
    resolveDestroyTargetFocus({
      current: { sourceInstanceId: 'guardian-a', origin: 'explicit' },
      currentAvailable: true,
      currentSatisfied: true,
      currentHasAllocatableTarget: true,
      autoArmSourceInstanceId: 'guardian-b',
    }),
    { sourceInstanceId: 'guardian-a', origin: 'explicit' },
    'explicit re-entry remains on completed source A while B is incomplete'
  );
  assertEquals(
    resolveDestroyTargetFocus({
      current: { sourceInstanceId: 'guardian-a', origin: 'automatic' },
      currentAvailable: true,
      currentSatisfied: true,
      currentHasAllocatableTarget: true,
      autoArmSourceInstanceId: 'guardian-b',
    }),
    { sourceInstanceId: 'guardian-b', origin: 'automatic' },
    'automatic focus advances after source A completes'
  );
  assertEquals(
    resolveDestroyTargetFocus({
      current: { sourceInstanceId: 'guardian-b', origin: 'automatic' },
      currentAvailable: true,
      currentSatisfied: true,
      currentHasAllocatableTarget: true,
      autoArmSourceInstanceId: null,
    }),
    { sourceInstanceId: 'guardian-b', origin: 'automatic' },
    'the last completed source remains editable when all actions are complete'
  );
});

Deno.test('Black Hole clear remains selector-local and preserves casts', () => {
  const workflow = {
    key: 'turn-4',
    stage: 'powers',
    hadChargeStage: true,
    entryDisposition: 'manual',
    localManualSolarCasts: [
      { solarPowerId: 'SLIF' },
      { solarPowerId: 'SBLA', targetInstanceIds: ['older-target'] },
    ],
    selectorMode: 'blackHole',
    blackHoleSelectedTargetInstanceIds: ['DEF-1', 'DEF-2'],
    rejectionRecoveryPending: false,
  };
  const cleared = clearAncientBlackHoleTargetSelection(workflow, 'turn-4');

  assertEquals(
    cleared,
    {
      ...workflow,
      blackHoleSelectedTargetInstanceIds: [],
    },
    'Black Hole clear keeps selector mode and unrelated local Solar casts'
  );
  assertEquals(
    clearAncientBlackHoleTargetSelection(
      {
        ...workflow,
        blackHoleSelectedTargetInstanceIds: ['DEF-1'],
      },
      'turn-4'
    )?.blackHoleSelectedTargetInstanceIds,
    [],
    'a partial Black Hole selection also clears as one selector-local set'
  );
  assertEquals(
    clearAncientBlackHoleTargetSelection(workflow, 'another-turn'),
    workflow,
    'a different workflow is untouched'
  );
});
