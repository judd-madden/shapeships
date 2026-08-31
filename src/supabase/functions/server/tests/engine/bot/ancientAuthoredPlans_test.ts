import assert from 'node:assert/strict';
import {
  ACTIVE_ANCIENT_AUTHORED_PLANS,
  getAncientAuthoredPlanByStrategyId,
} from '../../../engine/bot/ancientAuthoredPlans.ts';
import {
  ACTIVE_ANCIENT_BOT_STRATEGIES,
} from '../../../engine/bot/ancientPlans.ts';
import {
  planBotBuildDecision,
  planBotBuildSubmit,
} from '../../../engine/bot/buildPlanner.ts';
import type {
  BotPlanProgress,
} from '../../../engine/bot/botTypes.ts';

function ship(shipDefId: string, index: number) {
  return {
    instanceId: `${shipDefId.toLowerCase()}-${index}`,
    shipDefId,
    chargesCurrent: shipDefId === 'SOL' ? 4 : 0,
    createdTurn: 1,
  };
}

function fleet(counts: Record<string, number>) {
  return Object.entries(counts).flatMap(([shipDefId, count]) =>
    Array.from({ length: count }, (_, index) => ship(shipDefId, index + 1))
  );
}

function state(args: {
  health?: number;
  lines?: number;
  ships?: any[];
}) {
  return {
    players: [
      {
        id: 'bot',
        role: 'player',
        faction: 'ancient',
        health: args.health ?? 25,
        lines: args.lines ?? 0,
        joiningLines: 0,
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
      ships: { bot: structuredClone(args.ships ?? []), opponent: [] },
    },
  };
}

function expandedBuilds(payload: { builds: Array<{ shipDefId: string; count: number }> }) {
  return payload.builds.flatMap((build) =>
    Array.from({ length: build.count }, () => build.shipDefId)
  );
}

function plan(id: string) {
  const resolved = getAncientAuthoredPlanByStrategyId(id);
  assert.ok(resolved);
  return resolved;
}

Deno.test('Phase 17D authored registry has exact parity and leaves Phase 17E deferred', () => {
  assert.equal(ACTIVE_ANCIENT_AUTHORED_PLANS.length, 9);
  assert.deepEqual(
    ACTIVE_ANCIENT_AUTHORED_PLANS.map((entry) => entry.id),
    [
      'anc_cube_red_green',
      'anc_big_standard_econ',
      'anc_cube_quantum_solar_snowball',
      'anc_vortex_no_simulacrum',
      'anc_small_econ_siphon',
      'anc_sol_reach_black_hole',
      'anc_sol_blue_snowball',
      'anc_spiral_aggro',
      'anc_mer_aggro',
    ],
  );
  const strategyIds = new Set(
    ACTIVE_ANCIENT_BOT_STRATEGIES.map((entry) => entry.id),
  );
  for (const authored of ACTIVE_ANCIENT_AUTHORED_PLANS) {
    assert.equal(authored.speciesId, 'ANC');
    assert.equal(strategyIds.has(authored.id), true);
  }
  assert.equal(getAncientAuthoredPlanByStrategyId('anc_vortex_simulacrum'), null);
  assert.equal(getAncientAuthoredPlanByStrategyId('anc_silly_simulacrum'), null);
  assert.equal(getAncientAuthoredPlanByStrategyId('anc_unknown'), null);
});

Deno.test('Phase 17D fixed openings, loops, QUA, and SPI policies match authored production data', () => {
  const ordered = (id: string) => plan(id).orderedBuildPlan;
  assert.deepEqual(ordered('anc_big_standard_econ')?.buildOrder, [
    'CUB',
    'NEP', 'NEP',
    'PLU', 'PLU', 'PLU',
    'NEP', 'NEP',
    'PLU', 'PLU', 'PLU',
    'NEP', 'NEP',
    'MER', 'MER', 'MER', 'MER', 'MER', 'MER',
  ]);
  assert.deepEqual(ordered('anc_big_standard_econ')?.endLoop, [
    'PLU', 'PLU', 'PLU', 'MER', 'MER', 'MER',
  ]);
  assert.deepEqual(ordered('anc_vortex_no_simulacrum')?.buildOrder, [
    'CUB',
    'NEP',
    'SPI', 'SPI', 'SPI',
    'NEP', 'NEP',
    'MER', 'MER', 'MER',
    'PLU', 'PLU', 'PLU',
    'QUA',
    'SOL',
  ]);
  assert.deepEqual(ordered('anc_spiral_aggro')?.buildOrder, [
    'SPI', 'SPI', 'SPI',
  ]);
  assert.deepEqual(ordered('anc_spiral_aggro')?.endLoop, ['MER']);
  assert.deepEqual(ordered('anc_mer_aggro')?.endLoop, ['MER']);
  assert.deepEqual(
    plan('anc_vortex_no_simulacrum').quantumMysticPolicy,
    { QUA: { mode: 'fixed_6' } },
  );
  assert.deepEqual(
    plan('anc_cube_quantum_solar_snowball').quantumMysticPolicy,
    { QUA: { mode: 'fixed_6' } },
  );
  assert.deepEqual(plan('anc_spiral_aggro').targetPolicy, {
    SPI: { mode: 'highest_cost_basic' },
  });
  assert.deepEqual(plan('anc_vortex_no_simulacrum').targetPolicy, {
    SPI: { mode: 'highest_cost_basic' },
  });
});

Deno.test('committed Cube trio is pure, survives saving, and ignores later health changes', () => {
  const authored = plan('anc_cube_red_green');
  const initial = state({ health: 25, lines: 0, ships: fleet({ CUB: 1 }) });
  const before = structuredClone(initial);
  const selected = planBotBuildDecision(initial, 'bot', authored);
  assert.deepEqual(initial, before);
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.deepEqual(selected.payload.builds, []);
  assert.deepEqual(selected.proposedPlanProgressUpdate, {
    kind: 'set',
    progress: {
      committedBuildGroup: {
        planId: 'anc_cube_red_green',
        groupKey: 'core_trio',
        branchId: 'mer',
        shipDefId: 'MER',
        startingCount: 0,
        targetCount: 3,
      },
    },
  });

  const progress = selected.proposedPlanProgressUpdate?.kind === 'set'
    ? selected.proposedPlanProgressUpdate.progress
    : undefined;
  assert.ok(progress);
  const continued = planBotBuildDecision(
    state({ health: 10, lines: 8, ships: fleet({ CUB: 1, MER: 1 }) }),
    'bot',
    authored,
    progress,
  );
  assert.equal(continued.ok, true);
  if (continued.ok) {
    assert.deepEqual(expandedBuilds(continued.payload), ['MER', 'MER']);
    assert.equal(continued.proposedPlanProgressUpdate, undefined);
  }

  const nextGroup = planBotBuildDecision(
    state({ health: 19, lines: 9, ships: fleet({ CUB: 1, MER: 3 }) }),
    'bot',
    authored,
    progress,
  );
  assert.equal(nextGroup.ok, true);
  if (nextGroup.ok) {
    assert.deepEqual(expandedBuilds(nextGroup.payload), ['PLU', 'PLU', 'PLU']);
    assert.equal(
      nextGroup.proposedPlanProgressUpdate?.kind === 'set' &&
        nextGroup.proposedPlanProgressUpdate.progress.committedBuildGroup.branchId,
      'plu',
    );
  }
});

Deno.test('Cube trio equality at 20 chooses MER and health 19 chooses PLU', () => {
  const authored = plan('anc_cube_red_green');
  for (const [health, expected] of [[20, 'MER'], [19, 'PLU']] as const) {
    const decision = planBotBuildDecision(
      state({ health, lines: 4, ships: fleet({ CUB: 1 }) }),
      'bot',
      authored,
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.deepEqual(expandedBuilds(decision.payload), [expected]);
    }
  }
});

Deno.test('Sol Reach locks the PLU target selected at stage entry', () => {
  const authored = plan('anc_sol_reach_black_hole');
  const selected = planBotBuildDecision(
    state({ health: 15, lines: 3, ships: fleet({ NEP: 3 }) }),
    'bot',
    authored,
  );
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.deepEqual(expandedBuilds(selected.payload), ['PLU']);
  assert.equal(
    selected.proposedPlanProgressUpdate?.kind === 'set' &&
      selected.proposedPlanProgressUpdate.progress.committedBuildGroup.targetCount,
    6,
  );

  const progress = selected.proposedPlanProgressUpdate?.kind === 'set'
    ? selected.proposedPlanProgressUpdate.progress
    : undefined;
  assert.ok(progress);
  const continued = planBotBuildDecision(
    state({ health: 20, lines: 15, ships: fleet({ NEP: 3, PLU: 1 }) }),
    'bot',
    authored,
    progress,
  );
  assert.equal(continued.ok, true);
  if (continued.ok) {
    assert.deepEqual(
      expandedBuilds(continued.payload),
      ['PLU', 'PLU', 'PLU', 'PLU', 'PLU'],
    );
  }

  const beyondLockedStage = planBotBuildDecision(
    state({
      health: 25,
      lines: 0,
      ships: fleet({ NEP: 3, PLU: 6, SOL: 1 }),
    }),
    'bot',
    authored,
    progress,
  );
  assert.equal(beyondLockedStage.ok, true);
  if (beyondLockedStage.ok) {
    assert.deepEqual(beyondLockedStage.payload.builds, []);
    assert.equal(beyondLockedStage.proposedPlanProgressUpdate, undefined);
  }

  const afterSolarDestruction = planBotBuildDecision(
    state({
      health: 25,
      lines: 8,
      ships: fleet({ NEP: 3, PLU: 6, MER: 3 }),
    }),
    'bot',
    authored,
    progress,
  );
  assert.equal(afterSolarDestruction.ok, true);
  if (afterSolarDestruction.ok) {
    assert.deepEqual(expandedBuilds(afterSolarDestruction.payload), ['SOL']);
    assert.equal(afterSolarDestruction.proposedPlanProgressUpdate, undefined);
  }

  const healthy = planBotBuildDecision(
    state({ health: 16, lines: 9, ships: fleet({ NEP: 3 }) }),
    'bot',
    authored,
  );
  assert.equal(healthy.ok, true);
  if (healthy.ok) {
    assert.equal(
      healthy.proposedPlanProgressUpdate?.kind === 'set' &&
        healthy.proposedPlanProgressUpdate.progress.committedBuildGroup.targetCount,
      3,
    );
  }
});

Deno.test('committed progress survives destruction below its historical starting count', () => {
  const authored = plan('anc_cube_red_green');
  const committed = planBotBuildDecision(
    state({ health: 25, lines: 0, ships: fleet({ CUB: 1, MER: 3 }) }),
    'bot',
    authored,
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  assert.deepEqual(committed.payload.builds, []);
  const progress = committed.proposedPlanProgressUpdate?.kind === 'set'
    ? committed.proposedPlanProgressUpdate.progress
    : undefined;
  assert.ok(progress);
  assert.deepEqual(progress.committedBuildGroup, {
    planId: 'anc_cube_red_green',
    groupKey: 'core_trio',
    branchId: 'mer',
    shipDefId: 'MER',
    startingCount: 3,
    targetCount: 6,
  });

  const afterDestruction = planBotBuildDecision(
    state({ health: 10, lines: 16, ships: fleet({ CUB: 1, MER: 2 }) }),
    'bot',
    authored,
    progress,
  );
  assert.equal(afterDestruction.ok, true);
  if (afterDestruction.ok) {
    assert.deepEqual(
      expandedBuilds(afterDestruction.payload),
      ['MER', 'MER', 'MER', 'MER'],
    );
    assert.equal(afterDestruction.proposedPlanProgressUpdate, undefined);
  }
});

Deno.test('fixed PLU/MER loops resume solely from fleet counts', () => {
  const authored = plan('anc_small_econ_siphon');
  const derived = planBotBuildDecision(
    state({ lines: 3, ships: fleet({ NEP: 2, PLU: 2 }) }),
    'bot',
    authored,
  );
  assert.equal(derived.ok, true);
  if (derived.ok) {
    assert.equal(derived.proposedPlanProgressUpdate, undefined);
  }
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({ lines: 3, ships: fleet({ NEP: 2, PLU: 2 }) }),
      'bot',
      authored,
    )),
    ['PLU'],
  );
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({ lines: 8, ships: fleet({ NEP: 2, PLU: 3, MER: 1 }) }),
      'bot',
      authored,
    )),
    ['MER', 'MER'],
  );
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({ lines: 21, ships: fleet({ NEP: 2 }) }),
      'bot',
      authored,
    )),
    ['PLU', 'PLU', 'PLU', 'MER', 'MER', 'MER'],
  );
});

Deno.test('post-opening PLU support and capped priority growth use fleet state only', () => {
  const solBlue = plan('anc_sol_blue_snowball');
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({ health: 15, lines: 3, ships: [] }),
      'bot',
      solBlue,
    )),
    [],
  );
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({ health: 15, lines: 3, ships: fleet({ NEP: 2 }) }),
      'bot',
      solBlue,
    )),
    ['PLU'],
  );
  const derivedSupport = planBotBuildDecision(
    state({ health: 15, lines: 3, ships: fleet({ NEP: 2 }) }),
    'bot',
    solBlue,
  );
  assert.equal(derivedSupport.ok, true);
  if (derivedSupport.ok) {
    assert.equal(derivedSupport.proposedPlanProgressUpdate, undefined);
  }
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({ health: 15, lines: 8, ships: fleet({ NEP: 2, PLU: 3 }) }),
      'bot',
      solBlue,
    )),
    ['SOL'],
  );

  const quantum = plan('anc_cube_quantum_solar_snowball');
  const derivedGrowth = planBotBuildDecision(
    state({
      health: 25,
      lines: 5,
      ships: fleet({ CUB: 2, QUA: 1, NEP: 1 }),
    }),
    'bot',
    quantum,
  );
  assert.equal(derivedGrowth.ok, true);
  if (derivedGrowth.ok) {
    assert.deepEqual(expandedBuilds(derivedGrowth.payload), ['QUA']);
    assert.equal(derivedGrowth.proposedPlanProgressUpdate, undefined);
  }
  assert.deepEqual(
    expandedBuilds(planBotBuildSubmit(
      state({
        health: 25,
        lines: 8,
        ships: fleet({ CUB: 4, QUA: 6, NEP: 6 }),
      }),
      'bot',
      quantum,
    )),
    ['SOL'],
  );
});

Deno.test('malformed or stale committed progress fails closed', () => {
  const malformed: BotPlanProgress = {
    committedBuildGroup: {
      planId: 'anc_cube_red_green',
      groupKey: 'core_trio',
      branchId: 'mer',
      shipDefId: 'MER',
      startingCount: 0,
      targetCount: 4,
    },
  };
  assert.deepEqual(
    planBotBuildDecision(
      state({ health: 25, lines: 4, ships: fleet({ CUB: 1 }) }),
      'bot',
      plan('anc_cube_red_green'),
      malformed,
    ),
    { ok: false, reason: 'invalid_committed_build_group_progress' },
  );
});
