declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  canSubmitDrawingBuild,
  constructCarrierPreludeBatch,
  deriveDrawingStage,
  getDrawingPhaseInstanceSuffix,
  normalizeDrawingPrelude,
  validateProjectedCarrierActions,
  type ProjectedCarrierAction,
} from './drawingPrelude';
import {
  ACTION_PANEL_IDS,
  isActionPanelId,
  normalizeActionPanelId,
} from '../../display/actionPanel/ActionPanelRegistry';
import {
  derivePhasePresentation,
  getSubphaseLabelFromPhaseKey,
  RUNTIME_PHASE_ROWS,
} from './phaseLabels';

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

function carrier(
  sourceInstanceId: string,
  passIndex: 1 | 2 = 1,
  choices: Array<'defender' | 'fighter' | 'hold'> = ['defender', 'fighter', 'hold'],
): ProjectedCarrierAction {
  return {
    kind: 'choice',
    actionId: 'CAR#0',
    shipDefId: 'CAR',
    sourceInstanceId,
    passIndex,
    choices: choices.map((choiceId) => ({ choiceId })),
  };
}

function phasePresentation(
  overrides: Partial<Parameters<typeof derivePhasePresentation>[0]>,
) {
  return derivePhasePresentation({
    phaseKey: 'battle.reveal',
    isFinished: false,
    isSpectator: false,
    drawingStageKind: 'passive',
    requesterIsReady: false,
    opponentIsReady: false,
    hasAvailableActions: false,
    ancientChargeStage: null,
    ...overrides,
  });
}

Deno.test('Drawing prelude normalization distinguishes players, spectators, and unresolved viewers', () => {
  assertEquals(
    normalizeDrawingPrelude({
      phaseKey: 'build.drawing',
      turnNumber: 4,
      participation: 'non_participant',
      requesterDrawingPrelude: undefined,
    }),
    { kind: 'not_applicable', reason: 'non_participant' },
  );
  assertEquals(
    normalizeDrawingPrelude({
      phaseKey: 'build.drawing',
      turnNumber: 4,
      participation: 'unresolved',
      requesterDrawingPrelude: undefined,
    }),
    { kind: 'unresolved' },
  );
  assertEquals(
    normalizeDrawingPrelude({
      phaseKey: 'build.drawing',
      turnNumber: 4,
      participation: 'participant',
      requesterDrawingPrelude: undefined,
    }),
    { kind: 'missing' },
  );

  const stale = normalizeDrawingPrelude({
    phaseKey: 'build.drawing',
    turnNumber: 4,
    participation: 'participant',
    requesterDrawingPrelude: {
      turnNumber: 3,
      status: 'complete',
      passIndex: 1,
      passCount: 1,
    },
  });
  assertEquals(stale, { kind: 'stale', turnNumber: 3 });

  const malformed = normalizeDrawingPrelude({
    phaseKey: 'build.drawing',
    turnNumber: 4,
    participation: 'participant',
    requesterDrawingPrelude: {
      turnNumber: 4,
      status: 'awaiting_actions',
      passIndex: 2,
      passCount: 1,
    },
  });
  assertEquals(malformed, { kind: 'invalid' });
});

Deno.test('Drawing stage precedence and suffixes are requester-local and stable', () => {
  const awaitingOne = normalizeDrawingPrelude({
    phaseKey: 'build.drawing',
    turnNumber: 8,
    participation: 'participant',
    requesterDrawingPrelude: {
      turnNumber: 8,
      status: 'awaiting_actions',
      passIndex: 1,
      passCount: 2,
    },
  });
  const awaitingTwo = normalizeDrawingPrelude({
    phaseKey: 'build.drawing',
    turnNumber: 8,
    participation: 'participant',
    requesterDrawingPrelude: {
      turnNumber: 8,
      status: 'awaiting_actions',
      passIndex: 2,
      passCount: 2,
    },
  });
  const complete = normalizeDrawingPrelude({
    phaseKey: 'build.drawing',
    turnNumber: 8,
    participation: 'participant',
    requesterDrawingPrelude: {
      turnNumber: 8,
      status: 'complete',
      passIndex: 2,
      passCount: 2,
    },
  });

  const passOneStage = deriveDrawingStage({
    normalizedPrelude: awaitingOne,
    hasExistingDrawingCommitment: false,
  });
  const passTwoStage = deriveDrawingStage({
    normalizedPrelude: awaitingTwo,
    hasExistingDrawingCommitment: false,
  });
  assertEquals(getDrawingPhaseInstanceSuffix(passOneStage), 'prelude:1');
  assertEquals(getDrawingPhaseInstanceSuffix(passTwoStage), 'prelude:2');
  assertEquals(
    deriveDrawingStage({ normalizedPrelude: complete, hasExistingDrawingCommitment: false }),
    { kind: 'normal' },
  );
  assertEquals(
    deriveDrawingStage({ normalizedPrelude: complete, hasExistingDrawingCommitment: true }),
    { kind: 'submitted' },
  );
  assertEquals(
    deriveDrawingStage({ normalizedPrelude: { kind: 'unresolved' }, hasExistingDrawingCommitment: false }),
    { kind: 'blocked' },
  );
  assertEquals(
    deriveDrawingStage({
      normalizedPrelude: { kind: 'not_applicable', reason: 'non_participant' },
      hasExistingDrawingCommitment: false,
    }),
    { kind: 'passive' },
  );

  // Player A is submitted while Player B remains in its own prelude. B's
  // requester-local state cannot move A out of submitted/waiting.
  const playerAStage = deriveDrawingStage({
    normalizedPrelude: complete,
    hasExistingDrawingCommitment: true,
  });
  const playerBStage = deriveDrawingStage({
    normalizedPrelude: awaitingOne,
    hasExistingDrawingCommitment: false,
  });
  assertEquals(playerAStage, { kind: 'submitted' });
  assertEquals(playerBStage, { kind: 'prelude', passIndex: 1 });

  // Retained local preview demand must not keep Drawing action navigation alive
  // after this requester has submitted.
  const canEditSubmittedDrawing =
    canSubmitDrawingBuild({
      participation: 'participant',
      phaseKey: 'build.drawing',
      turnNumber: 8,
      normalizedPrelude: complete,
    }) && playerAStage.kind === 'normal';
  const retainedPreviewDemand = {
    frigate: 1,
    evolver: 1,
    quantumMystic: 1,
  };
  const localDrawingFamilies = [
    canEditSubmittedDrawing && retainedPreviewDemand.evolver > 0 ? 'evolver' : null,
    canEditSubmittedDrawing && retainedPreviewDemand.frigate > 0 ? 'frigate' : null,
    canEditSubmittedDrawing && retainedPreviewDemand.quantumMystic > 0 ? 'quantum_mystic' : null,
  ].filter((family) => family != null);
  const localDrawingActionsTarget = localDrawingFamilies[0] ?? null;
  assertEquals(localDrawingFamilies, []);
  assertEquals(localDrawingActionsTarget, null);
});

Deno.test('Carrier projection validation is exact, pass-aware, and nonempty', () => {
  const valid = validateProjectedCarrierActions([carrier('car-a'), carrier('car-b')], 1);
  assert(valid.ok);
  assertEquals(valid.actions.map((action) => action.sourceInstanceId), ['car-a', 'car-b']);
  assert(!validateProjectedCarrierActions([], 1).ok);
  assert(!validateProjectedCarrierActions([carrier('car-a', 2)], 1).ok);
  assert(!validateProjectedCarrierActions([carrier('car-a'), carrier('car-a')], 1).ok);
  assert(!validateProjectedCarrierActions([carrier('car-a', 1, ['defender'])], 1).ok);
  assert(!validateProjectedCarrierActions([{
    ...carrier('car-a'),
    shipDefId: 'BUG',
  }], 1).ok);
});

Deno.test('Carrier batches submit remembered selections and remain all-or-nothing', () => {
  const previous = [carrier('car-a'), carrier('car-b')];
  const refreshed = [carrier('car-a'), carrier('car-b')];
  const batch = constructCarrierPreludeBatch({
    previousActions: previous,
    refreshedActions: refreshed,
    selectedChoiceIdBySourceInstanceId: {
      'car-a': 'fighter',
      'car-b': 'hold',
    },
  });
  assert(batch.ok);
  assertEquals(batch.actions, [
    {
      actionType: 'power',
      actionId: 'CAR#0',
      sourceInstanceId: 'car-a',
      choiceId: 'fighter',
      passIndex: 1,
    },
    {
      actionType: 'power',
      actionId: 'CAR#0',
      sourceInstanceId: 'car-b',
      choiceId: 'hold',
      passIndex: 1,
    },
  ]);

  const rememberedDefender = constructCarrierPreludeBatch({
    previousActions: [carrier('car-a')],
    refreshedActions: [carrier('car-a')],
    selectedChoiceIdBySourceInstanceId: { 'car-a': 'defender' },
  });
  assert(rememberedDefender.ok);
  assertEquals(rememberedDefender.actions[0]?.choiceId, 'defender');

  const defaultedNewSource = constructCarrierPreludeBatch({
    previousActions: [carrier('car-a')],
    refreshedActions: [carrier('car-a'), carrier('car-new')],
    selectedChoiceIdBySourceInstanceId: { 'car-a': 'fighter' },
  });
  assert(defaultedNewSource.ok);
  assertEquals(
    defaultedNewSource.actions.map((action) => action.choiceId),
    ['fighter', 'defender'],
  );

  assert(!constructCarrierPreludeBatch({
    previousActions: previous,
    refreshedActions: [carrier('car-b')],
    selectedChoiceIdBySourceInstanceId: { 'car-a': 'fighter', 'car-b': 'hold' },
  }).ok);
  assert(!constructCarrierPreludeBatch({
    previousActions: previous,
    refreshedActions: [carrier('car-a', 1, ['defender', 'hold']), carrier('car-b')],
    selectedChoiceIdBySourceInstanceId: { 'car-a': 'fighter', 'car-b': 'hold' },
  }).ok);
  assert(!constructCarrierPreludeBatch({
    previousActions: previous,
    refreshedActions: refreshed,
    selectedChoiceIdBySourceInstanceId: { 'car-a': 'fighter' },
  }).ok);
  assert(!constructCarrierPreludeBatch({
    previousActions: [],
    refreshedActions: [],
    selectedChoiceIdBySourceInstanceId: {},
  }).ok);
});

Deno.test('current-turn Carrier clicks override remembered selections before batching', () => {
  const rememberedSelections = {
    'car-a': 'fighter',
    'car-b': 'defender',
  };
  const currentTurnClicks = {
    'car-a': 'hold',
  };
  const carrierChoiceIdBySourceInstanceId = {
    ...rememberedSelections,
    ...currentTurnClicks,
  };

  const batch = constructCarrierPreludeBatch({
    previousActions: [carrier('car-a'), carrier('car-b')],
    refreshedActions: [carrier('car-a'), carrier('car-b')],
    selectedChoiceIdBySourceInstanceId: carrierChoiceIdBySourceInstanceId,
  });

  assert(batch.ok);
  assertEquals(batch.actions.map((action) => action.choiceId), ['hold', 'defender']);
});

Deno.test('BUILD_SUBMIT eligibility is participant-only and requester-current', () => {
  const complete = normalizeDrawingPrelude({
    phaseKey: 'build.drawing',
    turnNumber: 5,
    participation: 'participant',
    requesterDrawingPrelude: {
      turnNumber: 5,
      status: 'complete',
      passIndex: 1,
      passCount: 1,
    },
  });
  assert(canSubmitDrawingBuild({
    participation: 'participant',
    phaseKey: 'build.drawing',
    turnNumber: 5,
    normalizedPrelude: complete,
  }));
  assert(!canSubmitDrawingBuild({
    participation: 'non_participant',
    phaseKey: 'build.drawing',
    turnNumber: 5,
    normalizedPrelude: complete,
  }));
  assert(!canSubmitDrawingBuild({
    participation: 'participant',
    phaseKey: 'battle.reveal',
    turnNumber: 5,
    normalizedPrelude: complete,
  }));
});

Deno.test('runtime panel and phase-row cutover has one Carrier panel and Drawing to Reveal', () => {
  const carrierPanelIds = ACTION_PANEL_IDS.filter((id) => id.includes('carrier'));
  assertEquals(carrierPanelIds, ['ap.build.drawing.prelude.carrier']);
  assert(isActionPanelId('ap.build.drawing.prelude.carrier'));
  assert(!isActionPanelId('ap.build.ships_that_build.human'));
  assertEquals(RUNTIME_PHASE_ROWS.length, 7);
  const drawingIndex = RUNTIME_PHASE_ROWS.findIndex((row) => row.key === 'build.drawing');
  assert(drawingIndex >= 0);
  assertEquals(RUNTIME_PHASE_ROWS[drawingIndex + 1]?.key, 'battle.reveal');
  assert(!RUNTIME_PHASE_ROWS.some((row) => row.key === 'build.ships_that_build'));
  assert(!RUNTIME_PHASE_ROWS.some((row) => row.key === 'build.end_of_build'));
});

Deno.test('player-facing phase presentation follows authoritative interaction state', () => {
  assertEquals(getSubphaseLabelFromPhaseKey('battle.charge_declaration'), 'Charges');

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

Deno.test('former retained panel id recovers to the current Carrier fallback', () => {
  assertEquals(
    normalizeActionPanelId(
      'ap.build.ships_that_build.human',
      'ap.build.drawing.prelude.carrier',
    ),
    'ap.build.drawing.prelude.carrier',
  );
});
