declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  decideAutoPanelRouting,
  decideStaleWorkflowPanelRouting,
  getDefaultChoiceIdForRenderableAction,
  getSelectedChoiceIdForRenderableAction,
  type RenderableServerAction,
} from '../../gameSession/availableActions';

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

Deno.test('Carrier Drawing prelude routing remains independent of dice presentation', () => {
  const decision = decideAutoPanelRouting({
    phaseKey: 'build.drawing',
    hasActionsAvailable: true,
    actionsTargetPanelId: 'ap.build.drawing.prelude.carrier',
    activePanelId: 'ap.catalog.ships.human',
    mySpecies: 'human',
    selectedSpecies: null,
    buildDrawingRouteRequest: null,
    drawingStage: { kind: 'prelude', passIndex: 1 },
    carrierPreludeActionsValid: true,
  });

  assertEquals(
    decision.kind,
    'setActivePanelId',
    'a valid authoritative Carrier prelude should still route immediately'
  );
  if (decision.kind === 'setActivePanelId') {
    assertEquals(
      decision.nextPanelId,
      'ap.build.drawing.prelude.carrier',
      'Carrier should route to its prelude action panel'
    );
  }
});

Deno.test('stale workflow routing falls back to the player self catalogue', () => {
  const decision = decideStaleWorkflowPanelRouting({
    hasActionsAvailable: false,
    activePanelId: 'ap.battle.charges.ancient.black_hole',
    mySpecies: 'centaur',
    isPlayerViewer: true,
  });

  assertEquals(
    decision.kind,
    'setActivePanelId',
    'an empty nested workflow panel should be normalized'
  );
  if (decision.kind === 'setActivePanelId') {
    assertEquals(
      decision.nextPanelId,
      'ap.catalog.ships.centaur',
      'normalization should route to the current player self catalogue'
    );
  }
});

Deno.test('new actions do not steal focus from a deliberately selected catalogue', () => {
  const decision = decideStaleWorkflowPanelRouting({
    hasActionsAvailable: true,
    activePanelId: 'ap.catalog.ships.xenite',
    mySpecies: 'human',
    isPlayerViewer: true,
  });

  assertEquals(decision.kind, 'none', 'one-way normalization should ignore appearing actions');
});

Deno.test('stale workflow routing preserves passive, terminal, unknown, and spectator surfaces', () => {
  const preservedSurfaces = [
    'ap.catalog.ships.human',
    'ap.menu.root',
    'ap.idle.blank',
    'ap.end_of_game.result',
    'ap.unknown',
  ];

  for (const activePanelId of preservedSurfaces) {
    assertEquals(
      decideStaleWorkflowPanelRouting({
        hasActionsAvailable: false,
        activePanelId,
        mySpecies: 'human',
        isPlayerViewer: true,
      }).kind,
      'none',
      `${activePanelId} should not be treated as a stale workflow`
    );
  }

  assertEquals(
    decideStaleWorkflowPanelRouting({
      hasActionsAvailable: false,
      activePanelId: 'ap.battle.first_strike.human',
      mySpecies: 'human',
      isPlayerViewer: false,
    }).kind,
    'none',
    'spectator navigation should remain untouched'
  );
});
