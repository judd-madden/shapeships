declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { getPublicTurnPhaseProgress } from '../../gameSession/selectors';
import { deriveTurnPhaseVm } from '../../gameSession/turnPhases';

function assertEqual(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

const progress = {
  turnNumber: 7,
  firstStrike: { expected: false, occurred: true },
  charges: { expected: false, occurred: false },
};

Deno.test('turn-phase selector accepts only the curated public DTO', () => {
  assertDeepEqual(getPublicTurnPhaseProgress({ publicState: { turnPhaseProgress: progress } }), progress);
  assertEqual(getPublicTurnPhaseProgress({ gameData: { turnData: { turnPhaseProgress: progress } } }), null);
  assertEqual(getPublicTurnPhaseProgress({ publicState: { turnPhaseProgress: {
    ...progress,
    charges: { expected: 'yes', occurred: false },
  } } }), null);
});

Deno.test('seven canonical phases map to the fixed five milestones', () => {
  const expected = [
    ['build.dice_roll', 'dice_roll'],
    ['build.line_generation', 'dice_roll'],
    ['build.drawing', 'drawing'],
    ['battle.reveal', 'drawing'],
    ['battle.first_strike', 'first_strike'],
    ['battle.charge_declaration', 'charges'],
    ['battle.end_of_turn_resolution', 'turn_resolution'],
  ] as const;

  for (const [phaseKey, milestone] of expected) {
    assertEqual(deriveTurnPhaseVm({
      phaseKey,
      turnNumber: 7,
      progress,
      isFinished: false,
      healthResolutionPresentationActive: false,
    }).currentMilestone, milestone);
  }

  assertDeepEqual(
    deriveTurnPhaseVm({
      phaseKey: 'build.dice_roll',
      turnNumber: 7,
      progress,
      isFinished: false,
      healthResolutionPresentationActive: false,
    }).milestones.map((milestone) => milestone.label),
    ['Dice Roll', 'Drawing', 'First Strike', 'Charges', 'Turn Resolution'],
  );

  assertEqual(
    deriveTurnPhaseVm({
      phaseKey: 'build.dice_roll',
      turnNumber: 7,
      progress,
      isFinished: false,
      displayLeftSpeciesId: 'ancient',
    }).milestones.find((milestone) => milestone.id === 'charges')?.label,
    'Charges / Solar Powers',
  );
});

Deno.test('mandatory availability and optional expected-or-occurred semantics reject stale turns', () => {
  const current = deriveTurnPhaseVm({
    phaseKey: 'battle.first_strike',
    turnNumber: 7,
    progress,
    isFinished: false,
    healthResolutionPresentationActive: false,
  });
  assertEqual(current.milestones.find((item) => item.id === 'dice_roll')?.isAvailable, true);
  assertEqual(current.milestones.find((item) => item.id === 'first_strike')?.isAvailable, true);
  assertEqual(current.milestones.find((item) => item.id === 'charges')?.isAvailable, false);

  const stale = deriveTurnPhaseVm({
    phaseKey: 'build.drawing',
    turnNumber: 8,
    progress,
    isFinished: false,
    healthResolutionPresentationActive: false,
  });
  assertEqual(stale.milestones.find((item) => item.id === 'first_strike')?.isAvailable, false);
});

Deno.test('setup and finished states use the current lifecycle contract', () => {
  const setup = deriveTurnPhaseVm({
    phaseKey: 'setup.species_selection',
    turnNumber: 0,
    progress: null,
    isFinished: false,
    healthResolutionPresentationActive: false,
  });
  assertEqual(setup.turnNumber, null);
  assertEqual(setup.currentMilestone, null);

  const terminal = deriveTurnPhaseVm({
    phaseKey: 'battle.end_of_turn_resolution',
    turnNumber: 8,
    progress: null,
    isFinished: true,
  });
  assertEqual(terminal.turnNumber, 8);
  assertEqual(terminal.currentMilestone, null);
});
