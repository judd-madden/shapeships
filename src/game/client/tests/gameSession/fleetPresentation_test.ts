declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  classifyShipVisibilityToViewer,
  filterFleetSummariesBySuppressedMemberIds,
  getCurrentTurnHiddenShipInstanceIds,
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
