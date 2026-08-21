declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  buildPresentationFleetCountsByLiveRenderKey,
  classifyShipVisibilityToViewer,
  filterFleetSummariesBySuppressedMemberIds,
  getCurrentTurnHiddenShipInstanceIds,
  getCurrentTurnRegisteredSimulacrumInstanceIds,
  getDeferredBugDrawingSpendCountByInstanceId,
  projectDeferredBugChargePresentation,
} from '../../gameSession/fleetPresentation';

interface FleetSummary {
  shipDefId: string;
  stackKey: string;
  renderKey: string;
  count: number;
  memberInstanceIds: string[];
  condition?: 'charges_1' | 'charges_0';
  currentCharges: number | null;
  caption: string | null;
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

function assertSame(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function makeSummary(args: {
  shipDefId: string;
  stackKey?: string;
  renderKey?: string;
  count: number;
  memberInstanceIds: string[];
  condition?: FleetSummary['condition'];
  currentCharges?: number | null;
  caption?: string | null;
}): FleetSummary {
  return {
    shipDefId: args.shipDefId,
    stackKey: args.stackKey ?? args.shipDefId,
    renderKey: args.renderKey ?? `render__${args.stackKey ?? args.shipDefId}`,
    count: args.count,
    memberInstanceIds: args.memberInstanceIds,
    condition: args.condition,
    currentCharges: args.currentCharges ?? null,
    caption: args.caption ?? null,
  };
}

Deno.test('presentation redaction withholds a wholly new current-turn stack', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'ANT',
    count: 1,
    memberInstanceIds: ['ant-new'],
  })];

  assertEquals(
    filterFleetSummariesBySuppressedMemberIds(liveFleet, ['ant-new']),
    [],
    'a wholly suppressed stack should not be presented'
  );
  assertEquals(
    liveFleet[0].memberInstanceIds,
    ['ant-new'],
    'presentation filtering must not mutate the live fleet used by activation lookup'
  );
});

Deno.test('presentation redaction subtracts only the new member from an aggregate stack', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'XEN',
    count: 4,
    memberInstanceIds: ['xen-1', 'xen-2', 'xen-3', 'xen-new'],
  })];
  const presentedFleet = filterFleetSummariesBySuppressedMemberIds(
    liveFleet,
    ['xen-new']
  );

  assertEquals(presentedFleet[0].count, 3, 'the presented stack count should exclude the new member');
  assertEquals(
    presentedFleet[0].memberInstanceIds,
    ['xen-1', 'xen-2', 'xen-3'],
    'only the suppressed authoritative member ID should be removed'
  );
  assertEquals(liveFleet[0].count, 4, 'the live count must remain available to runtime consumers');
});

Deno.test('latest charge graphics and semantic buckets pass through during redaction', () => {
  const chargedFleet = [
    makeSummary({
      shipDefId: 'CUB',
      stackKey: 'CUB__inst_cube-old',
      count: 1,
      memberInstanceIds: ['cube-old'],
      currentCharges: 1,
    }),
    makeSummary({
      shipDefId: 'ANT',
      count: 1,
      memberInstanceIds: ['ant-new'],
    }),
  ];
  const chargedPresented = filterFleetSummariesBySuppressedMemberIds(
    chargedFleet,
    ['ant-new']
  );

  assertSame(
    chargedPresented[0],
    chargedFleet[0],
    'an existing charged stack should retain the latest live summary object'
  );
  assertEquals(chargedPresented[0].currentCharges, 1, 'the latest charge count should pass through');

  const depletedFleet = [makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__charges_0',
    count: 1,
    memberInstanceIds: ['cube-old'],
    condition: 'charges_0',
    currentCharges: 0,
  })];
  const depletedPresented = filterFleetSummariesBySuppressedMemberIds(
    depletedFleet,
    ['ant-new']
  );

  assertSame(
    depletedPresented[0],
    depletedFleet[0],
    'a semantic charge-bucket transition should pass through immediately'
  );
});

Deno.test('existing removals pass through because the filter uses the latest fleet', () => {
  const latestFleet = [makeSummary({
    shipDefId: 'XEN',
    count: 1,
    memberInstanceIds: ['xen-survivor'],
  })];

  assertEquals(
    filterFleetSummariesBySuppressedMemberIds(latestFleet, ['ant-new']),
    latestFleet,
    'a removed existing member must not be restored by presentation filtering'
  );
});

Deno.test('inactive redaction publishes current state immediately', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'ANT',
    count: 2,
    memberInstanceIds: ['ant-new', 'ant-after-settle'],
  })];
  const presentedFleet = filterFleetSummariesBySuppressedMemberIds(liveFleet, []);

  assertSame(
    presentedFleet,
    liveFleet,
    'dice settlement, later Drawing changes, and hydration should use current state directly'
  );
});

Deno.test('unidentified summary members fail open', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'XEN',
    count: 2,
    memberInstanceIds: ['xen-known'],
  })];
  const presentedFleet = filterFleetSummariesBySuppressedMemberIds(
    liveFleet,
    ['missing-instance-id']
  );

  assertSame(presentedFleet[0], liveFleet[0], 'unmatched or unidentified members stay visible');
  assertEquals(presentedFleet[0].count, 2, 'unidentified members must not be guessed at');
});

Deno.test('fleet derivation suppresses only hidden current-turn local instances', () => {
  const suppressedIds = getCurrentTurnHiddenShipInstanceIds({
    ships: [
      { shipDefId: 'XEN', instanceId: 'xen-old', createdTurn: 2 },
      { shipDefId: 'ANT', instanceId: 'ant-new', createdTurn: 3 },
      { shipDefId: 'XEN', instanceId: 'sim-new', createdTurn: 3 },
      { shipDefId: 'XEN', createdTurn: 3 },
      { shipDefId: 'XEN', instanceId: 'xen-malformed-turn' },
    ],
    ownerPlayerId: 'local',
    turnNumber: 3,
    majorPhase: 'build',
    isInBattlePhase: false,
    materializedSimulacrumFleetInstanceIdsByPlayerId: {
      local: ['sim-new'],
    },
  });

  assertEquals(
    suppressedIds,
    ['ant-new'],
    'older, malformed, unidentified, and registered Simulacrum members must fail open'
  );
});

Deno.test('existing opponent and opponent-VOID visibility keeps Simulacrum materialisations visible', () => {
  const context = {
    ownerPlayerId: 'opponent',
    turnNumber: 3,
    majorPhase: 'build',
    isInBattlePhase: false,
    materializedSimulacrumFleetInstanceIdsByPlayerId: {
      opponent: ['opponent-sim', 'void-sim'],
    },
  };
  const opponentShips = [
    { shipDefId: 'XEN', instanceId: 'opponent-hidden', createdTurn: 3 },
    { shipDefId: 'XEN', instanceId: 'opponent-sim', createdTurn: 3 },
  ];
  const opponentVoidShips = [
    { shipDefId: 'XEN', instanceId: 'void-hidden', createdTurn: 3 },
    { shipDefId: 'XEN', instanceId: 'void-sim', createdTurn: 3 },
  ];

  assertEquals(
    opponentShips
      .filter((ship) => classifyShipVisibilityToViewer({ ...context, ship }))
      .map((ship) => ship.instanceId),
    ['opponent-sim'],
    'the existing opponent fleet visibility classification must be preserved'
  );
  assertEquals(
    opponentVoidShips
      .filter((ship) => classifyShipVisibilityToViewer({ ...context, ship }))
      .map((ship) => ship.instanceId),
    ['void-sim'],
    'the existing opponent VOID visibility classification must be preserved'
  );
});

Deno.test('BUG Drawing cue counts are unique per batch, player, and source instance', () => {
  const passOne = {
    key: 'ship-activation:3:build.drawing:drawing-prelude:local:pass:1',
    turnNumber: 3,
    phaseKey: 'build.drawing',
    sources: [
      { playerId: 'local', sourceInstanceId: 'bug-a' },
      { playerId: 'local', sourceInstanceId: 'bug-a' },
      { playerId: 'local', sourceInstanceId: 'xen-a' },
    ],
  };
  const counts = getDeferredBugDrawingSpendCountByInstanceId({
    activationCueBatches: [
      passOne,
      passOne,
      {
        key: 'ship-activation:3:build.drawing:drawing-prelude:local:pass:2',
        turnNumber: 3,
        phaseKey: 'build.drawing',
        sources: [{ playerId: 'local', sourceInstanceId: 'bug-a' }],
      },
      {
        key: 'wrong-player',
        turnNumber: 3,
        phaseKey: 'build.drawing',
        sources: [{ playerId: 'opponent', sourceInstanceId: 'bug-a' }],
      },
      {
        key: 'wrong-phase',
        turnNumber: 3,
        phaseKey: 'build.dice_roll',
        sources: [{ playerId: 'local', sourceInstanceId: 'bug-a' }],
      },
      {
        key: 'wrong-turn',
        turnNumber: 2,
        phaseKey: 'build.drawing',
        sources: [{ playerId: 'local', sourceInstanceId: 'bug-a' }],
      },
    ],
    localPlayerId: 'local',
    turnNumber: 3,
    ships: [
      { shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 2 },
      { shipDefId: 'XEN', instanceId: 'xen-a' },
    ],
  });

  assertEquals(
    counts,
    { 'bug-a': 2 },
    'separate Chronoswarm pass batches count separately while duplicate observations count once'
  );
});

Deno.test('active BUG presentation restores only its deferred source charges and caps at maximum', () => {
  const bugSummary = makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__inst_bug-a',
    renderKey: 'stable-bug-a',
    count: 1,
    memberInstanceIds: ['bug-a'],
    currentCharges: 3,
  });
  const ordinaryChargeSummary = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__inst_cube-a',
    renderKey: 'stable-cube-a',
    count: 1,
    memberInstanceIds: ['cube-a'],
    currentCharges: 1,
  });
  const liveFleet = [bugSummary, ordinaryChargeSummary];
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: liveFleet,
    ships: [
      { shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 3 },
      { shipDefId: 'CUB', instanceId: 'cube-a', chargesCurrent: 1 },
    ],
    deferredSpendCountByInstanceId: {
      'bug-a': 2,
      'cube-a': 1,
    },
    bugMaxCharges: 4,
  });

  assertEquals(presentedFleet[0].currentCharges, 4, 'BUG display restoration is capped at four');
  assertEquals(presentedFleet[0].renderKey, 'stable-bug-a', 'active BUG render identity remains stable');
  assertSame(
    presentedFleet[1],
    ordinaryChargeSummary,
    'ordinary charge summaries remain live and unmodified'
  );
  assertEquals(bugSummary.currentCharges, 3, 'the authoritative/live BUG summary is not mutated');
});

Deno.test('single depleted BUG is temporarily presented as its charged source instance', () => {
  const liveSummary = makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__charges_0',
    renderKey: 'stable-depleted-bug',
    count: 1,
    memberInstanceIds: ['bug-a'],
    condition: 'charges_0',
    currentCharges: 0,
  });
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: [liveSummary],
    ships: [{ shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 0 }],
    deferredSpendCountByInstanceId: { 'bug-a': 1 },
    bugMaxCharges: 4,
  });

  assertEquals(
    presentedFleet,
    [{
      ...liveSummary,
      stackKey: 'BUG__inst_bug-a',
      memberInstanceIds: ['bug-a'],
      condition: undefined,
      currentCharges: 1,
    }],
    'the source keeps its pre-spend graphic without changing its stable render identity'
  );
  assertEquals(liveSummary.condition, 'charges_0', 'the live depleted condition remains authoritative');
});

Deno.test('deferred BUG sources split individually from a multi-member depleted stack', () => {
  const liveSummary = makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__charges_0',
    renderKey: 'live-depleted-stack',
    count: 3,
    memberInstanceIds: ['bug-old', 'bug-a', 'bug-b'],
    condition: 'charges_0',
    currentCharges: 0,
  });
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: [liveSummary],
    ships: [
      { shipDefId: 'BUG', instanceId: 'bug-old', chargesCurrent: 0 },
      { shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 0 },
      { shipDefId: 'BUG', instanceId: 'bug-b', chargesCurrent: 0 },
    ],
    deferredSpendCountByInstanceId: { 'bug-a': 1, 'bug-b': 2 },
    bugMaxCharges: 4,
  });

  assertEquals(
    presentedFleet,
    [
      {
        ...liveSummary,
        count: 1,
        memberInstanceIds: ['bug-old'],
      },
      {
        ...liveSummary,
        count: 1,
        stackKey: 'BUG__inst_bug-a',
        renderKey: 'presentation__BUG__inst_bug-a',
        memberInstanceIds: ['bug-a'],
        condition: undefined,
        currentCharges: 1,
      },
      {
        ...liveSummary,
        count: 1,
        stackKey: 'BUG__inst_bug-b',
        renderKey: 'presentation__BUG__inst_bug-b',
        memberInstanceIds: ['bug-b'],
        condition: undefined,
        currentCharges: 2,
      },
    ],
    'only deferred source instances leave the depleted aggregate'
  );
  assertEquals(
    liveSummary.memberInstanceIds,
    ['bug-old', 'bug-a', 'bug-b'],
    'the live aggregate membership remains unchanged for runtime and activation lookup'
  );
});

Deno.test('settled BUG presentation returns the live authoritative fleet unchanged', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__charges_0',
    count: 1,
    memberInstanceIds: ['bug-a'],
    condition: 'charges_0',
    currentCharges: 0,
  })];
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: liveFleet,
    ships: [{ shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 0 }],
    deferredSpendCountByInstanceId: {},
    bugMaxCharges: 4,
  });

  assertSame(presentedFleet, liveFleet, 'release removes the presentation override immediately');
});

Deno.test('registered Simulacrum presentation IDs require both registry membership and current turn', () => {
  const ships = [
    { shipDefId: 'XEN', instanceId: 'sim-current', createdTurn: 4 },
    { shipDefId: 'XEN', instanceId: 'sim-old', createdTurn: 3 },
    { shipDefId: 'XEN', instanceId: 'ordinary-current', createdTurn: 4 },
  ];
  const ids = getCurrentTurnRegisteredSimulacrumInstanceIds({
    ships,
    ownerPlayerId: 'local',
    turnNumber: 4,
    materializedSimulacrumFleetInstanceIdsByPlayerId: {
      local: ['sim-current', 'sim-old'],
    },
  });

  assertEquals(ids, ['sim-current'], 'createdTurn scopes registry entries but never identifies SSIM alone');
  assertEquals(ships.length, 3, 'authoritative/runtime ship inputs remain intact');
});

Deno.test('presentation animation counts delay SSIM additions and coalesce BUG-only splits', () => {
  const liveFleet = [
    makeSummary({
      shipDefId: 'BUG',
      stackKey: 'BUG__charges_0',
      renderKey: 'live-depleted-stack',
      count: 2,
      memberInstanceIds: ['bug-old', 'bug-a'],
      condition: 'charges_0',
      currentCharges: 0,
    }),
    makeSummary({
      shipDefId: 'XEN',
      renderKey: 'live-xen-stack',
      count: 2,
      memberInstanceIds: ['xen-old', 'sim-current'],
    }),
  ];
  const unsettledFleet = [
    makeSummary({
      shipDefId: 'BUG',
      stackKey: 'BUG__charges_0',
      renderKey: 'live-depleted-stack',
      count: 1,
      memberInstanceIds: ['bug-old'],
      condition: 'charges_0',
      currentCharges: 0,
    }),
    makeSummary({
      shipDefId: 'BUG',
      stackKey: 'BUG__inst_bug-a',
      renderKey: 'presentation__BUG__inst_bug-a',
      count: 1,
      memberInstanceIds: ['bug-a'],
      currentCharges: 1,
    }),
    makeSummary({
      shipDefId: 'XEN',
      renderKey: 'live-xen-stack',
      count: 1,
      memberInstanceIds: ['xen-old'],
    }),
  ];

  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: unsettledFleet,
      liveFleet,
    }),
    {
      'live-depleted-stack': 2,
      'live-xen-stack': 1,
    },
    'BUG splits map to live identity while the unsettled SSIM member remains uncounted'
  );
  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: liveFleet,
      liveFleet,
    }),
    {
      'live-depleted-stack': 2,
      'live-xen-stack': 2,
    },
    'settle exposes only the SSIM N-to-N+1 count change'
  );
});

Deno.test('local and opponent registered SSIM additions stay out of presentation counts until release', () => {
  const localShips = [
    { shipDefId: 'XEN', instanceId: 'local-sim', createdTurn: 5 },
  ];
  const opponentShips = [
    { shipDefId: 'XEN', instanceId: 'opponent-xen-old', createdTurn: 4 },
    { shipDefId: 'XEN', instanceId: 'opponent-sim', createdTurn: 5 },
  ];
  const registry = {
    local: ['local-sim'],
    opponent: ['opponent-sim'],
  };
  const localLiveFleet = [makeSummary({
    shipDefId: 'XEN',
    renderKey: 'local-xen',
    count: 1,
    memberInstanceIds: ['local-sim'],
  })];
  const opponentLiveFleet = [makeSummary({
    shipDefId: 'XEN',
    renderKey: 'opponent-xen',
    count: 2,
    memberInstanceIds: ['opponent-xen-old', 'opponent-sim'],
  })];
  const localPresentedFleet = filterFleetSummariesBySuppressedMemberIds(
    localLiveFleet,
    getCurrentTurnRegisteredSimulacrumInstanceIds({
      ships: localShips,
      ownerPlayerId: 'local',
      turnNumber: 5,
      materializedSimulacrumFleetInstanceIdsByPlayerId: registry,
    })
  );
  const opponentPresentedFleet = filterFleetSummariesBySuppressedMemberIds(
    opponentLiveFleet,
    getCurrentTurnRegisteredSimulacrumInstanceIds({
      ships: opponentShips,
      ownerPlayerId: 'opponent',
      turnNumber: 5,
      materializedSimulacrumFleetInstanceIdsByPlayerId: registry,
    })
  );

  assertEquals(localPresentedFleet, [], 'local SSIM 0-to-1 is withheld before release');
  assertEquals(opponentPresentedFleet[0].count, 1, 'opponent SSIM N-to-N+1 is withheld before release');
  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: localPresentedFleet,
      liveFleet: localLiveFleet,
    }),
    {},
    'local entry count is not consumed early'
  );
  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: opponentPresentedFleet,
      liveFleet: opponentLiveFleet,
    }),
    { 'opponent-xen': 1 },
    'opponent stack-add count is not consumed early'
  );
  assertEquals(localLiveFleet[0].count, 1, 'local runtime fleet remains authoritative and present');
  assertEquals(opponentLiveFleet[0].count, 2, 'opponent runtime fleet remains authoritative and present');
});

Deno.test('ordinary non-BUG charge presentation remains live across charge and bucket changes', () => {
  const charged = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__inst_cube-a',
    count: 1,
    memberInstanceIds: ['cube-a'],
    currentCharges: 1,
  });
  const depleted = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__charges_0',
    count: 1,
    memberInstanceIds: ['cube-a'],
    condition: 'charges_0',
    currentCharges: 0,
  });

  assertSame(
    projectDeferredBugChargePresentation({
      fleet: [charged],
      ships: [{ shipDefId: 'CUB', instanceId: 'cube-a', chargesCurrent: 1 }],
      deferredSpendCountByInstanceId: { 'cube-a': 1 },
      bugMaxCharges: 4,
    })[0],
    charged,
    'ordinary 2-to-1 charge display remains live'
  );
  assertSame(
    projectDeferredBugChargePresentation({
      fleet: [depleted],
      ships: [{ shipDefId: 'CUB', instanceId: 'cube-a', chargesCurrent: 0 }],
      deferredSpendCountByInstanceId: { 'cube-a': 1 },
      bugMaxCharges: 4,
    })[0],
    depleted,
    'ordinary 1-to-0 semantic bucket display remains live'
  );
});
