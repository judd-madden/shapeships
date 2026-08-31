import assert from 'node:assert/strict';
import { planBotBuildSubmit } from '../../../engine/bot/buildPlanner.ts';
import type { AuthoredBotPlan } from '../../../engine/bot/botTypes.ts';

function ship(instanceId: string, shipDefId: string, chargesCurrent = 0) {
  return { instanceId, shipDefId, chargesCurrent, createdTurn: 1 };
}

function createState(args: {
  faction?: 'ancient' | 'centaur';
  lines: number;
  joiningLines?: number;
  fleet?: any[];
}): any {
  return {
    players: [
      {
        id: 'bot',
        role: 'player',
        faction: args.faction ?? 'ancient',
        health: 25,
        lines: args.lines,
        joiningLines: args.joiningLines ?? 0,
      },
      {
        id: 'opponent',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    gameData: {
      ships: {
        bot: args.fleet ?? [],
        opponent: [],
      },
    },
  };
}

function ancientEndLoopPlan(
  endLoop: NonNullable<AuthoredBotPlan['orderedBuildPlan']>['endLoop'],
): AuthoredBotPlan {
  return {
    id: 'test-ancient-end-loop',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: { buildOrder: [], endLoop },
  };
}

Deno.test('first-affordable end-loop entries honor authored priority and affordability', () => {
  const plan = ancientEndLoopPlan([
    { firstAffordableShipDefIds: ['SOL', 'NEP'] },
  ]);

  assert.deepEqual(
    planBotBuildSubmit(createState({ lines: 8 }), 'bot', plan).builds,
    [{ shipDefId: 'SOL', count: 1 }],
  );
  assert.deepEqual(
    planBotBuildSubmit(createState({ lines: 7 }), 'bot', plan).builds,
    [{ shipDefId: 'NEP', count: 1 }],
  );
  assert.deepEqual(
    planBotBuildSubmit(createState({ lines: 6 }), 'bot', plan).builds,
    [],
  );
});

Deno.test('first-affordable skips maxed and unavailable candidates without inventing caps', () => {
  const sixQuantumMystics = Array.from(
    { length: 6 },
    (_entry, index) => ship(`qua-${index + 1}`, 'QUA'),
  );
  const maxedPlan = ancientEndLoopPlan([
    { firstAffordableShipDefIds: ['QUA', 'NEP'] },
  ]);
  assert.deepEqual(
    planBotBuildSubmit(
      createState({ lines: 7, fleet: sixQuantumMystics }),
      'bot',
      maxedPlan,
    ).builds,
    [{ shipDefId: 'NEP', count: 1 }],
  );

  const unavailablePlan = ancientEndLoopPlan([
    { firstAffordableShipDefIds: ['NOT_A_SHIP', 'NEP'] },
  ]);
  assert.deepEqual(
    planBotBuildSubmit(createState({ lines: 7 }), 'bot', unavailablePlan).builds,
    [{ shipDefId: 'NEP', count: 1 }],
  );
});

Deno.test('priority entries do not participate in opportunistic upgrade scanning', () => {
  const componentBlockedPlan: AuthoredBotPlan = {
    id: 'priority-no-bridge-or-fallback',
    speciesId: 'CEN',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [],
      endLoop: [{ firstAffordableShipDefIds: ['POW', 'VIG'] }],
      fallbacks: { default: ['FEA', 'ANG'] },
    },
  };
  assert.deepEqual(
    planBotBuildSubmit(
      createState({ faction: 'centaur', lines: 6 }),
      'bot',
      componentBlockedPlan,
    ).builds,
    [{ shipDefId: 'VIG', count: 1 }],
  );

  const componentReadyFleet = [
    ship('fea-1', 'FEA'),
    ship('ang-1', 'ANG'),
    ship('ang-2', 'ANG'),
    ship('vig-1', 'VIG'),
  ];
  const plan: AuthoredBotPlan = {
    id: 'priority-not-upgrade-candidate',
    speciesId: 'CEN',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [],
      endLoop: [
        'FEA',
        { firstAffordableShipDefIds: ['POW'] },
      ],
    },
  };

  assert.deepEqual(
    planBotBuildSubmit(
      createState({
        faction: 'centaur',
        lines: 2,
        joiningLines: 6,
        fleet: componentReadyFleet,
      }),
      'bot',
      plan,
    ).builds,
    [
      { shipDefId: 'FEA', count: 1 },
      { shipDefId: 'POW', count: 1 },
    ],
  );
});

Deno.test('ordinary ordered save and upgrade fallback behavior remains unchanged', () => {
  const ordinarySavePlan: AuthoredBotPlan = {
    id: 'ordinary-save-regression',
    speciesId: 'CEN',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: { buildOrder: ['VIG'] },
  };
  assert.deepEqual(
    planBotBuildSubmit(
      createState({ faction: 'centaur', lines: 5 }),
      'bot',
      ordinarySavePlan,
    ).builds,
    [],
  );

  const fallbackPlan: AuthoredBotPlan = {
    id: 'upgrade-fallback-regression',
    speciesId: 'CEN',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [{ shipDefId: 'POW', fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] }],
    },
  };
  assert.deepEqual(
    planBotBuildSubmit(
      createState({ faction: 'centaur', lines: 3 }),
      'bot',
      fallbackPlan,
    ).builds,
    [{ shipDefId: 'FEA', count: 1 }],
  );
});

Deno.test('generic planner applies the canonical QUA maximum across repeated end-loop passes', () => {
  const plan = ancientEndLoopPlan(['QUA']);
  const fiveQuantumMystics = Array.from(
    { length: 5 },
    (_entry, index) => ship(`qua-${index + 1}`, 'QUA'),
  );
  const sixQuantumMystics = [
    ...fiveQuantumMystics,
    ship('qua-6', 'QUA'),
  ];

  assert.deepEqual(
    planBotBuildSubmit(createState({ lines: 30 }), 'bot', plan).builds,
    [{ shipDefId: 'QUA', count: 6 }],
  );
  assert.deepEqual(
    planBotBuildSubmit(
      createState({ lines: 30, fleet: fiveQuantumMystics }),
      'bot',
      plan,
    ).builds,
    [{ shipDefId: 'QUA', count: 1 }],
  );
  assert.deepEqual(
    planBotBuildSubmit(
      createState({ lines: 30, fleet: sixQuantumMystics }),
      'bot',
      plan,
    ).builds,
    [],
  );
});
