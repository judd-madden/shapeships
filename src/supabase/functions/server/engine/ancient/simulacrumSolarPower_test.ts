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
import { computePhaseComputedEffects } from "../../engine_shared/resolve/phaseComputedEffects.ts";

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

Deno.test("Simulacrum ledger and pending records share exact snapshot values without sharing configuration references", () => {
  const snapshotQua = ship("qua-target", "QUA", {
    permanentConfiguration: { selectedNumber: 5 },
  });
  const snapshotCarThree = ship("car-three", "CAR", { chargesCurrent: 3 });
  const snapshotCarZero = ship("car-zero", "CAR", { chargesCurrent: 0 });
  const snapshotDef = ship("def-target", "DEF");
  const state = createState({
    p2Ships: [
      ship("qua-target", "QUA", {
        permanentConfiguration: { selectedNumber: 2 },
      }),
      ship("car-three", "CAR", { chargesCurrent: 5 }),
      ship("car-zero", "CAR", { chargesCurrent: 4 }),
      ship("def-target", "DEF"),
    ],
    p2Snapshot: [
      snapshotQua,
      snapshotCarThree,
      snapshotCarZero,
      snapshotDef,
    ],
  });
  const quaCost = getShipById("QUA")!.totalLineCost as number;
  const carCost = getShipById("CAR")!.totalLineCost as number;
  const defCost = getShipById("DEF")!.totalLineCost as number;
  const result = resolve(
    state,
    ["qua-target", "car-three", "car-zero", "def-target"],
  );
  const queued = result.state.gameData.ancient!.pendingSimulacrumCopies;

  assert.deepEqual(
    queued.map((record: AncientPendingSimulacrumCopy) => record.queueOrder),
    [0, 1, 2, 3],
  );
  assert.deepEqual(queued.map((record: AncientPendingSimulacrumCopy) =>
    record.capturedStartOfBattleCharges
  ), [
    0,
    3,
    0,
    0,
  ]);
  assert.deepEqual(
    queued.map((record: AncientPendingSimulacrumCopy) =>
      record.permanentConfiguration
    ),
    [{ selectedNumber: 5 }, {}, {}, {}],
  );
  assert.deepEqual(
    result.ledgerEntries.map((entry) => entry.simulacrum),
    [
      {
        sourceTargetInstanceId: "qua-target",
        copiedShipDefId: "QUA",
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: { selectedNumber: 5 },
      },
      {
        sourceTargetInstanceId: "car-three",
        copiedShipDefId: "CAR",
        capturedStartOfBattleCharges: 3,
        permanentConfiguration: {},
      },
      {
        sourceTargetInstanceId: "car-zero",
        copiedShipDefId: "CAR",
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
      },
      {
        sourceTargetInstanceId: "def-target",
        copiedShipDefId: "DEF",
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
      },
    ],
  );
  assert.notEqual(
    queued[0].permanentConfiguration,
    snapshotQua.permanentConfiguration,
  );
  assert.notEqual(
    queued[0].permanentConfiguration,
    result.ledgerEntries[0].simulacrum?.permanentConfiguration,
  );
  assert.notEqual(
    result.ledgerEntries[0].simulacrum?.permanentConfiguration,
    snapshotQua.permanentConfiguration,
  );
  assert.deepEqual(result.remainingEnergy, {
    green: 0,
    red: 0,
    blue: 100 - quaCost - (carCost * 2) - defCost,
  });

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

Deno.test("Cube Simulacrum repeats preserve the first primary snapshot without consuming Energy or primary uniqueness", () => {
  const firstTarget = ship("qua-target", "QUA", {
    chargesCurrent: 4,
    permanentConfiguration: { selectedNumber: 5 },
  });
  const laterTarget = ship("def-target", "DEF");
  const state = createState({
    p2Snapshot: [firstTarget, laterTarget],
  });
  const primary = resolve(state, ["qua-target", "def-target"]);
  const sourceEntry = primary.ledgerEntries[0];
  const cube = resolveSolarCastSequence({
    state: primary.state,
    playerId: "z-owner",
    declarationId: "declaration-1",
    battleTurnNumber: 4,
    initialEnergy: primary.remainingEnergy,
    casts: [
      { solarPowerId: "SSIM", targetInstanceId: "qua-target" },
      { solarPowerId: "SSIM", targetInstanceId: "qua-target" },
    ],
    resolvers: { SSIM: SIMULACRUM_SOLAR_RESOLVER },
    sourceMode: "cube",
    initialLedgerOrder: 2,
  });

  assert.deepEqual(
    cube.state.gameData.ancient!.pendingSimulacrumCopies.map((
      record: AncientPendingSimulacrumCopy,
    ) => ({
      pendingCopyId: record.pendingCopyId,
      sourceTargetInstanceId: record.sourceTargetInstanceId,
      copiedShipDefId: record.copiedShipDefId,
      queueOrder: record.queueOrder,
      capturedStartOfBattleCharges: record.capturedStartOfBattleCharges,
      permanentConfiguration: record.permanentConfiguration,
      sourceMode: record.sourceMode,
    })),
    [
      {
        pendingCopyId:
          "ancient-solar:4:z-owner:declaration-1:manual:0:simulacrum-copy:primary",
        sourceTargetInstanceId: "qua-target",
        copiedShipDefId: "QUA",
        queueOrder: 0,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: { selectedNumber: 5 },
        sourceMode: "primary",
      },
      {
        pendingCopyId:
          "ancient-solar:4:z-owner:declaration-1:manual:1:simulacrum-copy:primary",
        sourceTargetInstanceId: "def-target",
        copiedShipDefId: "DEF",
        queueOrder: 1,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
        sourceMode: "primary",
      },
      {
        pendingCopyId:
          "ancient-solar:4:z-owner:declaration-1:cube:0:simulacrum-copy:cube",
        sourceTargetInstanceId: "qua-target",
        copiedShipDefId: "QUA",
        queueOrder: 2,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: { selectedNumber: 5 },
        sourceMode: "cube",
      },
      {
        pendingCopyId:
          "ancient-solar:4:z-owner:declaration-1:cube:1:simulacrum-copy:cube",
        sourceTargetInstanceId: "qua-target",
        copiedShipDefId: "QUA",
        queueOrder: 3,
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: { selectedNumber: 5 },
        sourceMode: "cube",
      },
    ],
  );
  assert.deepEqual(cube.remainingEnergy, primary.remainingEnergy);
  assert.equal(cube.ledgerEntries.every((entry) =>
    entry.sourceMode === "cube" &&
    entry.paidEnergy.green === 0 &&
    entry.paidEnergy.red === 0 &&
    entry.paidEnergy.blue === 0
  ), true);
  for (const repeat of cube.ledgerEntries) {
    assert.equal(repeat.solarPowerId, sourceEntry.solarPowerId);
    assert.deepEqual(repeat.targets, sourceEntry.targets);
    assert.deepEqual(repeat.simulacrum, sourceEntry.simulacrum);
  }
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
      materializationOutcome: {
        joiningLinesGranted: 0,
        producedShips: [],
      },
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

Deno.test("Drawing materialization preserves LEG lines while copied ZEN suppresses ANT idempotently", () => {
  const state = createState({ turnNumber: 5 });
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({
      pendingCopyId: "copy-leg",
      copiedShipDefId: "LEG",
      queueOrder: 0,
    }),
    pending({
      pendingCopyId: "copy-zen",
      copiedShipDefId: "ZEN",
      queueOrder: 1,
    }),
  ];
  const ids = ["leg-copy", "zen-copy"];
  const first = materializeQueuedSimulacrumCopiesAtDrawing(
    state,
    5,
    10,
    () => ids.shift()!,
  );
  const owner = first.state.players.find((player) => player.id === "z-owner")!;
  const fleet = first.state.gameData.ships!["z-owner"];
  assert.equal(owner.joiningLines, 4);
  assert.deepEqual(
    fleet.map((entry) => ({
      instanceId: entry.instanceId,
      shipDefId: entry.shipDefId,
      createdTurn: entry.createdTurn,
      chargesCurrent: entry.chargesCurrent,
    })),
    [
      {
        instanceId: "leg-copy",
        shipDefId: "LEG",
        createdTurn: 5,
        chargesCurrent: undefined,
      },
      {
        instanceId: "zen-copy",
        shipDefId: "ZEN",
        createdTurn: 5,
        chargesCurrent: undefined,
      },
    ],
  );
  assert.equal(
    first.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.["z-owner"],
    2,
  );
  assert.deepEqual(
    first.events.filter((event) =>
      event.type === "BATTLE_LOG_CAPTURE_BUILD_PRODUCED"
    ).map((event) => `${event.shipDefId}:${event.sourceShipDefId}`),
    ["LEG:SSIM", "ZEN:SSIM"],
  );
  const zenRecord = first.state.gameData.ancient!.pendingSimulacrumCopies.find(
    (record) => record.pendingCopyId === "copy-zen",
  )!;
  assert.deepEqual(zenRecord.materializationOutcome, {
    joiningLinesGranted: 0,
    producedShips: [],
  });

  const second = materializeQueuedSimulacrumCopiesAtDrawing(first.state, 5, 20);
  assert.deepEqual(second.state, first.state);
  assert.deepEqual(second.events, []);
});

Deno.test("Drawing projection hides only copied ZEN until Reveal", () => {
  const state = createState({ turnNumber: 5 });
  (state.gameData as any).currentPhase = "build";
  (state.gameData as any).currentSubPhase = "drawing";
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({ copiedShipDefId: "ZEN" }),
  ];
  const ids = ["zen-copy"];
  const result = materializeQueuedSimulacrumCopiesAtDrawing(
    state,
    5,
    10,
    () => ids.shift()!,
  );
  assert.deepEqual(
    projectPublicShipsForSimulacrumDrawing(result.state)["z-owner"],
    [],
  );
  assert.deepEqual(
    projectRequesterHiddenDrawingSimulacrumShips(
      result.state,
      "z-owner",
    ).map((entry) => entry.instanceId),
    ["zen-copy"],
  );
  assert.deepEqual(
    projectRequesterHiddenDrawingSimulacrumShips(
      result.state,
      "a-owner",
    ),
    [],
  );

  (result.state.gameData as any).currentPhase = "battle";
  (result.state.gameData as any).currentSubPhase = "reveal";
  assert.deepEqual(
    projectPublicShipsForSimulacrumDrawing(result.state)["z-owner"].map(
      (entry) => entry.instanceId,
    ),
    ["zen-copy"],
  );
});

Deno.test("copied ZEN requests no dependent ID and ignores a hypothetical second collision", () => {
  const state = createState({
    turnNumber: 5,
    p2Ships: [ship("occupied-dependent-id", "DEF", { createdTurn: 1 })],
  });
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({ copiedShipDefId: "ZEN" }),
  ];
  const requestedIds: string[] = [];
  const ids = ["zen-copy", "occupied-dependent-id"];
  const result = materializeQueuedSimulacrumCopiesAtDrawing(
    state,
    5,
    10,
    () => {
      const id = ids.shift()!;
      requestedIds.push(id);
      return id;
    },
  );
  assert.deepEqual(requestedIds, ["zen-copy"]);
  assert.deepEqual(
    result.state.gameData.ships!["z-owner"].map((entry) => entry.shipDefId),
    ["ZEN"],
  );
  assert.equal(
    result.state.gameData.ships!["z-owner"].some((entry) =>
      entry.shipDefId === "ANT"
    ),
    false,
  );
});

Deno.test("legacy copied-ZEN plus ANT outcomes remain completed without replay", () => {
  const createLegacyState = (status: "queued" | "materialized") => {
    const state = createState({
      turnNumber: 5,
      p1Ships: [
        ship("legacy-zen", "ZEN", { createdTurn: 5 }),
        ship("legacy-ant", "ANT", {
          createdTurn: 5,
          chargesCurrent: getShipById("ANT")?.charges ?? undefined,
        }),
      ],
    });
    state.gameData.ancient!.pendingSimulacrumCopies = [
      pending({
        copiedShipDefId: "ZEN",
        status,
        materializedInstanceId: "legacy-zen",
        materializationOutcome: {
          joiningLinesGranted: 0,
          producedShips: [{
            instanceId: "legacy-ant",
            shipDefId: "ANT",
            sourceShipDefId: "ZEN",
          }],
        },
      }),
    ];
    return state;
  };

  const completed = createLegacyState("materialized");
  const completedBefore = structuredClone(completed);
  const completedResult = materializeQueuedSimulacrumCopiesAtDrawing(
    completed,
    5,
    10,
  );
  assert.deepEqual(completedResult.state, completedBefore);
  assert.deepEqual(completedResult.events, []);

  const reconciling = createLegacyState("queued");
  const reconcilingShipsBefore = structuredClone(reconciling.gameData.ships);
  const reconcilingCountersBefore = structuredClone(
    reconciling.gameData.turnData?.shipsMadeThisTurnByPlayerId,
  );
  const reconciled = materializeQueuedSimulacrumCopiesAtDrawing(
    reconciling,
    5,
    20,
  );
  assert.equal(
    reconciled.state.gameData.ancient!.pendingSimulacrumCopies[0].status,
    "materialized",
  );
  assert.deepEqual(reconciled.state.gameData.ships, reconcilingShipsBefore);
  assert.deepEqual(
    reconciled.state.gameData.turnData?.shipsMadeThisTurnByPlayerId,
    reconcilingCountersBefore,
  );
  assert.deepEqual(reconciled.events, []);
});

Deno.test("malformed legacy copied-ZEN outcomes are rejected atomically", () => {
  const cases: Array<{
    name: string;
    producedShips: Array<{
      instanceId: string;
      shipDefId: string;
      sourceShipDefId: string;
    }>;
    antOwner?: "z-owner" | "a-owner";
    antCreatedTurn?: number;
    includeSecondAnt?: boolean;
  }> = [
    {
      name: "wrong produced definition",
      producedShips: [{
        instanceId: "legacy-ant",
        shipDefId: "DEF",
        sourceShipDefId: "ZEN",
      }],
    },
    {
      name: "wrong source definition",
      producedShips: [{
        instanceId: "legacy-ant",
        shipDefId: "ANT",
        sourceShipDefId: "FIG",
      }],
    },
    {
      name: "two produced ships",
      producedShips: [
        {
          instanceId: "legacy-ant",
          shipDefId: "ANT",
          sourceShipDefId: "ZEN",
        },
        {
          instanceId: "legacy-ant-2",
          shipDefId: "ANT",
          sourceShipDefId: "ZEN",
        },
      ],
      includeSecondAnt: true,
    },
    {
      name: "missing ANT instance",
      producedShips: [{
        instanceId: "missing-ant",
        shipDefId: "ANT",
        sourceShipDefId: "ZEN",
      }],
    },
    {
      name: "wrong ANT owner",
      producedShips: [{
        instanceId: "legacy-ant",
        shipDefId: "ANT",
        sourceShipDefId: "ZEN",
      }],
      antOwner: "a-owner",
    },
    {
      name: "wrong ANT Drawing turn",
      producedShips: [{
        instanceId: "legacy-ant",
        shipDefId: "ANT",
        sourceShipDefId: "ZEN",
      }],
      antCreatedTurn: 4,
    },
  ];

  for (const testCase of cases) {
    const ant = ship("legacy-ant", "ANT", {
      createdTurn: testCase.antCreatedTurn ?? 5,
      chargesCurrent: getShipById("ANT")?.charges ?? undefined,
    });
    const ownerShips = [
      ship("legacy-zen", "ZEN", { createdTurn: 5 }),
      ...(testCase.antOwner === "a-owner" ? [] : [ant]),
      ...(testCase.includeSecondAnt
        ? [ship("legacy-ant-2", "ANT", { createdTurn: 5 })]
        : []),
    ];
    const opponentShips = testCase.antOwner === "a-owner" ? [ant] : [];
    const state = createState({
      turnNumber: 5,
      p1Ships: ownerShips,
      p2Ships: opponentShips,
    });
    state.gameData.ancient!.pendingSimulacrumCopies = [
      pending({
        copiedShipDefId: "ZEN",
        status: "materialized",
        materializedInstanceId: "legacy-zen",
        materializationOutcome: {
          joiningLinesGranted: 0,
          producedShips: testCase.producedShips,
        },
      }),
    ];
    const before = structuredClone(state);
    assert.throws(
      () => materializeQueuedSimulacrumCopiesAtDrawing(state, 5, 10),
      /Simulacrum/,
      testCase.name,
    );
    assert.deepEqual(state, before, testCase.name);
  }
});

Deno.test("build.drawing snapshots public resources before copied LEG grants authoritative lines", () => {
  const state = createState({ turnNumber: 5 });
  (state.gameData as any).currentPhase = "build";
  (state.gameData as any).currentSubPhase = "ships_that_build";
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({ copiedShipDefId: "LEG" }),
  ];
  const entered = onEnterPhase(
    state,
    "build.ships_that_build",
    "build.drawing",
    100,
  );
  assert.equal(
    entered.state.players.find((player: any) => player.id === "z-owner")
      .joiningLines,
    4,
  );
  assert.deepEqual(
    entered.state.gameData.turnData.buildDrawingPublicSavedResourcesByPlayerId[
      "z-owner"
    ],
    { savedLines: 0, savedJoiningLines: 0 },
  );
});

Deno.test("copied once-only ships resolve through existing built-turn memory exactly once", () => {
  const state = createState({ turnNumber: 5 });
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({ pendingCopyId: "copy-ang", copiedShipDefId: "ANG" }),
    pending({
      pendingCopyId: "copy-fea",
      copiedShipDefId: "FEA",
      queueOrder: 1,
    }),
  ];
  const ids = ["copied-ang", "copied-fea"];
  const materialized = materializeQueuedSimulacrumCopiesAtDrawing(
    state,
    5,
    10,
    () => ids.shift()!,
  ).state;
  const ang = materialized.gameData.ships!["z-owner"].find((entry) =>
    entry.shipDefId === "ANG"
  )!;
  materialized.gameData.ships!["z-owner"] = materialized.gameData.ships![
    "z-owner"
  ].filter((entry) => entry.instanceId !== ang.instanceId);
  materialized.gameData.voidShipsByPlayerId = { "z-owner": [ang] };

  const first = computePhaseComputedEffects(
    materialized,
    "battle.end_of_turn_resolution",
  );
  assert.deepEqual(
    first.effects.filter((effect) =>
      (effect.source as any).shipDefId === "ANG" ||
      (effect.source as any).shipDefId === "FEA"
    ).map((effect) => [
      (effect.source as any).shipDefId,
      effect.kind,
      (effect as any).amount,
    ]),
    [
      ["FEA", "Heal", 3],
      ["ANG", "Damage", 3],
    ],
  );
  const second = computePhaseComputedEffects(
    first.state,
    "battle.end_of_turn_resolution",
  );
  assert.deepEqual(
    second.effects.filter((effect) =>
      (effect.source as any).shipDefId === "ANG" ||
      (effect.source as any).shipDefId === "FEA"
    ),
    [],
  );
});

Deno.test("materialization does not replay completed Ships That Build powers", () => {
  const state = createState({ turnNumber: 5 });
  state.gameData.ancient!.pendingSimulacrumCopies = [
    pending({ pendingCopyId: "copy-car", copiedShipDefId: "CAR" }),
    pending({
      pendingCopyId: "copy-bug",
      copiedShipDefId: "BUG",
      queueOrder: 1,
    }),
    pending({
      pendingCopyId: "copy-evo",
      copiedShipDefId: "EVO",
      queueOrder: 2,
    }),
  ];
  const ids = ["copy-car-id", "copy-bug-id", "copy-evo-id"];
  const result = materializeQueuedSimulacrumCopiesAtDrawing(
    state,
    5,
    10,
    () => ids.shift()!,
  );
  assert.deepEqual(
    result.state.gameData.ships!["z-owner"].map((entry) => entry.shipDefId),
    ["CAR", "BUG", "EVO"],
  );
  assert.equal(
    result.events.filter((event) =>
      event.type === "BATTLE_LOG_CAPTURE_BUILD_PRODUCED"
    ).length,
    3,
  );
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
