declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { deriveDrawingStage } from '../../gameSession/drawingPrelude';
import {
  derivePhasePresentation,
  getSubphaseLabelFromPhaseKey,
  RUNTIME_PHASE_ROWS,
} from '../../gameSession/phaseLabels';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message = 'values differ'): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

function phasePresentation(
  overrides: Partial<Parameters<typeof derivePhasePresentation>[0]>,
) {
  return derivePhasePresentation({
    phaseKey: 'battle.reveal',
    isFinished: false,
    healthResolutionPresentationActive: false,
    isSpectator: false,
    drawingStageKind: 'passive',
    requesterIsReady: false,
    opponentIsReady: false,
    hasAvailableActions: false,
    ancientChargeStage: null,
    ...overrides,
  });
}

Deno.test('runtime phase rows follow the current Drawing-to-Reveal model', () => {
  assertEquals(RUNTIME_PHASE_ROWS.length, 7);
  const drawingIndex = RUNTIME_PHASE_ROWS.findIndex((row) => row.key === 'build.drawing');
  assert(drawingIndex >= 0);
  assertEquals(RUNTIME_PHASE_ROWS[drawingIndex + 1]?.key, 'battle.reveal');
});

Deno.test('player-facing phase presentation follows authoritative interaction state', () => {
  assertEquals(getSubphaseLabelFromPhaseKey('battle.charge_declaration'), 'Charges');

  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      heldDrawingProjection: { ordinary: 4, joining: 1 },
      healthResolutionPresentationActive: true,
    }),
    {
      title: 'Turn Resolution',
      titleSuffix: null,
      subheading: 'Healing and damage',
    },
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'submitted',
      committedDrawingProjection: { ordinary: 3, joining: 2 },
      healthResolutionPresentationActive: true,
    }),
    {
      title: 'Turn Resolution',
      titleSuffix: null,
      subheading: 'Healing and damage',
    },
  );
  assertEquals(
    phasePresentation({
      isFinished: true,
      healthResolutionPresentationActive: true,
    }),
    {
      title: 'Turn Resolution',
      titleSuffix: null,
      subheading: 'Healing and damage',
    },
  );
  assertEquals(
    phasePresentation({
      isFinished: true,
      healthResolutionPresentationActive: false,
    }),
    {
      title: 'Game Over',
      titleSuffix: null,
      subheading: '\u00A0',
    },
  );
  assertEquals(
    phasePresentation({ phaseKey: 'battle.end_of_turn_resolution' }),
    {
      title: 'Turn Resolution',
      titleSuffix: null,
      subheading: 'Healing and damage',
    },
  );

  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'prelude',
      drawingEconomy: { ordinary: 8, joining: 2 },
    }),
    {
      title: '8',
      titleSuffix: 'lines available +2 joining',
      subheading: 'You have powers available',
    },
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      drawingEconomy: { ordinary: 5, joining: 1 },
    }),
    {
      title: '5',
      titleSuffix: 'lines available +1 joining',
      subheading: 'Spend lines to build ships',
    },
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      drawingEconomy: { ordinary: 8, joining: 3 },
      heldDrawingProjection: { ordinary: 4, joining: 2 },
    }),
    {
      title: '4',
      titleSuffix: 'lines saved +2 joining',
      subheading: 'Spend lines to build ships',
    },
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      drawingEconomy: { ordinary: 8, joining: 3 },
      heldDrawingProjection: null,
    }),
    {
      title: 'Drawing',
      titleSuffix: null,
      subheading: '\u00A0',
    },
  );

  const localLockOnlyStage = deriveDrawingStage({
    normalizedPrelude: {
      kind: 'complete',
      turnNumber: 6,
      passIndex: 1,
      passCount: 1,
    },
    hasExistingDrawingCommitment: false,
  });
  assertEquals(localLockOnlyStage, { kind: 'normal' });
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: localLockOnlyStage.kind,
      drawingEconomy: { ordinary: 4, joining: 0 },
    }).titleSuffix,
    'lines available',
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'submitted',
      committedDrawingProjection: { ordinary: 3, joining: 2 },
    }),
    {
      title: '3',
      titleSuffix: 'lines saved +2 joining',
      subheading: 'Opponent drawing...',
    },
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'build.drawing',
      drawingStageKind: 'submitted',
    }),
    {
      title: 'Drawing',
      titleSuffix: null,
      subheading: 'Opponent drawing...',
    },
  );

  for (const phaseKey of ['battle.first_strike', 'battle.charge_declaration']) {
    assertEquals(
      phasePresentation({ phaseKey, hasAvailableActions: true }).subheading,
      'You have powers available',
    );
    assertEquals(
      phasePresentation({
        phaseKey,
        requesterIsReady: true,
        opponentIsReady: false,
      }).subheading,
      'Opponent choosing...',
    );
    assertEquals(
      phasePresentation({
        phaseKey,
        requesterIsReady: true,
        opponentIsReady: false,
        hasAvailableActions: true,
      }).subheading,
      'Opponent choosing...',
    );
  }

  assertEquals(
    phasePresentation({
      phaseKey: 'battle.charge_declaration',
      ancientChargeStage: 'powers',
      hasAvailableActions: true,
    }),
    {
      title: 'Solar Powers',
      titleSuffix: null,
      subheading: 'Use your Energy to cast Solar Powers',
    },
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'battle.first_strike',
      isSpectator: true,
      hasAvailableActions: true,
      requesterIsReady: true,
    }).subheading,
    '\u00A0',
  );
  assertEquals(
    phasePresentation({
      phaseKey: 'battle.charge_declaration',
      isSpectator: true,
      ancientChargeStage: 'powers',
    }).subheading,
    '\u00A0',
  );
});

Deno.test('Mission setup gate blanks phase heading and subheading', () => {
  assertEquals(
    phasePresentation({
      phaseKey: 'setup.species_selection',
      missionIntroSetupGateActive: true,
    }),
    {
      title: '',
      titleSuffix: null,
      subheading: '',
    },
  );
});
