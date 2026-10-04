import assert from "node:assert/strict";
import { Hono } from "npm:hono";
import { registerGameRoutes } from "../../routes/game_routes.ts";
import type { CurrentTurnRouteTiming } from "../../routes/current_turn_projection_routes.ts";
import {
  replaceChargeDeclarationVisibilityState,
} from "../../engine/state/chargeDeclarationVisibility.ts";
import type {
  ConditionalWriteResult,
  GameStatePersistence,
} from "../../routes/intent_persistence.ts";

const WARMUPS = 25;
const SAMPLES = 200;

function ship(instanceId: string, shipDefId: string, extra: any = {}) {
  return { instanceId, shipDefId, createdTurn: 4, ...extra };
}

function createState(
  complex: boolean,
  phase: "drawing" | "reveal" | "charge_declaration",
) {
  const turnNumber = 8;
  const baseP1 = [
    ship("p1-def", "DEF"),
    ship("p1-fig", "FIG"),
    ship("p1-com", "COM"),
    ship("p1-fri", "FRI"),
    ship("p1-sci", "SCI"),
    ship("p1-sol", "SOL", { chargesCurrent: 1 }),
  ];
  const baseP2 = [ship("p2-def", "DEF"), ship("p2-fig", "FIG")];
  const p1Fleet = complex
    ? [
      ...baseP1,
      ...Array.from({ length: 5 }, (_, index) => ship(`xen-${index}`, "XEN")),
      ship("evo-1", "EVO"),
      ship("evo-2", "EVO"),
      ship("queen", "QUE"),
      ship("dre-1", "DRE"),
      ship("dre-2", "DRE"),
      ship("sci-2", "SCI"),
      ship("sol-0", "SOL", { chargesCurrent: 0 }),
    ]
    : baseP1;
  const p2Fleet = complex
    ? [
      ...baseP2,
      ...Array.from({ length: 4 }, (_, index) => ship(`enemy-${index}`, "FIG")),
      ship("enemy-hve", "HVE"),
      ship("enemy-dsw", "DSW"),
      ship("enemy-sol", "SOL", { chargesCurrent: 3 }),
      ship("enemy-qua", "QUA", {
        permanentConfiguration: { selectedNumber: 4 },
      }),
    ]
    : baseP2;
  return {
    gameId: `perf-${complex ? "complex" : "representative"}-${phase}`,
    status: "active",
    stateRevision: 12,
    players: [
      {
        id: "p1",
        name: "One",
        role: "player",
        faction: "xenite",
        health: 20,
        lines: 60,
        joiningLines: 30,
      },
      {
        id: "p2",
        name: "Two",
        role: "player",
        faction: "ancient",
        health: 18,
        lines: 30,
        joiningLines: 15,
      },
      { id: "spec", name: "Watcher", role: "spectator", faction: null },
    ],
    gameData: {
      turnNumber,
      currentPhase: phase === "drawing" ? "build" : "battle",
      currentSubPhase: phase,
      phaseReadiness: [],
      ships: { p1: p1Fleet, p2: p2Fleet },
      voidShipsByPlayerId: { p1: [], p2: [] },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: { "p1-fri": 4 },
        quantumMysticRevealByInstanceId:
          phase === "reveal" && complex
            ? {
              "enemy-qua": {
                battleTurnNumber: turnNumber,
                controllerPlayerId: "p2",
              },
            }
            : {},
      },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: phase !== "drawing"
          ? {
            p2: {
              battleTurnNumber: turnNumber,
              pool: { green: 3, red: 3, blue: 1 },
              sources: [],
            },
          }
          : {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber,
        currentMajorPhase: phase === "drawing" ? "build" : "battle",
        currentSubPhase: phase,
        commitments: {},
        baseDiceRoll: 4,
        diceRoll: 4,
        effectiveDiceRoll: 4,
        effectiveDiceRollByPlayerId: { p1: 4, p2: 4 },
        diceOverrideSourceByPlayerId: { p1: "main", p2: "main" },
        chronoswarmRolls: [],
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
        buildDrawingPublicSavedResourcesByPlayerId: {
          p1: { savedLines: 60, savedJoiningLines: 30 },
          p2: { savedLines: 30, savedJoiningLines: 15 },
        },
        ...(phase !== "drawing"
          ? { ancientBattleRevealPreparedTurnNumber: turnNumber }
          : {}),
      },
    },
    actions: [],
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: turnNumber - 1,
      archiveCheckpoint: null,
    },
  };
}

function summary(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    sorted[
      Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)
    ];
  return {
    samples: sorted.length,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
}

class PerfPersistence implements GameStatePersistence {
  loadSamples: number[] = [];
  constructor(readonly state: any) {}
  async load(key: string) {
    const startedAt = performance.now();
    const found = key === `game_${this.state.gameId}`;
    const result = found
      ? { status: "found" as const, value: structuredClone(this.state) }
      : { status: "missing" as const };
    this.loadSamples.push(performance.now() - startedAt);
    return result;
  }
  async conditionalUpdate(): Promise<ConditionalWriteResult> {
    throw new Error("performance fixture must stay read-only");
  }
  async insertIfMissing(): Promise<ConditionalWriteResult> {
    throw new Error("performance fixture must stay read-only");
  }
  async loadGameHead() {
    return { status: "found" as const, value: null };
  }
  async conditionalUpdateGameHead(): Promise<ConditionalWriteResult> {
    return { status: "conflict" };
  }
}

async function measure(args: {
  name: string;
  shape: string;
  state: any;
  sessionId: string;
  method: "GET" | "POST";
  path: string;
  body?: any;
  expectedEstimateCount: number;
  verifyRecoveredChargeDeclaration?: boolean;
}) {
  const persistence = new PerfPersistence(args.state);
  const authSamples: number[] = [];
  const routeTimings: CurrentTurnRouteTiming[] = [];
  const app = new Hono();
  registerGameRoutes(
    app,
    async () => undefined,
    async () => {},
    async () => {
      const startedAt = performance.now();
      const session = { sessionId: args.sessionId };
      authSamples.push(performance.now() - startedAt);
      return session;
    },
    () => "unused",
    persistence,
    (timing) => routeTimings.push(timing),
  );
  const totals: number[] = [];
  if (args.verifyRecoveredChargeDeclaration) {
    const response = await app.request(args.path, { method: args.method });
    assert.equal(response.status, 200);
    const body: any = await response.json();
    const publicEstimates = Object.values(
      body.publicState.thisTurn.estimatesByPlayerId,
    ) as any[];
    assert.equal(publicEstimates.length, 2);
    assert.equal(
      publicEstimates.every((estimate) => estimate.status === "privacy_frozen"),
      true,
    );
    assert.ok(
      body.requester.thisTurn.currentProjection.withChargeDeclaration,
    );
  }
  const run = async () => {
    const startedAt = performance.now();
    const response = await app.request(args.path, {
      method: args.method,
      ...(args.body ? { body: JSON.stringify(args.body) } : {}),
    });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    totals.push(performance.now() - startedAt);
  };
  for (let index = 0; index < WARMUPS; index++) await run();
  totals.length = 0;
  authSamples.length = 0;
  persistence.loadSamples.length = 0;
  routeTimings.length = 0;
  for (let index = 0; index < SAMPLES; index++) await run();
  assert.equal(routeTimings.length, SAMPLES);
  assert.equal(
    routeTimings.every((entry) =>
      entry.estimateCount === args.expectedEstimateCount
    ),
    true,
  );
  return {
    fixture: args.name,
    shape: args.shape,
    estimateCount: args.expectedEstimateCount,
    authAdapter: summary(authSamples),
    canonicalLoadAdapter: summary(persistence.loadSamples),
    estimator: summary(routeTimings.map((entry) => entry.estimatorMs)),
    totalRoute: summary(totals),
  };
}

Deno.test("Phase 18I in-memory route performance fixtures", async () => {
  const results: any[] = [];
  for (const complex of [false, true]) {
    const label = complex ? "complex" : "representative";
    const shape = complex
      ? "27 mixed ships with DRE/SCI/QUE/EVO/SOL and foreign effects"
      : "8 established ships with an empty eligible draft";

    const drawing: any = createState(complex, "drawing");
    results.push(
      await measure({
        name: `${label}-preview-post`,
        shape,
        state: drawing,
        sessionId: "p1",
        method: "POST",
        path: `/make-server-825e19ab/build-preview/${drawing.gameId}`,
        body: {
          observed: { turnNumber: 8, phaseKey: "build.drawing" },
          draft: { builds: [] },
        },
        expectedEstimateCount: 1,
      }),
    );

    const waiting = structuredClone(drawing);
    waiting.gameData.turnData.commitments.BUILD_8 = {
      p1: { commitHash: "stored", revealPayload: { builds: [] } },
    };
    results.push(
      await measure({
        name: `${label}-submitted-waiting-get`,
        shape,
        state: waiting,
        sessionId: "p1",
        method: "GET",
        path: `/make-server-825e19ab/game-state/${waiting.gameId}`,
        expectedEstimateCount: 1,
      }),
    );
    results.push(
      await measure({
        name: `${label}-waiting-opponent-zero-get`,
        shape,
        state: waiting,
        sessionId: "p2",
        method: "GET",
        path: `/make-server-825e19ab/game-state/${waiting.gameId}`,
        expectedEstimateCount: 0,
      }),
    );

    const reveal = createState(complex, "reveal");
    results.push(
      await measure({
        name: `${label}-revealed-player-get`,
        shape,
        state: reveal,
        sessionId: "p1",
        method: "GET",
        path: `/make-server-825e19ab/game-state/${reveal.gameId}`,
        expectedEstimateCount: 2,
      }),
    );
    results.push(
      await measure({
        name: `${label}-revealed-ancient-private-pair-get`,
        shape: `${shape}; separate requester-only Base plus With Autocast projection`,
        state: reveal,
        sessionId: "p2",
        method: "GET",
        path: `/make-server-825e19ab/game-state/${reveal.gameId}`,
        expectedEstimateCount: 3,
      }),
    );
    results.push(
      await measure({
        name: `${label}-revealed-spectator-get`,
        shape,
        state: reveal,
        sessionId: "spec",
        method: "GET",
        path: `/make-server-825e19ab/game-state/${reveal.gameId}`,
        expectedEstimateCount: 2,
      }),
    );

    if (!complex) {
      const charge: any = createState(false, "charge_declaration");
      charge.gameData.ships.p2 = [
        ship("p2-mer", "MER"),
        ship("p2-plu", "PLU"),
      ];
      charge.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
        p1: [],
        p2: [],
      };
      charge.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
        structuredClone(charge.gameData.ships);
      replaceChargeDeclarationVisibilityState(charge);
      charge.gameData.ancient.acceptedDeclarationByPlayerId.p2 = {
        schemaVersion: 1,
        contractVersion: 1,
        declarationId: "representative-accepted-solar",
        declarationFingerprint: JSON.stringify({
          contractVersion: 1,
          ordinaryChargeActions: [],
          solarCasts: [{ solarPowerId: "SLIF" }],
          autocastEnabled: true,
        }),
        playerId: "p2",
        context: {
          contextVersion: 1,
          battleTurnNumber: 8,
          initialEnergy: { green: 3, red: 3, blue: 0 },
          energySourceIds: [],
        },
        ordinaryChargeActions: [],
        solarCasts: [{ solarPowerId: "SLIF" }],
        autocastEnabled: true,
      };
      results.push(
        await measure({
          name: "representative-charge-accepted-ancient-get",
          shape:
            "two public frozen estimates plus requester-private recovered normalized Ancient declaration",
          state: charge,
          sessionId: "p2",
          method: "GET",
          path: `/make-server-825e19ab/game-state/${charge.gameId}`,
          expectedEstimateCount: 3,
          verifyRecoveredChargeDeclaration: true,
        }),
      );
    }
  }
  const privateBattleProjectionAndPairCost = ["representative", "complex"].map(
    (label) => {
      const publicOnly = results.find((entry) =>
        entry.fixture === `${label}-revealed-player-get`
      );
      const paired = results.find((entry) =>
        entry.fixture === `${label}-revealed-ancient-private-pair-get`
      );
      return {
        fixture: label,
        publicBaseEstimator: publicOnly.estimator,
        publicPlusPrivatePairEstimator: paired.estimator,
        incrementalMedianMs:
          paired.estimator.medianMs - publicOnly.estimator.medianMs,
        incrementalP95Ms:
          paired.estimator.p95Ms - publicOnly.estimator.p95Ms,
      };
    },
  );
  console.log(`CURRENT_TURN_ROUTE_PERFORMANCE ${
    JSON.stringify({
      environment: {
        adapter: "in-memory structured-clone persistence; not database latency",
        deno: Deno.version.deno,
        os: Deno.build.os,
        arch: Deno.build.arch,
        hardwareConcurrency: navigator.hardwareConcurrency,
      },
      warmupsPerFixture: WARMUPS,
      samplesPerFixture: SAMPLES,
      privateBattleProjectionAndPairCost,
      results,
    })
  }`);
});
