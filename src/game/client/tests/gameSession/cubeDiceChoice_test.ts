declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  getCubeDiceChoiceIdForPhase,
  type CubeDiceChoiceActionInput,
} from '../../gameSession/cubeDiceChoice';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\nactual: ${String(actual)}\nexpected: ${String(expected)}`);
  }
}

function makeCubeAction(
  mainValue: number,
  cubeValues: Array<{ sourceInstanceId: string; value: number }>
): CubeDiceChoiceActionInput {
  return {
    kind: 'choice',
    actionId: 'CUB#0',
    shipDefId: 'CUB',
    sourceInstanceId: 'cube-aggregate',
    choices: [
      { choiceId: 'main', projectedAmount: mainValue },
      ...cubeValues.map(({ sourceInstanceId, value }) => ({
        choiceId: `cube:${sourceInstanceId}`,
        projectedAmount: value,
      })),
    ],
  };
}

Deno.test('Cube lifecycle initializes each phase from current rolls and preserves same-phase manual choice', () => {
  const previousPhaseAction = makeCubeAction(2, [
    { sourceInstanceId: 'A', value: 6 },
    { sourceInstanceId: 'B', value: 3 },
  ]);
  const previousSelection = getCubeDiceChoiceIdForPhase({
    action: previousPhaseAction,
    initializeFromCurrentAction: true,
  });
  assertEquals(previousSelection, 'cube:A', 'previous phase should initialize to Cube A');

  const currentPhaseAction = makeCubeAction(5, [
    { sourceInstanceId: 'A', value: 1 },
    { sourceInstanceId: 'B', value: 4 },
  ]);
  const currentDefault = getCubeDiceChoiceIdForPhase({
    action: currentPhaseAction,
    existingChoiceId: previousSelection,
    initializeFromCurrentAction: true,
  });
  assertEquals(
    currentDefault,
    'main',
    'new phase should ignore the still-valid previous ID and use current values'
  );

  const maintainedManualChoice = getCubeDiceChoiceIdForPhase({
    action: currentPhaseAction,
    existingChoiceId: 'cube:A',
    initializeFromCurrentAction: false,
  });
  assertEquals(
    maintainedManualChoice,
    'cube:A',
    'same-phase maintenance should preserve a valid lower manual choice'
  );
});
