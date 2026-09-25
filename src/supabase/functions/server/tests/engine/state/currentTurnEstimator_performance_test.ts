import assert from "node:assert/strict";
import type { BuildSubmitPayload } from "../../../engine/intent/IntentTypes.ts";
import { estimateCurrentTurnForPlayer } from "../../../engine/state/currentTurnEstimator.ts";
import type {
  GameState,
  ShipInstance,
} from "../../../engine/state/GameStateTypes.ts";

const WARMUP_SAMPLES = 25;
const MEASURED_SAMPLES = 200;

function ship(
  instanceId: string,
  shipDefId: string,
  extra: Partial<ShipInstance> = {},
): ShipInstance {
  return { instanceId, shipDefId, createdTurn: 7, ...extra };
}

function createDrawingFixture(args: {
  gameId: string;
  faction: string;
  p1Fleet: ShipInstance[];
  p2Fleet: ShipInstance[];
  lines?: number;
  joiningLines?: number;
  turnData?: Record<string, unknown>;
}): GameState {
  const turnNumber = 8;
  return {
    gameId: args.gameId,
    status: "active",
    players: [
      {
        id: "p1",
        role: "player",
        faction: args.faction,
        health: 19,
        lines: args.lines ?? 30,
        joiningLines: args.joiningLines ?? 20,
      },
      {
        id: "p2",
        role: "player",
        faction: "ancient",
        health: 16,
        lines: 12,
        joiningLines: 8,
      },
    ],
    gameData: {
      turnNumber,
      currentPhase: "build",
      currentSubPhase: "drawing",
      ships: {
        p1: structuredClone(args.p1Fleet),
        p2: structuredClone(args.p2Fleet),
      },
      voidShipsByPlayerId: { p1: [], p2: [] },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: { "p1-fri": 4 },
        quantumMysticRevealByInstanceId: {},
      },
      turnData: {
        turnNumber,
        currentMajorPhase: "build",
        currentSubPhase: "drawing",
        effectiveDiceRollByPlayerId: { p1: 4, p2: 3 },
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
          p1: structuredClone(args.p1Fleet),
          p2: structuredClone(args.p2Fleet),
        },
        ...args.turnData,
      },
    } as any,
  };
}

type PerformanceFixture = {
  name: string;
  shape: string;
  state: GameState;
  draft: BuildSubmitPayload;
};

function runFixture(fixture: PerformanceFixture) {
  const runOnce = () => {
    const result = estimateCurrentTurnForPlayer({
      state: fixture.state,
      requestingParticipantId: "p1",
      playerId: "p1",
      draft: fixture.draft,
    });
    assert.notEqual(result.status, "unavailable");
  };

  for (let index = 0; index < WARMUP_SAMPLES; index += 1) runOnce();

  const samples: number[] = [];
  for (let index = 0; index < MEASURED_SAMPLES; index += 1) {
    const startedAt = performance.now();
    runOnce();
    samples.push(performance.now() - startedAt);
  }
  samples.sort((left, right) => left - right);
  const percentile = (value: number) =>
    samples[
      Math.min(samples.length - 1, Math.ceil(value * samples.length) - 1)
    ];
  return {
    fixture: fixture.name,
    shape: fixture.shape,
    samples: MEASURED_SAMPLES,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    minMs: samples[0],
    maxMs: samples.at(-1),
  };
}

Deno.test("current-turn estimator explicit 200-sample performance fixtures", () => {
  const fixtures: PerformanceFixture[] = [
    {
      name: "empty-established",
      shape: "8 established ships, empty eligible draft",
      state: createDrawingFixture({
        gameId: "perf-empty",
        faction: "human",
        p1Fleet: [
          ship("p1-def-1", "DEF"),
          ship("p1-def-2", "DEF"),
          ship("p1-fig-1", "FIG"),
          ship("p1-fig-2", "FIG"),
          ship("p1-com", "COM"),
          ship("p1-fri", "FRI"),
          ship("p1-sci", "SCI"),
          ship("p1-sol", "SOL", { chargesCurrent: 1 }),
        ],
        p2Fleet: [ship("p2-def", "DEF"), ship("p2-fig", "FIG")],
      }),
      draft: { builds: [] },
    },
    {
      name: "four-species-midgame",
      shape:
        "14 mixed native/foreign ships spanning Human, Xenite, Centaur, Ancient",
      state: createDrawingFixture({
        gameId: "perf-midgame",
        faction: "ancient",
        p1Fleet: [
          ship("p1-plu", "PLU"),
          ship("p1-mer", "MER"),
          ship("p1-nep", "NEP"),
          ship("p1-sol-1", "SOL", { chargesCurrent: 1 }),
          ship("p1-sol-4", "SOL", { chargesCurrent: 4 }),
          ship("p1-qua", "QUA", {
            permanentConfiguration: { selectedNumber: 4 },
          }),
          ship("p1-def", "DEF"),
          ship("p1-fig", "FIG"),
          ship("p1-xen", "XEN"),
          ship("p1-fea", "FEA"),
        ],
        p2Fleet: [
          ship("p2-dre", "DRE"),
          ship("p2-xen", "XEN"),
          ship("p2-fea", "FEA"),
          ship("p2-sol", "SOL", { chargesCurrent: 2 }),
        ],
      }),
      draft: { builds: [{ shipDefId: "PLU", count: 1 }] },
    },
    {
      name: "complex-late-game",
      shape:
        "28 mixed/foreign ships, multiple DRE/SCI/QUE/EVO/SOL and multi-build draft",
      state: createDrawingFixture({
        gameId: "perf-complex",
        faction: "xenite",
        lines: 60,
        joiningLines: 30,
        p1Fleet: [
          ...Array.from(
            { length: 5 },
            (_, index) => ship(`xen-${index}`, "XEN"),
          ),
          ship("evo-1", "EVO"),
          ship("evo-2", "EVO"),
          ship("queen-1", "QUE"),
          ship("dre-1", "DRE"),
          ship("dre-2", "DRE"),
          ship("sci-1", "SCI"),
          ship("sci-2", "SCI"),
          ship("sci-3", "SCI"),
          ship("sol-0", "SOL", { chargesCurrent: 0 }),
          ship("sol-1", "SOL", { chargesCurrent: 1 }),
          ship("fri-foreign", "FRI"),
          ship("ent-foreign", "ENT"),
          ship("cub-foreign", "CUB"),
        ],
        p2Fleet: [
          ...Array.from(
            { length: 4 },
            (_, index) => ship(`enemy-fig-${index}`, "FIG"),
          ),
          ship("enemy-hive", "HVE"),
          ship("enemy-dsw", "DSW"),
          ship("enemy-ark", "TER"),
          ship("enemy-sol", "SOL", { chargesCurrent: 3 }),
          ship("enemy-qua", "QUA", {
            permanentConfiguration: { selectedNumber: 3 },
          }),
          ship("enemy-tac", "TAC"),
        ],
        turnData: {
          shipsMadeThisTurnByPlayerId: { p1: 2 },
          queenCreatedXenitesThisTurnByPlayerId: { p1: 1 },
        },
      }),
      draft: {
        builds: [
          { shipDefId: "XEN", count: 3 },
          { shipDefId: "ANT", count: 2 },
          { shipDefId: "ZEN", count: 1 },
        ],
        evolverChoices: [
          { sourceKey: "evo-1", choiceId: "oxite" },
          { sourceKey: "evo-2", choiceId: "asterite" },
        ],
      },
    },
  ];

  const report = {
    environment: {
      deno: Deno.version.deno,
      os: Deno.build.os,
      arch: Deno.build.arch,
      hardwareConcurrency: navigator.hardwareConcurrency,
    },
    warmupsPerFixture: WARMUP_SAMPLES,
    results: fixtures.map(runFixture),
  };
  console.log(`CURRENT_TURN_ESTIMATOR_PERFORMANCE ${JSON.stringify(report)}`);
});
