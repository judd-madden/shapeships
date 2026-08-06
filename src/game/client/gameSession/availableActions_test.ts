declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  getDefaultChoiceIdForRenderableAction,
  getSelectedChoiceIdForRenderableAction,
  type RenderableServerAction,
} from './availableActions';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\nactual: ${String(actual)}\nexpected: ${String(expected)}`);
  }
}

function makeAction(
  overrides: Partial<RenderableServerAction> = {}
): RenderableServerAction {
  return {
    kind: 'destroy_target',
    actionId: 'GUA#0',
    shipDefId: 'GUA',
    sourceInstanceId: 'guardian-1',
    choices: [{ choiceId: 'destroy' }, { choiceId: 'hold' }],
    validTargets: [{ instanceId: 'enemy-1' }],
    ...overrides,
  };
}

Deno.test('Guardian with a valid target defaults to destroy', () => {
  assertEquals(
    getDefaultChoiceIdForRenderableAction(makeAction()),
    'destroy',
    'Guardian should default to destroy when a target is available'
  );
});

Deno.test('Guardian without a valid target defaults to hold', () => {
  assertEquals(
    getDefaultChoiceIdForRenderableAction(makeAction({ validTargets: [] })),
    'hold',
    'Guardian should default to hold when no target is available'
  );
});

Deno.test('non-Guardian destroy-target action still defaults to hold', () => {
  assertEquals(
    getDefaultChoiceIdForRenderableAction(makeAction({
      actionId: 'SPI#0',
      shipDefId: 'SPI',
    })),
    'hold',
    'generic targeted actions should retain the hold default'
  );
});

Deno.test('an existing explicit valid choice remains preferred', () => {
  const action = makeAction();

  assertEquals(
    getSelectedChoiceIdForRenderableAction(action, {
      [action.sourceInstanceId]: 'hold',
    }),
    'hold',
    'explicit Hold should override the Guardian default'
  );
});

Deno.test('Cube and KNO special defaults remain unchanged', () => {
  const cubeAction = makeAction({
    kind: 'choice',
    actionId: 'CUB#0',
    shipDefId: 'CUB',
    sourceInstanceId: 'cube-aggregate',
    choices: [
      { choiceId: 'main', projectedAmount: 4 },
      { choiceId: 'cube:cube-1', projectedAmount: 4 },
      { choiceId: 'cube:cube-2', projectedAmount: 3 },
    ],
    validTargets: undefined,
  });
  const knowledgeAction = makeAction({
    kind: 'choice',
    actionId: 'KNO#0',
    shipDefId: 'KNO',
    sourceInstanceId: 'knowledge-1',
    choices: [{ choiceId: 'reroll' }, { choiceId: 'hold' }],
    validTargets: undefined,
  });

  assertEquals(
    getDefaultChoiceIdForRenderableAction(cubeAction),
    'cube:cube-1',
    'Cube should retain its highest-value and cube-over-main tie default'
  );
  assertEquals(
    getDefaultChoiceIdForRenderableAction(knowledgeAction),
    'hold',
    'KNO should retain its Hold default'
  );
});
