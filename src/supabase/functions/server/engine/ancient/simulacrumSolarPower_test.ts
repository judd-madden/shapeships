import assert from "node:assert/strict";
import type {
  AncientPendingSimulacrumCopy,
  GameState,
  ShipInstance,
} from "../state/GameStateTypes.ts";
import { normalizeAncientGameState } from "../state/ancientState.ts";
import { onEnterPhase } from "../phase/onEnterPhase.ts";
import { resolveSolarCastSequence } from "./manualSolarDeclaration.ts";
import {
  assertSimulacrumQuantityAvailable,
  materializeQueuedSimulacrumCopiesAtDrawing,
  projectPublicShipsForSimulacrumDrawing,
  projectRequesterHiddenDrawingSimulacrumShips,
  projectRequesterShipsForSimulacrumDrawing,
  SIMULACRUM_SOLAR_RESOLVER,
} from "./simulacrumSolarPower.ts";
import { getShipById } from "../../engine_shared/defs/ShipDefinitions.core.ts";

function ship(
  instanceId: string,
  shipDefId: string,
  overrides: Partial<ShipInstance> = {},
): ShipInstance {
  return { instanceId, shipDefId, ...overrides };
}

function createState(args: {
  p1Ships?: ShipInstance[];
  p2Ships?: ShipInstance[];
  p1Snapshot?: ShipInstance[];
  p2Snapshot?: ShipInstance[];
  players?: any[];
  turnNumber?: number;
} = {}): GameState {
  const players = args.players ?? [
    { id: "z-owner", role: "player", faction: "ancient", health: 25 },
    { id: "a-owner", role: "player", faction: "human", health: 25 },
  ];
  const turnNumber = args.turnNumber ?? 4;
  return normalizeAncientGameState({
    gameId: "simulacrum-test",
    status: "active",
    players,
    gameData: {
      turnNumber,
      currentPhase: "battle",
      currentSubPhase: "charge_declaration",
      ships: {
        [players[0].id]: args.p1Ships ?? [],
        [players[1].id]: args.p2Ships ?? [],
      },
      turnData: {
        turnNumber,
        chargeDeclarationFleetSnapshotByPlayerId: {
          [players[0].id]: structuredClone(
            args.p1Snapshot ?? args.p1Ships ?? [],
          ),
          [players[1].id]: structuredClone(
            args.p2Snapshot ?? args.p2Ships ?? [],
          ),
        },
        shipsMadeThisTurnByPlayerId: {},
      },
    },
    actions: [],
  }).state as GameState;
}

function resolve(
  state: GameState,
  targetInstanceIds: string[],
  initialBlue = 100,
) {
  return resolveSolarCastSequence({
    state,
    playerId: "z-owner",
    declarationId: "declaration-1",
    battleTurnNumber: 4,
    initialEnergy: { green: 0, red: 0, blue: initialBlue },
    casts: targetInstanceIds.map((targetInstanceId) => ({
      solarPowerId: "SSIM" as const,
      targetInstanceId,
    })),
    resolvers: { SSIM: SIMULACRUM_SOLAR_RESOLVER },
    sourceMode: "manual",
    initialLedgerOrder: 0,
  });
}

function pending(
  overrides: Partial<AncientPendingSimulacrumCopy> = {},
): AncientPendingSimulacrumCopy {
  return {
    pendingCopyId: "pending-1",
    declarationId: "declaration-1",
    ownerPlayerId: "z-owner",
    sourceTargetInstanceId: "source-1",
    copiedShipDefId: "FIG",
    queuedTurnNumber: 4,
    materializationTurnNumber: 5,
    queueOrder: 0,
    capturedStartOfBattleCharges: 0,
    permanentConfiguration: {},
    sourceMode: "primary",
    status: "queued",
    ...overrides,
  };
}

Deno.test("Simulacrum canonical target classification accepts evolved Basics and rejects non-Basics and Cube", () => {
  for (const shipDefId of ["DEF", "OXI", "AST"]) {
    const state = createState({
      p2Snapshot: [ship(`target-${shipDefId}`, shipDefId)],
    });
    const result = resolve(state, [`target-${shipDefId}`]);
    assert.equal(
      result.state.gameData.ancient?.pendingSimulacrumCopies[0]
        .copiedShipDefId,
      shipDefId,
    );
  }

  for (const shipDefId of ["GUA", "SLIF", "CUB"]) {
    const state = createState({
      p2Snapshot: [ship(`target-${shipDefId}`, shipDefId)],
    });
    assert.throws(
      () => resolve(state, [`target-${shipDefId}`]),
      /Illegal Simulacrum target definition/,
      shipDefId,
    );
  }
});

Deno.test("Simulacrum uses opponent snapshot, exact charges, selected number, ordered costs, and strict primary uniqueness", () => {
  const snapshotQua = ship("qua-target", "QUA", {
    permanentConfiguration: { selectedNumber: 5 },
  });
  const snapshotWis = ship("wis-target", "WIS", { chargesCurrent: 0 });
  const state = createState({
    p2Ships: [
      ship("qua-target", "QUA", {
        permanentConfiguration: { selectedNumber: 2 },
      }),
      ship("wis-target", "WIS", { chargesCurrent: 2 }),
    ],
    p2Snapshot: [snapshotQua, snapshotWis],
  });
  const quaCost = getShipById("QUA")!.totalLineCost as number;
  const wisCost = getShipById("WIS")!.totalLineCost as number;
  const result = resolve(state, ["qua-target", "wis-target"]);
  const queued = result.state.gameData.ancient!.pendingSimulacrumCopies;

  assert.deepEqual(
    queued.map((record: AncientPendingSimulacrumCopy) => record.queueOrder),
    [0, 1],
  );
  assert.deepEqual(queued.map((record: AncientPendingSimulacrumCopy) =>
    record.capturedStartOfBattleCharges
  ), [
    0,
    0,
  ]);
  assert.deepEqual(queued[0].permanentConfiguration, { selectedNumber: 5 });
  assert.notEqual(
    queued[0].permanentConfiguration,
    snapshotQua.permanentConfiguration,
  );
  assert.deepEqual(result.remainingEnergy, {
    green: 0,
    red: 0,
    blue: 100 - quaCost - wisCost,
  });
  assert.deepEqual(
    result.ledgerEntries.map((entry) => entry.simulacrum?.copiedShipDefId),
    ["QUA", "WIS"],
  );

  const before = structuredClone(state);
  assert.throws(
    () => resolve(state, ["qua-target", "qua-target"]),
    /primary target already selected/,
  );
  assert.deepEqual(state, before);
});

Deno.test("later unaffordable Simulacrum leaves the input state unchanged", () => {
  const state = createState({
    p2Snapshot: [ship("def-target", "DEF"), ship("fig-target", "FIG")],
  });
  const before = structuredClone(state);
  const firstCost = getShipById("DEF")!.totalLineCost as number;
  assert.throws(
    () => resolve(state, ["def-target", "fig-target"], firstCost),
    /Insufficient blue Energy/,
  );
  assert.deepEqual(state, before);
});

Deno.test("Simulacrum aggregate quantity counts queued primary and Cube reservations without double-counting represented records", () => {
  for (const shipDefId of ["SPI", "QUA", "NEP", "ORB", "VIG"]) {
    const definition = getShipById(shipDefId)!;
    assert.equal(typeof definition.maxQuantity, "number", shipDefId);
    const maximum = definition.maxQuantity as number;
    const state = createState({
      p1Ships: Array.from({ length: maximum - 1 }, (_, index) =>
        ship(`${shipDefId}-${index}`, shipDefId)
      ),
    });
    state.gameData.ancient!.pendingSimulacrumCopies = [
      pending({
        pendingCopyId: `${shipDefId}-cube`,
        copiedShipDefId: shipDefId,
        sourceMode: "cube",
      }),
    ];
    assert.throws(
      () =>
        assertSimulacrumQuantityAvailable({
          state,
          ownerPlayerId: "z-owner",
          copiedShipDefId: shipDefId,
          proposedCount: 1,
        }),
      /maximum quantity/,
      shipDefId,
    );
  }

  const represented = createState({
    p1Ships: [ship("materialized-fig", "FIG")],
  });
  represented.gameData.ancient!.pendingSimulacrumCopies = [
    pending({
      materializedInstanceId: "materialized-fig",
      status: "queued",
    }),
  ];
  assert.doesNotThrow(() =>
    assertSimulacrumQuantityAvailable({
      state: represented,
      ownerPlayerId: "z-owner",
      copiedShipDefId: "FIG",
      proposedCount: 20,
    })
  );
});

Deno.test("Drawing materializes in active seat and numeric queue order with exact state and history", () => {
  const state = createState({
    turnNumber: 5,
    p1Ships: [
      ship("spi-1", "SPI"),
      ship("spi-2", "SPI"),
    ],
  });
  (state.gameData as any).currentPhase = "build";
  (state.gameData as any).currentSubPhase = "drawing";
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({
      pendingCopyId: "z-order-10",
      copiedShipDefId: "DEF",
      queueOrder: 10,
    }),
    pending({
      pendingCopyId: "second-seat",
      ownerPlayerId: "a-owner",
      copiedShipDefId: "FIG",
      queueOrder: 0,
    }),
    pending({
      pendingCopyId: "z-order-2",
      sourceTargetInstanceId: "source-spi",
      copiedShipDefId: "SPI",
      queueOrder: 2,
    }),
  ];

  const result = materializeQueuedSimulacrumCopiesAtDrawing(state, 5, 1234);
  const materializedEvents = result.events.filter((event) =>
    event.type === "SIMULACRUM_COPY_MATERIALIZED"
  );
  assert.deepEqual(
    materializedEvents.map((event) => event.pendingCopyId),
    ["z-order-2", "z-order-10", "second-seat"],
  );
  assert.match(materializedEvents[0].shipInstanceId, /^[0-9a-f-]{36}$/i);
  assert.equal(
    result.state.gameData.turnData?.thirdSpiralFirstStrikeEligibilityByPlayerId
      ?.["z-owner"]?.sourceInstanceId,
    materializedEvents[0].shipInstanceId,
  );
  assert.equal(
    result.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.["z-owner"],
    2,
  );
  assert.equal(
    result.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.["a-owner"],
    1,
  );
  assert.deepEqual(
    result.events.filter((event) =>
      event.type === "BATTLE_LOG_CAPTURE_BUILD_PRODUCED"
    ).map((event) => event.sourceShipDefId),
    ["SSIM", "SSIM", "SSIM"],
  );
  assert.deepEqual(state.gameData.ships?.["z-owner"].map((entry) => entry.instanceId), [
    "spi-1",
    "spi-2",
  ]);
});

Deno.test("materialization restores exact zero charges and selected number and reconciles an existing recorded ship", () => {
  const state = createState({
    turnNumber: 5,
    p1Ships: [ship("already-there", "FIG", { createdTurn: 5 })],
  });
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({
      pendingCopyId: "wis-zero",
      copiedShipDefId: "WIS",
      capturedStartOfBattleCharges: 0,
    }),
    pending({
      pendingCopyId: "qua-five",
      copiedShipDefId: "QUA",
      queueOrder: 1,
      permanentConfiguration: { selectedNumber: 5 },
    }),
    pending({
      pendingCopyId: "reconcile",
      materializedInstanceId: "already-there",
      queueOrder: 2,
    }),
  ];
  const first = materializeQueuedSimulacrumCopiesAtDrawing(state, 5, 1);
  const fleet = first.state.gameData.ships!["z-owner"];
  assert.equal(fleet.find((entry) => entry.shipDefId === "WIS")?.chargesCurrent, 0);
  assert.deepEqual(
    fleet.find((entry) => entry.shipDefId === "QUA")?.permanentConfiguration,
    { selectedNumber: 5 },
  );
  assert.equal(
    fleet.filter((entry) => entry.instanceId === "already-there").length,
    1,
  );
  const second = materializeQueuedSimulacrumCopiesAtDrawing(first.state, 5, 2);
  assert.deepEqual(second.state.gameData.ships, first.state.gameData.ships);
  assert.deepEqual(second.events, []);
});

Deno.test("over-cap Drawing corruption throws before mutation and escapes onEnterPhase", () => {
  const state = createState({
    turnNumber: 5,
    p1Ships: [
      ship("spi-1", "SPI"),
      ship("spi-2", "SPI"),
      ship("spi-3", "SPI"),
    ],
  });
  (state.gameData as any).currentPhase = "build";
  (state.gameData as any).currentSubPhase = "drawing";
  state.gameData.turnData!.currentMajorPhase = "build";
  state.gameData.turnData!.currentSubPhase = "drawing";
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({ copiedShipDefId: "SPI" }),
  ];
  const before = structuredClone(state);

  assert.throws(
    () => onEnterPhase(state, "build.ships_that_build", "build.drawing", 100),
    /materialization capacity invariant failed/,
  );
  assert.deepEqual(state, before);
});

Deno.test("Drawing projections keep public fleets viewer-invariant and expose owner-only requester copies", () => {
  const state = createState({
    turnNumber: 5,
    p1Ships: [ship("ordinary", "DEF"), ship("hidden-copy", "FIG")],
  });
  (state.gameData as any).currentPhase = "build";
  (state.gameData as any).currentSubPhase = "drawing";
  state.players.push({ id: "spectator", role: "spectator" } as any);
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({
      status: "materialized",
      materializedInstanceId: "hidden-copy",
    }),
  ];

  const publicShips = projectPublicShipsForSimulacrumDrawing(state);
  assert.deepEqual(
    publicShips["z-owner"].map((entry) => entry.instanceId),
    ["ordinary"],
  );
  assert.deepEqual(
    projectRequesterShipsForSimulacrumDrawing(state, "z-owner")["z-owner"].map(
      (entry) => entry.instanceId,
    ),
    ["ordinary", "hidden-copy"],
  );
  assert.deepEqual(
    projectRequesterShipsForSimulacrumDrawing(state, "a-owner")["z-owner"].map(
      (entry) => entry.instanceId,
    ),
    ["ordinary"],
  );
  assert.deepEqual(
    projectRequesterHiddenDrawingSimulacrumShips(state, "z-owner").map(
      (entry) => entry.instanceId,
    ),
    ["hidden-copy"],
  );
  assert.deepEqual(
    projectRequesterHiddenDrawingSimulacrumShips(state, "spectator"),
    [],
  );
});
