import assert from "node:assert/strict";
import type { BuildSubmitPayload } from "../../../engine/intent/IntentTypes.ts";
import {
  resolvePlayerBuildSubmitAuthoritatively,
} from "../../../engine/intent/buildSubmitResolution.ts";
import {
  applyAncientBattleRevealPreparation,
} from "../../../engine/state/ancientState.ts";
import {
  replaceChargeDeclarationVisibilityState,
} from "../../../engine/state/chargeDeclarationVisibility.ts";
import {
  type CurrentTurnEstimateAvailableResult,
  estimateCurrentTurnForPlayer,
} from "../../../engine/state/currentTurnEstimator.ts";
import {
  projectDrawingPreludeFleetsForViewerWithAvailability,
} from "../../../engine/state/drawingPreludeProjection.ts";
import type {
  GameState,
  ShipInstance,
} from "../../../engine/state/GameStateTypes.ts";
import {
  resolvePhase,
  resolveRevealSpecialPowers,
} from "../../../engine_shared/resolve/resolvePhase.ts";

const EMPTY_DRAFT: BuildSubmitPayload = { builds: [] };

function ship(
  instanceId: string,
  shipDefId: string,
  extra: Partial<ShipInstance> = {},
): ShipInstance {
  return { instanceId, shipDefId, createdTurn: 1, ...extra };
}

function createState(args: {
  phase?: "drawing" | "reveal" | "first_strike" | "charge_declaration";
  p1Fleet?: ShipInstance[];
  p2Fleet?: ShipInstance[];
  p1Faction?: string;
  p2Faction?: string;
  p1Lines?: number;
  turnNumber?: number;
} = {}): GameState {
  const phase = args.phase ?? "drawing";
  const turnNumber = args.turnNumber ?? 5;
  const p1Fleet = args.p1Fleet ?? [];
  const p2Fleet = args.p2Fleet ?? [];
  const state: any = {
    gameId: "current-turn-estimator",
    status: "active",
    stateRevision: 77,
    head: "unchanged-head",
    players: [
      {
        id: "p1",
        role: "player",
        faction: args.p1Faction ?? "ancient",
        health: 19,
        lines: args.p1Lines ?? 30,
        joiningLines: 20,
        isReady: false,
      },
      {
        id: "p2",
        role: "player",
        faction: args.p2Faction ?? "human",
        health: 17,
        lines: 11,
        joiningLines: 7,
        isReady: true,
      },
    ],
    gameData: {
      turnNumber,
      currentPhase: phase === "drawing" ? "build" : "battle",
      currentSubPhase: phase,
      ships: { p1: structuredClone(p1Fleet), p2: structuredClone(p2Fleet) },
      voidShipsByPlayerId: { p1: [], p2: [] },
      pendingTurn: {
        damageByPlayerId: { p1: 999 },
        healByPlayerId: { p2: 999 },
        breakdownEntries: [{ hidden: true }],
      },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: {},
        quantumMysticRevealByInstanceId: {},
      },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber,
        currentMajorPhase: phase === "drawing" ? "build" : "battle",
        currentSubPhase: phase,
        effectiveDiceRollByPlayerId: { p1: 4, p2: 2 },
        diceOverrideSourceByPlayerId: { p1: "main", p2: "main" },
        drawingPreludeByPlayerId: {
          p1: {
            turnNumber,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: "complete",
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
          },
          p2: {
            turnNumber,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: "complete",
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
          },
        },
        buildDrawingPublicFleetByPlayerId: {
          p1: structuredClone(p1Fleet),
          p2: structuredClone(p2Fleet),
        },
        pendingEffects: [{ hidden: true }],
        pendingFirstStrikeSelectionsByPlayerId: { p2: { hidden: true } },
      },
      phaseReadiness: [{ playerId: "p1", isReady: false }],
      phaseStartedAt: 1234,
      phaseDeadlineAt: 9999,
    },
    actions: [{ private: true }],
  };
  return state;
}

function estimateDrawing(
  state: GameState,
  draft: BuildSubmitPayload = EMPTY_DRAFT,
): CurrentTurnEstimateAvailableResult {
  const result = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft,
  });
  assert.notEqual(result.status, "unavailable");
  return result as CurrentTurnEstimateAvailableResult;
}

function estimateTurnStart(
  state: GameState,
): CurrentTurnEstimateAvailableResult {
  const result = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
    drawingMode: "turn_start_baseline",
  });
  assert.notEqual(result.status, "unavailable");
  return result as CurrentTurnEstimateAvailableResult;
}

function estimatePublic(state: GameState, playerId = "p1") {
  return estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: playerId,
    playerId,
    draft: null,
  });
}

Deno.test("Drawing simulation includes automatic SOL Reveal spending and depleted healing", () => {
  const state = createState({
    p1Fleet: [
      ship("sol-0", "SOL", { chargesCurrent: 0 }),
      ship("sol-1", "SOL", { chargesCurrent: 1 }),
      ship("sol-4", "SOL", { chargesCurrent: 4 }),
    ],
  });

  const result = estimateDrawing(state);
  assert.deepEqual(result.reveal.solarGridChargeTransitions, [
    { from: 0, to: 0, count: 1 },
    { from: 1, to: 0, count: 1 },
    { from: 4, to: 3, count: 1 },
  ]);
  assert.equal(result.healing, 4);
  assert.equal(result.healingRows.reduce((sum, row) => sum + row.amount, 0), 4);
  assert.equal(
    result.damageRows.reduce((sum, row) => sum + row.amount, 0),
    result.damage,
  );
});

Deno.test("Ancient requester receives complete canonical Base and Autocast variants", () => {
  const state = createState({
    p1Fleet: [
      ship("plu-1", "PLU"),
      ship("plu-2", "PLU"),
      ship("plu-3", "PLU"),
      ship("mer-1", "MER"),
      ship("mer-2", "MER"),
      ship("mer-3", "MER"),
      ship("qua", "QUA", {
        permanentConfiguration: { selectedNumber: 4 },
      }),
      ship("solar", "SOL", { chargesCurrent: 1 }),
    ],
  });

  const result = estimateTurnStart(state);
  assert.ok(result.withAutocast);
  assert.equal(result.withAutocast.healing.total - result.healing, 9);
  assert.equal(result.withAutocast.damage.total - result.damage, 8);
  assert.deepEqual(
    result.withAutocast.healing.rows
      .filter((row) => row.rowKind === "solar_power")
      .map((row) => [row.label, row.amount]),
    [["Star Birth", 8], ["Life", 1]],
  );
  assert.deepEqual(
    result.withAutocast.damage.rows
      .filter((row) => row.rowKind === "solar_power")
      .map((row) => [row.label, row.amount]),
    [["Supernova", 7], ["Asteroid", 1]],
  );
});

Deno.test("Autocast uses single-energy fallbacks and preserves genuine zero health variants", () => {
  const single = estimateTurnStart(createState({
    p1Fleet: [ship("plu", "PLU"), ship("mer", "MER")],
  }));
  assert.ok(single.withAutocast);
  assert.equal(single.withAutocast.healing.total, 1);
  assert.equal(single.withAutocast.damage.total, 1);
  assert.deepEqual(single.withAutocast.healing.rows.map((row) => row.label), ["Life"]);
  assert.deepEqual(single.withAutocast.damage.rows.map((row) => row.label), ["Asteroid"]);

  const blueOnly = estimateTurnStart(createState({
    p1Fleet: [
      ship("qua", "QUA", { permanentConfiguration: { selectedNumber: 4 } }),
    ],
  }));
  assert.ok(blueOnly.withAutocast);
  assert.equal(blueOnly.withAutocast.damage.total, blueOnly.damage);
  assert.equal(blueOnly.withAutocast.healing.total, blueOnly.healing);
  assert.deepEqual(blueOnly.withAutocast.damage.rows, blueOnly.damageRows);
  assert.deepEqual(blueOnly.withAutocast.healing.rows, blueOnly.healingRows);
});

Deno.test("Drawing draft Autocast energy includes newly built MER PLU and charged SOL", () => {
  const state = createState({ p1Lines: 100 });
  const result = estimateDrawing(state, {
    builds: [
      { shipDefId: "MER", count: 2 },
      { shipDefId: "PLU", count: 2 },
      { shipDefId: "SOL", count: 1 },
    ],
  });
  assert.ok(result.withAutocast);
  assert.equal(result.withAutocast.healing.total - result.healing, 8);
  assert.equal(result.withAutocast.damage.total - result.damage, 7);
  assert.equal(
    result.withAutocast.healing.rows.some((row) => row.rowKind === "solar_power"),
    true,
  );
  assert.equal(
    result.withAutocast.damage.rows.some((row) => row.rowKind === "solar_power"),
    true,
  );
});

Deno.test("post-Reveal private Autocast uses recorded own Reveal energy", () => {
  const state: any = createState({
    phase: "reveal",
    p1Fleet: [ship("spent-solar", "SOL", { chargesCurrent: 0 })],
  });
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.ancient.energyByPlayerId.p1 = {
    battleTurnNumber: 5,
    pool: { green: 3, red: 3, blue: 0 },
    sources: [],
  };
  const result = estimatePublic(state);
  assert.notEqual(result.status, "unavailable");
  if (result.status === "unavailable") return;
  assert.ok(result.withAutocast);
  assert.equal(result.healing, 2);
  assert.equal(result.withAutocast.healing.total, 10);
  assert.equal(result.withAutocast.damage.total, 7);

  const publicOnly = estimateCurrentTurnForPlayer({
    state,
    playerId: "p1",
    draft: null,
  });
  assert.notEqual(publicOnly.status, "unavailable");
  if (publicOnly.status !== "unavailable") {
    assert.equal(publicOnly.withAutocast, undefined);
    assert.equal(publicOnly.healing, result.healing);
    assert.equal(publicOnly.damage, result.damage);
  }
});

Deno.test("turn-start baseline uses only validated entry fleets and persistent rows", () => {
  const state: any = createState({
    p1Fleet: [
      ship("entry-fig", "FIG"),
      ship("entry-def", "DEF"),
      ship("entry-car", "CAR", { chargesCurrent: 2 }),
    ],
  });
  state.gameData.ships.p1.push(
    ship("carrier-produced-fig", "FIG", { createdTurn: 5 }),
  );
  state.gameData.turnData.shipsMadeThisTurnByPlayerId = { p1: 1 };

  const result = estimateTurnStart(state);
  assert.equal(result.damage, 1);
  assert.equal(result.healing, 1);
  assert.deepEqual(result.damageRows.map((row) => row.label), ["Fighter"]);
  assert.deepEqual(result.healingRows.map((row) => row.label), ["Defender"]);
  assert.equal(
    result.damageRows.reduce((sum, row) => sum + row.amount, 0),
    result.damage,
  );
  assert.equal(
    result.healingRows.reduce((sum, row) => sum + row.amount, 0),
    result.healing,
  );
});

Deno.test("turn-start baseline distinguishes Carrier-only zero from unavailable snapshots", () => {
  const carrierOnly = createState({
    p1Fleet: [ship("entry-car", "CAR", { chargesCurrent: 2 })],
  });
  const zero = estimateTurnStart(carrierOnly);
  assert.equal(zero.damage, 0);
  assert.equal(zero.healing, 0);
  assert.deepEqual(zero.damageRows, []);
  assert.deepEqual(zero.healingRows, []);

  const stale: any = structuredClone(carrierOnly);
  stale.gameData.turnData.drawingPreludeByPlayerId.p1.turnNumber = 4;
  const unavailable = estimateCurrentTurnForPlayer({
    state: stale,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
    drawingMode: "turn_start_baseline",
  });
  assert.equal(unavailable.status, "unavailable");
  if (unavailable.status === "unavailable") {
    assert.equal(unavailable.reason, "drawing_snapshot_unavailable");
  }
});

Deno.test("turn-start baseline preserves once-only memory and simulates canonical Reveal", () => {
  const state: any = createState({
    p1Faction: "human",
    p1Fleet: [
      ship("spent-fear", "FEA", { createdTurn: 5 }),
      ship("spent-anger", "ANG", { createdTurn: 5 }),
      ship("spent-starship", "STA", { createdTurn: 5 }),
      ship("charged-solar", "SOL", { createdTurn: 4, chargesCurrent: 1 }),
    ],
  });
  state.gameData.powerMemory.onceOnlyFired = {
    "spent-fear::FEA#0": true,
    "spent-anger::ANG#0": true,
    "spent-starship::STA#0": true,
  };

  const baseline = estimateTurnStart(state);
  assert.equal(baseline.damage, 0);
  assert.equal(baseline.healing, 2);
  assert.deepEqual(baseline.reveal.solarGridChargeTransitions, [{
    from: 1,
    to: 0,
    count: 1,
  }]);

  const normal = estimateDrawing(createState({
    p1Faction: "human",
    p1Lines: 20,
  }), {
    builds: [{ shipDefId: "STA", count: 1 }],
  });
  assert.equal(normal.damage, 8);
  assert.equal(normal.damageRows.some((row) => row.label === "Starship"), true);
});

Deno.test("post-Reveal estimates use public SOL charges without simulating Reveal again", () => {
  const state = createState({
    phase: "reveal",
    p1Fleet: [
      ship("sol-spent", "SOL", { chargesCurrent: 0 }),
      ship("sol-charged", "SOL", { chargesCurrent: 3 }),
    ],
  }) as any;
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;

  const result = estimatePublic(state) as CurrentTurnEstimateAvailableResult;
  assert.equal(result.status, "estimated");
  assert.equal(result.healing, 2);
  assert.deepEqual(result.reveal.solarGridChargeTransitions, []);
});

Deno.test("Charge Declaration freezes fleets and ignores acknowledgements, live depletion, and pending effects", () => {
  const state = createState({
    phase: "charge_declaration",
    p1Fleet: [ship("sol", "SOL", { chargesCurrent: 1 })],
  }) as any;
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: [ship("sol", "SOL", { chargesCurrent: 1 })],
    p2: [],
  };
  state.gameData.ancient.energyByPlayerId.p1 = {
    battleTurnNumber: 5,
    pool: { green: 0, red: 3, blue: 0 },
    sources: [],
  };
  replaceChargeDeclarationVisibilityState(state);

  const before = estimatePublic(state);
  const opponentBefore = estimatePublic(state, "p2");
  const privateBefore = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
  });
  state.gameData.ships.p1[0].chargesCurrent = 0;
  state.gameData.ancient.energyByPlayerId.p1.pool = {
    green: 3,
    red: 0,
    blue: 0,
  };
  state.gameData.turnData.chargeDeclarationAcknowledgements
    .chargeAfterByPlayerId = {
      p1: { sol: 0 },
    };
  state.gameData.pendingTurn.damageByPlayerId.p2 = 5000;
  state.gameData.turnData.pendingEffects = [{ amount: 5000 }];
  state.gameData.turnData.pendingChargeDeclarations = { p1: { hidden: true } };
  state.gameData.ancient.acceptedDeclarationByPlayerId = {
    p1: { hiddenSolarPowerCasts: [{ amount: 5000 }] },
  };
  const after = estimatePublic(state);
  const opponentAfter = estimatePublic(state, "p2");
  const privateAfter = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
  });

  assert.deepEqual(after, before);
  assert.deepEqual(opponentAfter, opponentBefore);
  assert.deepEqual(privateAfter, privateBefore);
  assert.notEqual(privateBefore.status, "unavailable");
  if (privateBefore.status !== "unavailable") {
    assert.ok(privateBefore.withAutocast);
    assert.ok(privateBefore.withAutocast.damage.total > privateBefore.damage);
  }
  assert.equal(after.status, "privacy_frozen");
  assert.equal(after.healing, 0);
});

Deno.test("Charge Declaration Solar selections resolve in order before Autocast without mutation", () => {
  const state = createState({ phase: "charge_declaration" }) as any;
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: [],
    p2: [],
  };
  state.gameData.ancient.energyByPlayerId.p1 = {
    battleTurnNumber: 5,
    pool: { green: 3, red: 3, blue: 2 },
    sources: [],
  };
  replaceChargeDeclarationVisibilityState(state);
  const before = structuredClone(state);

  const estimate = (
    solarCasts: Array<{ solarPowerId: "SLIF" | "SSTA" | "SAST" | "SSUP" | "SCON" }>,
    autocastEnabled: boolean,
  ) => {
    const result = estimateCurrentTurnForPlayer({
      state,
      requestingParticipantId: "p1",
      playerId: "p1",
      draft: null,
      solarSelection: { solarCasts, autocastEnabled },
    });
    assert.notEqual(result.status, "unavailable");
    if (result.status === "unavailable") throw new Error(result.reason);
    assert.ok(result.withSolarSelection);
    return result.withSolarSelection;
  };

  const life = estimate([{ solarPowerId: "SLIF" }], true);
  assert.equal(life.healing.total, 3);
  assert.equal(life.damage.total, 7);
  assert.deepEqual(
    life.healing.rows.map((row) => [
      row.label,
      row.rowKind === "adjustment" ? null : row.count,
      row.amount,
    ]),
    [["Life", 3, 3]],
  );

  const asteroid = estimate([{ solarPowerId: "SAST" }], true);
  assert.equal(asteroid.damage.total, 3);
  assert.equal(asteroid.healing.total, 8);

  const supernova = estimate([{ solarPowerId: "SSUP" }], true);
  assert.equal(supernova.damage.total, 7);
  assert.equal(supernova.healing.total, 8);
  assert.equal(
    supernova.damage.rows.filter((row) => row.label === "Supernova").length,
    1,
  );

  const manualOnly = estimate([
    { solarPowerId: "SLIF" },
    { solarPowerId: "SAST" },
    { solarPowerId: "SCON" },
  ], false);
  assert.equal(manualOnly.healing.total, 1);
  assert.equal(manualOnly.damage.total, 1);
  assert.equal(manualOnly.autocastEnabled, false);

  const ordered = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
    solarSelection: {
      solarCasts: [{ solarPowerId: "SLIF" }, { solarPowerId: "SAST" }],
      autocastEnabled: false,
    },
  });
  const reversed = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
    solarSelection: {
      solarCasts: [{ solarPowerId: "SAST" }, { solarPowerId: "SLIF" }],
      autocastEnabled: false,
    },
  });
  assert.notEqual(
    ordered.identity.solarSelectionKey,
    reversed.identity.solarSelectionKey,
  );

  const repeated = estimate([
    { solarPowerId: "SLIF" },
    { solarPowerId: "SLIF" },
    { solarPowerId: "SAST" },
    { solarPowerId: "SAST" },
    { solarPowerId: "SCON" },
    { solarPowerId: "SCON" },
  ], false);
  assert.equal(repeated.healing.total, 2);
  assert.equal(repeated.damage.total, 2);
  assert.deepEqual(state, before);
});

Deno.test("withChargeDeclaration covers advanced Solar resolvers and remaining-energy Autocast", () => {
  const estimate = (
    solarCasts: Array<{
      solarPowerId: "SSIP" | "SVOR" | "SBLA" | "SSIM";
      targetInstanceId?: string;
      targetInstanceIds?: string[];
      lockedAmount?: number;
    }>,
    energy: { green: number; red: number; blue: number },
    autocastEnabled = false,
  ) => {
    const state = createState({
      phase: "charge_declaration",
      p1Fleet: [ship("plu", "PLU"), ship("mer", "MER")],
      p2Fleet: [ship("enemy-def", "DEF"), ship("enemy-fig", "FIG")],
    }) as any;
    state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
    state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
      structuredClone(state.gameData.ships);
    state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
      p1: [],
      p2: [],
    };
    state.gameData.ancient.energyByPlayerId.p1 = {
      battleTurnNumber: 5,
      pool: energy,
      sources: [],
    };
    replaceChargeDeclarationVisibilityState(state);
    const before = structuredClone(state);
    const result = estimateCurrentTurnForPlayer({
      state,
      requestingParticipantId: "p1",
      playerId: "p1",
      draft: null,
      chargeDeclaration: {
        contractVersion: 1,
        declarationId: `advanced-${solarCasts[0].solarPowerId}`,
        ordinaryChargeActions: [],
        solarCasts,
        autocastEnabled,
      },
    });
    assert.notEqual(result.status, "unavailable");
    if (result.status === "unavailable") throw new Error(result.reason);
    assert.ok(result.withChargeDeclaration);
    assert.deepEqual(state, before);
    return result.withChargeDeclaration;
  };

  const siphon = estimate(
    [{ solarPowerId: "SSIP", lockedAmount: 4 }],
    { green: 7, red: 7, blue: 0 },
    true,
  );
  assert.deepEqual(
    siphon.damage.rows.map((row) => row.label),
    ["Siphon", "Supernova"],
  );
  assert.deepEqual(
    siphon.healing.rows.map((row) => row.label),
    ["Siphon", "Star Birth"],
  );

  const vortex = estimate(
    [{ solarPowerId: "SVOR" }],
    { green: 2, red: 2, blue: 2 },
  );
  assert.equal(vortex.damage.total, 4);
  assert.deepEqual(vortex.damage.rows.map((row) => row.label), ["Vortex"]);

  const blackHole = estimate(
    [{
      solarPowerId: "SBLA",
      targetInstanceIds: ["enemy-def", "enemy-fig"],
    }],
    { green: 4, red: 4, blue: 4 },
  );
  assert.equal(blackHole.damage.total, 2);
  assert.deepEqual(blackHole.damage.rows.map((row) => row.label), ["Black Hole"]);

  const simulacrum = estimate(
    [{ solarPowerId: "SSIM", targetInstanceId: "enemy-def" }],
    { green: 0, red: 0, blue: 100 },
  );
  assert.equal(simulacrum.damage.total, 0);
  assert.equal(simulacrum.healing.total, 0);
  assert.deepEqual(simulacrum.damage.rows, []);
  assert.deepEqual(simulacrum.healing.rows, []);
});

Deno.test("Charge declaration variants retain First Strike and collect automatic effects exactly once", () => {
  const state = createState({
    phase: "charge_declaration",
    p1Faction: "human",
    p1Fleet: [
      ship("int", "INT", { chargesCurrent: 1 }),
      ship("bat", "BAT"),
    ],
  }) as any;
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.pendingTurn = {
    damageByPlayerId: { p2: 4 },
    healByPlayerId: {},
    breakdownEntries: [{
      effectId: "first-strike-public",
      kind: "Damage",
      ownerPlayerId: "p1",
      targetPlayerId: "p2",
      sourceLabel: "First Strike",
      baseAmount: 4,
      finalAmount: 4,
    }],
  };
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(state.gameData.ships);
  state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
    p1: ["int"],
    p2: [],
  };
  replaceChargeDeclarationVisibilityState(state);

  const result = estimateCurrentTurnForPlayer({
    state,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: null,
    chargeDeclaration: {
      contractVersion: 1,
      declarationId: "first-strike-plus-charge",
      ordinaryChargeActions: [{
        actionType: "power",
        actionId: "INT#0",
        sourceInstanceId: "int",
        choiceId: "damage",
      }],
      solarCasts: [],
      autocastEnabled: false,
    },
  });
  assert.notEqual(result.status, "unavailable");
  if (result.status === "unavailable") throw new Error(result.reason);
  assert.equal(result.damage, 6);
  assert.equal(result.healing, 3);
  assert.equal(
    result.damageRows.filter((row) => row.label === "First Strike").length,
    1,
  );
  assert.ok(result.withChargeDeclaration);
  assert.equal(result.withChargeDeclaration.damage.total, 11);
  assert.equal(result.withChargeDeclaration.healing.total, 3);
  assert.equal(
    result.withChargeDeclaration.damage.rows
      .filter((row) => row.label === "First Strike").length,
    1,
  );
});

Deno.test("speculative First Strike selections and pending totals do not enter the estimate", () => {
  const baseline: any = createState({
    phase: "first_strike",
    p1Fleet: [ship("fig", "FIG")],
    p2Fleet: [ship("enemy", "DEF")],
  });
  baseline.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  const variant = structuredClone(baseline) as any;
  variant.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId = {
    p1: { source: { targetInstanceId: "enemy" } },
  };
  variant.gameData.turnData.pendingEffects = [{ amount: 999 }];
  variant.gameData.pendingTurn = {
    damageByPlayerId: { p2: 999 },
    healByPlayerId: { p1: 999 },
    breakdownEntries: [{ hidden: true }],
  };
  assert.deepEqual(estimatePublic(variant), estimatePublic(baseline));
});

Deno.test("Drawing estimator requires exact current-turn privacy maps and never accepts live fallback", () => {
  const mutations: Array<(state: any) => void> = [
    (state) => delete state.gameData.turnData.drawingPreludeByPlayerId,
    (state) => delete state.gameData.turnData.buildDrawingPublicFleetByPlayerId,
    (state) =>
      state.gameData.turnData.drawingPreludeByPlayerId.p2.turnNumber = 4,
    (state) =>
      delete state.gameData.turnData.buildDrawingPublicFleetByPlayerId.p2,
    (state) =>
      state.gameData.turnData.buildDrawingPublicFleetByPlayerId.extra = [],
    (state) =>
      state.gameData.turnData.buildDrawingPublicFleetByPlayerId.p2 = [{}],
  ];

  for (const mutate of mutations) {
    const state: any = createState({
      p2Fleet: [ship("opponent-live-secret", "BAT", { createdTurn: 5 })],
    });
    mutate(state);
    const result = estimateCurrentTurnForPlayer({
      state,
      requestingParticipantId: "p1",
      playerId: "p1",
      draft: EMPTY_DRAFT,
    });
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") {
      assert.equal(result.reason, "drawing_snapshot_unavailable");
    }
    assert.equal(
      JSON.stringify(result).includes("opponent-live-secret"),
      false,
    );
  }
});

Deno.test("availability-aware fleet fallback is limited to unresolved public battle phases", () => {
  const reveal: any = createState({ phase: "reveal" });
  const safe = projectDrawingPreludeFleetsForViewerWithAvailability(
    reveal,
    reveal.gameData.ships,
    "p1",
  );
  assert.equal(safe.projectionAvailable, true);
  assert.equal(safe.source, "live_fleet_fallback");

  const unsafeCases = [
    (() => {
      const state = structuredClone(reveal) as any;
      state.gameData.currentPhase = "setup";
      state.gameData.currentSubPhase = "species_selection";
      state.gameData.turnData.currentMajorPhase = "setup";
      state.gameData.turnData.currentSubPhase = "species_selection";
      return state;
    })(),
    (() => {
      const state = structuredClone(reveal) as any;
      state.gameData.turnData.endOfTurnResolutionAppliedTurnNumber = 5;
      return state;
    })(),
    createState({ phase: "charge_declaration" }),
  ];
  for (const state of unsafeCases) {
    const result = projectDrawingPreludeFleetsForViewerWithAvailability(
      state,
      state.gameData.ships,
      "p1",
    );
    assert.equal(result.projectionAvailable, false);
    assert.equal(result.source, "unavailable");
  }
});

Deno.test("no-power Drawing snapshots are valid and keep the opponent on the entry fleet", () => {
  const state: any = createState({
    p1Fleet: [ship("p1-def", "DEF")],
    p2Fleet: [ship("p2-public", "DEF")],
  });
  state.gameData.ships.p2.push(ship("p2-hidden", "BAT", { createdTurn: 5 }));
  const result = estimateDrawing(state);
  assert.equal(result.status, "estimated");
  assert.equal(result.identity.sourceContextKey.length, 16);
});

Deno.test("hidden opponent Drawing fleets and counters cannot affect the complete result", () => {
  const baseline: any = createState({
    p1Fleet: [ship("p1-fig", "FIG")],
    p2Fleet: [ship("p2-public", "DEF")],
  });
  const hiddenVariant = structuredClone(baseline) as any;
  hiddenVariant.gameData.ships.p2 = [
    ship("private-sol", "SOL", { chargesCurrent: 1, createdTurn: 5 }),
    ship("private-dre", "DRE", { createdTurn: 5 }),
    ship("private-bat", "BAT", { createdTurn: 5 }),
  ];
  hiddenVariant.gameData.ships.privateSeat = [ship("private-extra", "ENT")];
  hiddenVariant.gameData.turnData.effectiveDiceRollByPlayerId.privateSeat = 6;
  hiddenVariant.gameData.turnData.shipsMadeThisTurnByPlayerId = { p2: 99 };
  hiddenVariant.gameData.turnData.queenCreatedXenitesThisTurnByPlayerId = { p2: 99 };

  assert.deepEqual(estimateDrawing(hiddenVariant), estimateDrawing(baseline));
});

Deno.test("QUA Reveal controller memory survives transfer and is frozen at Charge entry", () => {
  const qua = ship("qua", "QUA", {
    permanentConfiguration: { selectedNumber: 4 },
  });
  const state: any = createState({
    phase: "charge_declaration",
    p2Fleet: [qua],
  });
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.powerMemory.quantumMysticRevealByInstanceId = {
    qua: { battleTurnNumber: 5, controllerPlayerId: "p1" },
  };
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: [],
    p2: [qua],
  };
  replaceChargeDeclarationVisibilityState(state);

  const transferred = estimatePublic(state, "p1");
  assert.notEqual(transferred.status, "unavailable");
  if (transferred.status !== "unavailable") {
    assert.equal(transferred.healing, 5);
  }

  for (
    const mutate of [
      (candidate: any) =>
        delete candidate.gameData.powerMemory.quantumMysticRevealByInstanceId
          .qua,
      (candidate: any) =>
        candidate.gameData.powerMemory.quantumMysticRevealByInstanceId.qua
          .battleTurnNumber = 4,
      (candidate: any) =>
        candidate.gameData.powerMemory.quantumMysticRevealByInstanceId.qua
          .controllerPlayerId = 7,
    ]
  ) {
    const malformed = structuredClone(state) as any;
    mutate(malformed);
    const result = estimatePublic(malformed);
    assert.notEqual(result.status, "unavailable");
    if (result.status !== "unavailable") {
      assert.equal(result.healing, 5);
    }
  }

  const invalidStableTurnData = structuredClone(state) as any;
  invalidStableTurnData.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 4;
  const unavailable = estimatePublic(invalidStableTurnData);
  assert.equal(unavailable.status, "unavailable");
  if (unavailable.status === "unavailable") {
    assert.equal(unavailable.reason, "quantum_reveal_facts_unavailable");
  }
});

Deno.test("unmatched QUA uses an established Reveal controller without consulting the opponent roll", () => {
  const unmatchedQua = ship("unmatched-qua", "QUA", {
    permanentConfiguration: { selectedNumber: 4 },
  });
  const reveal: any = createState({
    phase: "reveal",
    p2Fleet: [unmatchedQua],
  });
  reveal.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  reveal.gameData.powerMemory.quantumMysticRevealByInstanceId = {};

  const revealResult = estimatePublic(reveal, "p2");
  assert.notEqual(revealResult.status, "unavailable");
  if (revealResult.status !== "unavailable") assert.equal(revealResult.healing, 0);

  const firstStrike = structuredClone(reveal) as any;
  firstStrike.gameData.currentSubPhase = "first_strike";
  firstStrike.gameData.turnData.currentSubPhase = "first_strike";
  const firstStrikeResult = estimatePublic(firstStrike, "p2");
  assert.notEqual(firstStrikeResult.status, "unavailable");
  if (firstStrikeResult.status !== "unavailable") {
    assert.equal(firstStrikeResult.healing, 0);
  }

  const noFirstStrikeCharge = structuredClone(reveal) as any;
  noFirstStrikeCharge.gameData.currentSubPhase = "charge_declaration";
  noFirstStrikeCharge.gameData.turnData.currentSubPhase = "charge_declaration";
  noFirstStrikeCharge.gameData.turnData.turnPhaseProgress = {
    turnNumber: 5,
    firstStrike: { expected: false, occurred: false },
    charges: { expected: true, occurred: true },
  };
  noFirstStrikeCharge.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(noFirstStrikeCharge.gameData.ships);
  replaceChargeDeclarationVisibilityState(noFirstStrikeCharge);
  const chargeResult = estimatePublic(noFirstStrikeCharge, "p2");
  assert.notEqual(chargeResult.status, "unavailable");
  if (chargeResult.status !== "unavailable") assert.equal(chargeResult.healing, 0);
});

Deno.test("missing QUA memory remains unavailable when a later phase cannot establish its Reveal controller", () => {
  const qua = ship("ambiguous-qua", "QUA", {
    permanentConfiguration: { selectedNumber: 4 },
  });
  const charge: any = createState({
    phase: "charge_declaration",
    p2Fleet: [qua],
  });
  charge.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  charge.gameData.powerMemory.quantumMysticRevealByInstanceId = {};
  charge.gameData.turnData.turnPhaseProgress = {
    turnNumber: 5,
    firstStrike: { expected: true, occurred: true },
    charges: { expected: true, occurred: true },
  };
  charge.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(charge.gameData.ships);
  replaceChargeDeclarationVisibilityState(charge);

  const ambiguous = estimatePublic(charge, "p2");
  assert.equal(ambiguous.status, "unavailable");
  if (ambiguous.status === "unavailable") {
    assert.equal(ambiguous.reason, "quantum_reveal_facts_unavailable");
  }

  const staleNoFirstStrikeClaim = structuredClone(charge) as any;
  staleNoFirstStrikeClaim.gameData.turnData.turnPhaseProgress.turnNumber = 4;
  const stale = estimatePublic(staleNoFirstStrikeClaim, "p2");
  assert.equal(stale.status, "unavailable");

  const matchedButMissing: any = createState({
    phase: "reveal",
    p2Fleet: [
      ship("matched-qua", "QUA", {
        permanentConfiguration: { selectedNumber: 2 },
      }),
    ],
  });
  matchedButMissing.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  matchedButMissing.gameData.powerMemory.quantumMysticRevealByInstanceId = {};
  const matched = estimatePublic(matchedButMissing, "p2");
  assert.equal(matched.status, "unavailable");
});

Deno.test("QUA matching works in a Drawing draft and from public post-Reveal memory", () => {
  const drawing = createState({ p1Faction: "ancient", p1Lines: 10 });
  const matching = estimateDrawing(drawing, {
    builds: [{ shipDefId: "QUA", count: 1 }],
    quantumMysticSelections: [4],
  });
  const nonmatching = estimateDrawing(drawing, {
    builds: [{ shipDefId: "QUA", count: 1 }],
    quantumMysticSelections: [3],
  });
  assert.equal(matching.healing, 5);
  assert.equal(nonmatching.healing, 0);

  const qua = ship("public-qua", "QUA", {
    permanentConfiguration: { selectedNumber: 4 },
  });
  const revealed: any = createState({ phase: "reveal", p1Fleet: [qua] });
  revealed.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  revealed.gameData.powerMemory.quantumMysticRevealByInstanceId = {
    "public-qua": { battleTurnNumber: 5, controllerPlayerId: "p1" },
  };
  const publicResult = estimatePublic(revealed) as CurrentTurnEstimateAvailableResult;
  assert.equal(publicResult.healing, 5);
});

Deno.test("Drawing combat simulates Dreadnought production without publishing its future ledger row", () => {
  const state = createState({
    p1Faction: "human",
    p1Fleet: [ship("dreadnought", "DRE")],
    p1Lines: 20,
  });
  const draft: BuildSubmitPayload = {
    builds: [{ shipDefId: "DEF", count: 1 }],
  };
  const before = structuredClone(state);
  const first = estimateDrawing(state, draft);
  const second = estimateDrawing(state, draft);

  assert.deepEqual(second, first);
  assert.deepEqual(state, before);
  assert.deepEqual(first.build.lines, ["1 x DEF"]);
  assert.equal(first.damage, second.damage);
  assert.equal(JSON.stringify(first).includes("dreadnought_build_"), false);

  const revealed: any = createState({
    phase: "reveal",
    p1Faction: "human",
    p1Fleet: [ship("dreadnought", "DRE"), ship("dre-fig", "FIG", { createdTurn: 5 })],
  });
  revealed.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  revealed.battleLogScratch = {
    currentTurnCapture: {
      turnNumber: 5,
      diceValue: 4,
      buildAtomsByPlayerId: {
        p1: [{ kind: "produced_build", shipDefId: "FIG", sourceShipDefId: "DRE", count: 1 }],
        p2: [],
      },
      battleAtomsByPlayerId: { p1: [], p2: [] },
      savedResourcesByPlayerId: {},
    },
    lastFinalizedTurnNumber: 4,
  };
  const afterReveal = estimatePublic(revealed) as CurrentTurnEstimateAvailableResult;
  assert.deepEqual(afterReveal.build.lines, ["1 x FIG (DRE)"]);
});

Deno.test("Drawing preview includes immediate ZEN production without merging a paid ANT", () => {
  const state = createState({ p1Faction: "xenite", p1Lines: 40 });
  const oneZen = estimateDrawing(state, {
    builds: [
      { shipDefId: "ANT", count: 1 },
      { shipDefId: "ZEN", count: 1 },
    ],
    buildGroupOrder: [{ shipDefId: "ZEN", afterCaptureSequence: 0 }],
  });
  assert.deepEqual(oneZen.build.lines, ["1 x ANT (ZEN)", "1 x ZEN"]);

  const twoZen = estimateDrawing(state, {
    builds: [
      { shipDefId: "ANT", count: 2 },
      { shipDefId: "ZEN", count: 2 },
    ],
    buildGroupOrder: [{ shipDefId: "ZEN", afterCaptureSequence: 0 }],
  });
  assert.deepEqual(twoZen.build.lines, ["2 x ANT (2 ZEN)", "2 x ZEN"]);

  const paidAntNewest = estimateDrawing(state, {
    builds: [
      { shipDefId: "ANT", count: 2 },
      { shipDefId: "ZEN", count: 1 },
    ],
    buildGroupOrder: [
      { shipDefId: "ANT", afterCaptureSequence: 0 },
      { shipDefId: "ZEN", afterCaptureSequence: 0 },
    ],
  });
  assert.deepEqual(paidAntNewest.build.lines, [
    "1 x ANT",
    "1 x ANT (ZEN)",
    "1 x ZEN",
  ]);
});

Deno.test("upgrades consume canonical components and multiple Dreadnought facts stay anonymous", () => {
  const upgradeState = createState({
    p1Faction: "human",
    p1Lines: 0,
    p1Fleet: [
      ship("component-def-1", "DEF"),
      ship("component-def-2", "DEF"),
      ship("component-com", "COM"),
    ],
  });
  const upgrade = estimateDrawing(upgradeState, {
    builds: [{ shipDefId: "GUA", count: 1 }],
  });
  assert.deepEqual(upgrade.build.lines, ["1 x GUA"]);
  assert.equal(JSON.stringify(upgrade).includes("component-def-1"), false);

  const dreadnoughtState = createState({
    p1Faction: "human",
    p1Fleet: [ship("dre-a", "DRE"), ship("dre-b", "DRE")],
  });
  const produced = estimateDrawing(dreadnoughtState, {
    builds: [{ shipDefId: "DEF", count: 1 }],
  });
  assert.equal(produced.build.lines.some((line) => line.includes("2 x FIG")), false);
  assert.equal(JSON.stringify(produced).includes("dre-a"), false);
  assert.equal(JSON.stringify(produced).includes("dre-b"), false);
});

Deno.test("estimator is fully nonmutating across unavailable and available paths", () => {
  const drawing = createState({
    p1Fleet: [ship("sol", "SOL", { chargesCurrent: 1 })],
  });
  const beforeDrawing = structuredClone(drawing);
  estimateDrawing(drawing, {
    builds: [{ shipDefId: "QUA", count: 1 }],
    quantumMysticSelections: [4],
  });
  assert.deepEqual(drawing, beforeDrawing);

  const malformed: any = createState();
  delete malformed.gameData.turnData.drawingPreludeByPlayerId;
  const beforeMalformed = structuredClone(malformed);
  estimateCurrentTurnForPlayer({
    state: malformed,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: EMPTY_DRAFT,
  });
  assert.deepEqual(malformed, beforeMalformed);
});

Deno.test("canonical automatic and once-only rows cover configuration, modifiers, Queen, Redemption, and signed self-damage", () => {
  const state: any = createState({
    phase: "reveal",
    p1Faction: "human",
    p1Fleet: [
      ship("fig", "FIG"),
      ship("fri", "FRI"),
      ship("starship", "STA", { createdTurn: 5 }),
      ship("science-1", "SCI"),
      ship("science-2", "SCI"),
      ship("science-3", "SCI"),
      ship("sol-copy", "SOL", { chargesCurrent: 0 }),
      ship("queen-copy", "QUE"),
      ship("entropy-copy", "ENT"),
      ship("redemption-copy", "RED", { createdTurn: 5 }),
    ],
  });
  state.players[0].health = 1;
  state.gameData.powerMemory.frigateTriggerByInstanceId.fri = 4;
  state.gameData.turnData.shipsMadeThisTurnByPlayerId = { p1: 3 };
  state.gameData.turnData.queenCreatedXenitesThisTurnByPlayerId = { p1: 1 };
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;

  const result = estimatePublic(state) as CurrentTurnEstimateAvailableResult;
  assert.equal(result.status, "estimated");
  assert.equal(
    result.damageRows.reduce((sum, row) => sum + row.amount, 0),
    result.damage,
  );
  assert.equal(
    result.healingRows.reduce((sum, row) => sum + row.amount, 0),
    result.healing,
  );
  assert.equal(result.damageRows.some((row) => row.label === "Frigate"), true);
  assert.equal(result.damageRows.some((row) => row.label === "Queen"), true);
  assert.equal(
    result.damageRows.some((row) => row.label === "Science Vessel"),
    true,
  );
  assert.equal(result.healingRows.some((row) => row.amount < 0), true);
  assert.equal(
    result.healingRows.some((row) => row.label === "Redemption"),
    false,
  );
});

Deno.test("matched no-further-action calculation has authoritative end-of-turn parity", () => {
  const state: any = createState({
    phase: "reveal",
    p1Fleet: [
      ship("cube", "CUB"),
      ship("science-1", "SCI"),
      ship("science-2", "SCI"),
      ship("science-3", "SCI"),
      ship("sol", "SOL", { chargesCurrent: 0 }),
    ],
  });
  state.gameData.turnData.cubeDiceSelectionByPlayerId = {
    p1: { choiceId: "cube:cube", sourceInstanceId: "cube", value: 4 },
  };
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.pendingTurn = {
    damageByPlayerId: {},
    healByPlayerId: {},
    breakdownEntries: [],
  };

  const estimate = estimatePublic(state) as CurrentTurnEstimateAvailableResult;
  const actual = resolvePhase(
    structuredClone(state),
    "battle.end_of_turn_resolution",
  ).state;
  assert.equal(estimate.damage, actual.gameData.lastTurnDamageByPlayerId?.p2);
  assert.equal(estimate.healing, actual.gameData.lastTurnHealByPlayerId?.p1);
  assert.deepEqual(
    estimate.damageRows,
    actual.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1,
  );
  assert.deepEqual(
    estimate.healingRows,
    actual.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1,
  );
});

Deno.test("Drawing draft has canonical build-Reveal-end-of-turn parity", () => {
  const state: any = createState({
    p1Faction: "ancient",
    p1Lines: 20,
    p1Fleet: [
      ship("solar-one", "SOL", { chargesCurrent: 1 }),
      ship("foreign-dreadnought", "DRE"),
    ],
  });
  state.gameData.pendingTurn = {
    damageByPlayerId: {},
    healByPlayerId: {},
    breakdownEntries: [],
  };
  const draft: BuildSubmitPayload = {
    builds: [{ shipDefId: "QUA", count: 1 }],
    quantumMysticSelections: [4],
  };

  const estimate = estimateDrawing(state, draft);
  const authoritative = structuredClone(state) as any;
  resolvePlayerBuildSubmitAuthoritatively({
    state: authoritative,
    playerId: "p1",
    turnNumber: 5,
    nowMs: 0,
    payload: draft,
  });
  const revealed = resolveRevealSpecialPowers(authoritative).state;
  const prepared = applyAncientBattleRevealPreparation(revealed);
  const actual = resolvePhase(
    prepared,
    "battle.end_of_turn_resolution",
  ).state;

  assert.equal(
    actual.gameData.ships?.p1.find((entry) => entry.instanceId === "solar-one")
      ?.chargesCurrent,
    0,
  );
  assert.equal(
    actual.gameData.ships?.p1.filter((entry) => entry.shipDefId === "FIG").length,
    1,
  );
  assert.equal(estimate.damage, actual.gameData.lastTurnDamageByPlayerId?.p2);
  assert.equal(estimate.healing, actual.gameData.lastTurnHealByPlayerId?.p1);
  assert.deepEqual(
    estimate.damageRows,
    actual.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1,
  );
  assert.deepEqual(
    estimate.healingRows,
    actual.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1,
  );
  assert.deepEqual(estimate.reveal.solarGridChargeTransitions, [
    { from: 1, to: 0, count: 1 },
  ]);
});

Deno.test("all species and foreign copied fleets produce stable complete estimates", () => {
  const cases = [
    {
      faction: "human",
      fleet: [ship("human-def", "DEF"), ship("foreign-xen", "XEN")],
    },
    {
      faction: "xenite",
      fleet: [ship("xenite-xen", "XEN"), ship("foreign-fea", "FEA")],
    },
    {
      faction: "centaur",
      fleet: [ship("centaur-fea", "FEA"), ship("foreign-fig", "FIG")],
    },
    {
      faction: "ancient",
      fleet: [ship("ancient-plu", "PLU"), ship("foreign-def", "DEF")],
    },
  ];
  for (const entry of cases) {
    const state: any = createState({
      phase: "reveal",
      p1Faction: entry.faction,
      p1Fleet: entry.fleet,
    });
    state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
    const first = estimatePublic(state);
    const second = estimatePublic(state);
    assert.notEqual(first.status, "unavailable");
    assert.deepEqual(second, first);
  }
});

Deno.test("Evolver production, skipped attempts, and remaining resources are stable build facts", () => {
  const state = createState({
    p1Faction: "xenite",
    p1Lines: 0,
    p1Fleet: [
      ship("evo-1", "EVO"),
      ship("evo-2", "EVO"),
      ship("xen-1", "XEN"),
      ship("xen-2", "XEN"),
    ],
  });
  const result = estimateDrawing(state, {
    builds: [{ shipDefId: "XEN", count: 1 }],
    evolverChoices: [
      { sourceKey: "ignored-1", choiceId: "hold" },
      { sourceKey: "ignored-2", choiceId: "oxite" },
    ],
  });
  assert.deepEqual(result.build.lines, ["1 x OXI (EVO)"]);
  assert.equal(
    result.build.skipped.some((fact) =>
      fact.reason === "insufficient_ordinary_lines"
    ),
    true,
  );
  assert.equal(result.build.remainingOrdinaryLines, 0);
  assert.equal(result.build.remainingJoiningLines, 12);
});

Deno.test("bad roles, phases, draft modes, resolved turns, and missing charge snapshots are unavailable", () => {
  const cases: Array<
    {
      state: any;
      requester?: string;
      draft: BuildSubmitPayload | null;
      reason: string;
    }
  > = [];
  const drawing = createState();
  cases.push({
    state: drawing,
    requester: "p2",
    draft: EMPTY_DRAFT,
    reason: "invalid_requester",
  });
  cases.push({
    state: drawing,
    requester: "p1",
    draft: null,
    reason: "draft_required",
  });

  const reveal: any = createState({ phase: "reveal" });
  cases.push({
    state: structuredClone(reveal),
    requester: "p1",
    draft: EMPTY_DRAFT,
    reason: "draft_not_allowed",
  });
  reveal.gameData.turnData.endOfTurnResolutionAppliedTurnNumber = 5;
  cases.push({
    state: reveal,
    requester: "p1",
    draft: null,
    reason: "turn_already_resolved",
  });

  const unsupported: any = createState({ phase: "reveal" });
  unsupported.gameData.currentSubPhase = "end_of_turn_resolution";
  unsupported.gameData.turnData.currentSubPhase = "end_of_turn_resolution";
  cases.push({
    state: unsupported,
    requester: "p1",
    draft: null,
    reason: "unsupported_phase",
  });

  const charge: any = createState({ phase: "charge_declaration" });
  cases.push({
    state: charge,
    requester: "p1",
    draft: null,
    reason: "charge_snapshot_unavailable",
  });

  for (const entry of cases) {
    const result = estimateCurrentTurnForPlayer({
      state: entry.state,
      requestingParticipantId: entry.requester,
      playerId: "p1",
      draft: entry.draft,
    });
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") {
      assert.equal(result.reason, entry.reason);
    }
  }
});

Deno.test("estimate identity excludes canonical revision and separates context from draft", () => {
  const state: any = createState({
    p1Fleet: [ship("def", "DEF")],
    p2Fleet: [ship("fig", "FIG")],
  });
  const empty = estimateDrawing(state, { builds: [] });
  const edited = estimateDrawing(state, {
    builds: [{ shipDefId: "FIG", count: 1 }],
  });
  assert.equal(empty.identity.sourceContextKey, edited.identity.sourceContextKey);
  assert.notEqual(empty.identity.draftKey, edited.identity.draftKey);

  const revised = structuredClone(state);
  revised.stateRevision = 900;
  revised.gameData.turnData.commitments = {
    BUILD_5: { p2: { commitHash: "hidden" } },
  };
  const hiddenOnly = estimateDrawing(revised, { builds: [] });
  assert.equal(
    hiddenOnly.identity.sourceContextKey,
    empty.identity.sourceContextKey,
  );

  revised.gameData.turnData.effectiveDiceRollByPlayerId.p1 = 6;
  const stale = estimateCurrentTurnForPlayer({
    state: revised,
    requestingParticipantId: "p1",
    playerId: "p1",
    draft: EMPTY_DRAFT,
    expectedSourceContextKey: empty.identity.sourceContextKey,
  });
  assert.equal(stale.status, "unavailable");
  if (stale.status === "unavailable") {
    assert.equal(stale.reason, "source_context_changed");
    assert.notEqual(
      stale.identity.sourceContextKey,
      empty.identity.sourceContextKey,
    );
  }
});

Deno.test("identical counts with different buildGroupOrder produce distinct ordered preview ledgers", () => {
  const state: any = createState({ p1Faction: "human", p1Lines: 20 });
  state.battleLogScratch = {
    currentTurnCapture: {
      turnNumber: 5,
      diceValue: 4,
      buildAtomsByPlayerId: {
        p1: [{ kind: "reroll", sourceShipDefId: "KNO", values: [2, 4] }],
        p2: [],
      },
      battleAtomsByPlayerId: { p1: [], p2: [] },
      savedResourcesByPlayerId: {},
    },
    lastFinalizedTurnNumber: 4,
  };
  const builds = [
    { shipDefId: "DEF", count: 1 },
    { shipDefId: "FIG", count: 1 },
  ];
  const defNewest = estimateDrawing(state, {
    builds,
    buildGroupOrder: [
      { shipDefId: "DEF", afterCaptureSequence: 1 },
      { shipDefId: "FIG", afterCaptureSequence: 1 },
    ],
  });
  const figNewest = estimateDrawing(state, {
    builds,
    buildGroupOrder: [
      { shipDefId: "FIG", afterCaptureSequence: 1 },
      { shipDefId: "DEF", afterCaptureSequence: 1 },
    ],
  });
  assert.notEqual(defNewest.identity.draftKey, figNewest.identity.draftKey);
  assert.deepEqual(defNewest.build.lines, [
    "1 x DEF",
    "1 x FIG",
    "KNO rerolled 2 -> 4",
  ]);
  assert.deepEqual(figNewest.build.lines, [
    "1 x FIG",
    "1 x DEF",
    "KNO rerolled 2 -> 4",
  ]);
});

Deno.test("EVO order metadata changes preview identity and face/conversion chronology", () => {
  const state: any = createState({ p1Faction: "xenite", p1Lines: 0 });
  state.players.find((player: any) => player.id === "p1").joiningLines = 4;
  state.gameData.ships.p1 = [
    { instanceId: "evo-1", shipDefId: "EVO" },
    { instanceId: "xen-1", shipDefId: "XEN" },
    { instanceId: "oxi-1", shipDefId: "OXI" },
  ];
  const shared = {
    builds: [{ shipDefId: "OXF", count: 1 }],
    evolverChoices: [{ sourceKey: "evo-1", choiceId: "oxite" as const }],
  };
  const faceNewest = estimateDrawing(state, {
    ...shared,
    buildGroupOrder: [
      { shipDefId: "OXF", afterCaptureSequence: 0 },
      { shipDefId: "OXI", sourceShipDefId: "EVO", afterCaptureSequence: 0 },
    ],
  });
  const conversionNewest = estimateDrawing(state, {
    ...shared,
    buildGroupOrder: [
      { shipDefId: "OXI", sourceShipDefId: "EVO", afterCaptureSequence: 0 },
      { shipDefId: "OXF", afterCaptureSequence: 0 },
    ],
  });

  assert.notEqual(faceNewest.identity.draftKey, conversionNewest.identity.draftKey);
  assert.deepEqual(faceNewest.build.lines, ["1 x OXF", "1 x OXI (EVO)"]);
  assert.deepEqual(conversionNewest.build.lines, ["1 x OXI (EVO)", "1 x OXF"]);
});
