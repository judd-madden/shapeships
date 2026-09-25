import assert from "node:assert/strict";
import { Hono } from "npm:hono";
import { registerGameRoutes } from "../../routes/game_routes.ts";
import {
  projectCurrentTurnFieldsForFullState,
} from "../../routes/current_turn_projection_routes.ts";
import { replaceChargeDeclarationVisibilityState } from "../../engine/state/chargeDeclarationVisibility.ts";
import type {
  ConditionalWriteResult,
  GameStatePersistence,
} from "../../routes/intent_persistence.ts";

function ship(instanceId: string, shipDefId: string, extra: any = {}) {
  return { instanceId, shipDefId, createdTurn: 1, ...extra };
}

function createState(phase = "build.drawing") {
  const [major, sub] = phase.split(".");
  const turnNumber = 5;
  const p1Fleet = [ship("p1-def", "DEF")];
  const p2Fleet = [ship("p2-fig", "FIG")];
  return {
    gameId: "phase-18c-route",
    status: "active",
    stateRevision: 7,
    players: [
      {
        id: "p1",
        name: "One",
        role: "player",
        faction: "human",
        health: 25,
        lines: 20,
        joiningLines: 10,
      },
      {
        id: "p2",
        name: "Two",
        role: "player",
        faction: "centaur",
        health: 25,
        lines: 20,
        joiningLines: 10,
      },
      { id: "spec", name: "Watcher", role: "spectator", faction: null },
    ],
    gameData: {
      turnNumber,
      currentPhase: major,
      currentSubPhase: sub,
      phaseReadiness: [],
      ships: { p1: p1Fleet, p2: p2Fleet },
      voidShipsByPlayerId: { p1: [], p2: [] },
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
        currentMajorPhase: major,
        currentSubPhase: sub,
        commitments: {},
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
          p1: { savedLines: 20, savedJoiningLines: 10 },
          p2: { savedLines: 20, savedJoiningLines: 10 },
        },
      },
    },
    actions: [],
    battleLogScratch: {
      currentTurnCapture: {
        turnNumber,
        diceValue: 4,
        buildAtomsByPlayerId: {
          p1: [
            { kind: "reroll", sourceShipDefId: "KNO", values: [4] },
            {
              kind: "produced_build",
              shipDefId: "FIG",
              sourceShipDefId: "DRE",
              count: 1,
            },
          ],
          p2: [],
        },
        battleAtomsByPlayerId: { p1: [], p2: [] },
        savedResourcesByPlayerId: {},
      },
      lastFinalizedTurnNumber: 4,
      archiveCheckpoint: null,
    },
  };
}

class TrackingPersistence implements GameStatePersistence {
  readonly store = new Map<string, any>();
  loads = 0;
  writes = 0;
  headWrites = 0;

  async load(key: string) {
    this.loads++;
    return this.store.has(key)
      ? {
        status: "found" as const,
        value: structuredClone(this.store.get(key)),
      }
      : { status: "missing" as const };
  }
  async conditionalUpdate(): Promise<ConditionalWriteResult> {
    this.writes++;
    return { status: "conflict" };
  }
  async insertIfMissing(): Promise<ConditionalWriteResult> {
    this.writes++;
    return { status: "conflict" };
  }
  async loadGameHead(key: string) {
    return this.store.has(key)
      ? { status: "found" as const, value: null }
      : { status: "missing" as const };
  }
  async conditionalUpdateGameHead(): Promise<ConditionalWriteResult> {
    this.headWrites++;
    return { status: "conflict" };
  }
}

function fixture(initial = createState()) {
  const persistence = new TrackingPersistence();
  const key = `game_${initial.gameId}`;
  persistence.store.set(key, structuredClone(initial));
  let sessionId = "p1";
  let kvWrites = 0;
  const app = new Hono();
  registerGameRoutes(
    app,
    async (sideKey) => structuredClone(persistence.store.get(sideKey)),
    async () => {
      kvWrites++;
    },
    async () => ({ sessionId }),
    () => "unused",
    persistence,
  );
  return {
    app,
    key,
    persistence,
    get kvWrites() {
      return kvWrites;
    },
    setSession(id: string) {
      sessionId = id;
    },
  };
}

function previewRequest(
  app: Hono,
  gameId: string,
  body: any,
) {
  return app.request(
    `/make-server-825e19ab/build-preview/${gameId}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

async function fullStateBody(state: any, viewer = "p1") {
  const test = fixture(state);
  test.setSession(viewer);
  const response = await test.app.request(
    `/make-server-825e19ab/game-state/${state.gameId}`,
  );
  assert.equal(response.status, 200);
  return await response.json();
}

type FullStateViewer = "p1" | "p2" | "spec";

function hiddenPlayerIdsFor(viewer: FullStateViewer): Array<"p1" | "p2"> {
  return viewer === "spec" ? ["p1", "p2"] : [viewer === "p1" ? "p2" : "p1"];
}

function createDrawingNoninterferencePair(viewer: FullStateViewer) {
  const left: any = createState();
  left.gameData.turnData.commitments.BUILD_5 = {
    p1: {
      commitHash: "p1-left-hash",
      revealPayload: {
        builds: [{ shipDefId: "DEF", count: 1 }],
      },
      committedAt: 100,
      revealedAt: 101,
    },
    p2: {
      commitHash: "p2-left-hash",
      revealPayload: {
        builds: [{ shipDefId: "FIG", count: 1 }],
      },
      committedAt: 100,
      revealedAt: 101,
    },
  };
  left.battleLogScratch.currentTurnCapture.buildAtomsByPlayerId.p2 = [{
    kind: "produced_build",
    shipDefId: "DEF",
    sourceShipDefId: "DRE",
    count: 1,
  }];

  const right = structuredClone(left);
  right.stateRevision = 107;
  for (const hiddenPlayerId of hiddenPlayerIdsFor(viewer)) {
    const hiddenShipId = `${hiddenPlayerId}-hidden-fri`;
    right.gameData.ships[hiddenPlayerId] = [
      ...right.gameData.ships[hiddenPlayerId],
      ship(hiddenShipId, "FRI", {
        permanentConfiguration: { selectedNumber: 6 },
      }),
    ];
    right.gameData.turnData.commitments.BUILD_5[hiddenPlayerId] = {
      commitHash: `${hiddenPlayerId}-right-hash`,
      revealPayload: {
        builds: [{ shipDefId: "FRI", count: 1 }],
        frigateTriggers: [6],
      },
      committedAt: 100,
      revealedAt: 101,
    };
    const publicInterventionAtoms = right.battleLogScratch.currentTurnCapture
      .buildAtomsByPlayerId[hiddenPlayerId].filter((atom: any) =>
        atom.kind === "reroll" || atom.kind === "cube_change"
      );
    right.battleLogScratch.currentTurnCapture.buildAtomsByPlayerId[
      hiddenPlayerId
    ] = [
      ...publicInterventionAtoms,
      {
        kind: "produced_build",
        shipDefId: "FRI",
        sourceShipDefId: "DRE",
        count: 2,
      },
    ];
  }
  return { left, right };
}

function createFirstStrikeNoninterferencePair(viewer: FullStateViewer) {
  const left: any = createState("battle.first_strike");
  left.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId = {
    p1: { "p1-source": { targetShipInstanceIds: ["p2-fig"] } },
    p2: { "p2-source": { targetShipInstanceIds: ["p1-def"] } },
  };
  const right = structuredClone(left);
  right.stateRevision = 108;
  for (const hiddenPlayerId of hiddenPlayerIdsFor(viewer)) {
    right.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId[
      hiddenPlayerId
    ] = {
      [`${hiddenPlayerId}-alternate-source`]: {
        targetShipInstanceIds: [
          hiddenPlayerId === "p1" ? "p2-fig" : "p1-def",
        ],
      },
    };
  }
  return { left, right };
}

function createChargeNoninterferencePair(viewer: FullStateViewer) {
  const left: any = createState("battle.charge_declaration");
  left.gameData.ships.p1.push(ship("p1-sol", "SOL", { chargesCurrent: 1 }));
  left.gameData.ships.p2.push(ship("p2-sol", "SOL", { chargesCurrent: 1 }));
  left.gameData.turnData.turnPhaseProgress = {
    turnNumber: 5,
    firstStrike: { expected: false, occurred: false },
    charges: { expected: true, occurred: true },
  };
  left.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(left.gameData.ships);
  left.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
    p1: ["p1-sol"],
    p2: ["p2-sol"],
  };
  left.gameData.turnData.chargePowerUsedByInstanceId = {};
  left.gameData.turnData.pendingChargeDeclarations = {
    p1: [{ sourceInstanceId: "p1-sol", choiceId: "hold" }],
    p2: [{ sourceInstanceId: "p2-sol", choiceId: "hold" }],
  };
  replaceChargeDeclarationVisibilityState(left);

  const right = structuredClone(left);
  right.stateRevision = 109;
  for (const hiddenPlayerId of hiddenPlayerIdsFor(viewer)) {
    const solarId = `${hiddenPlayerId}-sol`;
    right.gameData.turnData.pendingChargeDeclarations[hiddenPlayerId] = [{
      sourceInstanceId: solarId,
      choiceId: "heal",
    }];
    right.gameData.turnData.chargeDeclarationAcknowledgements
      .chargeAfterByPlayerId[hiddenPlayerId] = { [solarId]: 0 };
    right.gameData.ships[hiddenPlayerId].find((candidate: any) =>
      candidate.instanceId === solarId
    ).chargesCurrent = 0;
    right.gameData.ancient.solarLedgerByPlayerId[hiddenPlayerId] = {
      battleTurnNumber: 5,
      entries: [{
        sourceInstanceId: solarId,
        choiceId: "heal",
        chargeBefore: 1,
        chargeAfter: 0,
      }],
    };
  }
  return { left, right };
}

async function assertCompleteFullStateNoninterference(args: {
  label: string;
  viewer: FullStateViewer;
  left: any;
  right: any;
}) {
  const leftBody = await fullStateBody(args.left, args.viewer);
  const rightBody = await fullStateBody(args.right, args.viewer);
  assert.notEqual(leftBody.stateRevision, rightBody.stateRevision, args.label);

  assert.deepEqual(
    rightBody.publicState.thisTurn.identity,
    leftBody.publicState.thisTurn.identity,
    `${args.label}: Phase 18 identity`,
  );
  assert.deepEqual(
    rightBody.publicState.thisTurn.estimatesByPlayerId,
    leftBody.publicState.thisTurn.estimatesByPlayerId,
    `${args.label}: estimate status, availability, totals, and rows`,
  );
  assert.deepEqual(
    rightBody.publicState.thisTurn.battleLog,
    leftBody.publicState.thisTurn.battleLog,
    `${args.label}: live row shape and order`,
  );
  assert.deepEqual(
    rightBody.requester.thisTurn,
    leftBody.requester.thisTurn,
    `${args.label}: requester fields`,
  );

  const leftComparable = structuredClone(leftBody);
  const rightComparable = structuredClone(rightBody);
  delete leftComparable.stateRevision;
  delete rightComparable.stateRevision;
  assert.deepEqual(
    rightComparable,
    leftComparable,
    `${args.label}: complete sanitized response excluding root stateRevision`,
  );
}

Deno.test("preview accepts empty drafts, ignores hidden revisions, and supports stale-context retry", async () => {
  const base = createState();
  const test = fixture(base);
  const request = {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
    requestToken: "empty-1",
  };
  const before = structuredClone(test.persistence.store.get(test.key));
  const first = await previewRequest(test.app, base.gameId, request);
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.status, "estimated");
  assert.equal(firstBody.requestToken, "empty-1");
  assert.equal("stateRevision" in firstBody.identity, false);
  assert.equal(test.persistence.loads, 1);
  assert.equal(test.persistence.writes, 0);
  assert.equal(test.persistence.headWrites, 0);
  assert.equal(test.kvWrites, 0);
  assert.deepEqual(test.persistence.store.get(test.key), before);

  const hiddenRevision = structuredClone(before);
  hiddenRevision.stateRevision = 8;
  hiddenRevision.gameData.turnData.commitments.BUILD_5 = {
    p2: {
      commitHash: "hidden",
      revealPayload: { builds: [{ shipDefId: "FIG", count: 1 }] },
    },
  };
  test.persistence.store.set(test.key, hiddenRevision);
  const hiddenOnly = await previewRequest(test.app, base.gameId, {
    ...request,
    observed: {
      ...request.observed,
      sourceContextKey: firstBody.identity.sourceContextKey,
    },
  });
  const hiddenOnlyBody = await hiddenOnly.json();
  assert.equal(hiddenOnly.status, 200);
  assert.equal(
    hiddenOnlyBody.identity.sourceContextKey,
    firstBody.identity.sourceContextKey,
  );

  const publicChange = structuredClone(hiddenRevision);
  publicChange.gameData.turnData.effectiveDiceRollByPlayerId.p1 = 5;
  test.persistence.store.set(test.key, publicChange);
  const obsolete = await previewRequest(test.app, base.gameId, {
    ...request,
    observed: {
      ...request.observed,
      sourceContextKey: firstBody.identity.sourceContextKey,
    },
  });
  const obsoleteBody = await obsolete.json();
  assert.equal(obsolete.status, 409);
  assert.equal(obsoleteBody.reason, "source_context_changed");
  assert.equal(obsoleteBody.retry.allowed, true);

  const retry = await previewRequest(test.app, base.gameId, {
    ...request,
    observed: {
      ...request.observed,
      sourceContextKey: obsoleteBody.retry.sourceContextKey,
    },
  });
  assert.equal(retry.status, 200);
});

Deno.test("submitted player recovers a frozen projection only through full GET", async () => {
  const state: any = createState();
  state.gameData.turnData.commitments.BUILD_5 = {
    p1: {
      commitHash: "own-hash",
      revealPayload: { builds: [{ shipDefId: "FIG", count: 1 }] },
    },
  };
  const test = fixture(state);
  const post = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [{ shipDefId: "DEF", count: 1 }] },
  });
  assert.equal(post.status, 409);
  assert.equal((await post.json()).reason, "already_submitted");

  const p1 = await test.app.request(
    `/make-server-825e19ab/game-state/${state.gameId}`,
  );
  const p1Body = await p1.json();
  assert.equal(p1.status, 200);
  assert.equal(
    p1Body.requester.thisTurn.committedProjection.status,
    "estimated",
  );
  assert.equal(
    p1Body.requester.thisTurn.committedProjection.build.lines.includes(
      "1 x FIG",
    ),
    true,
  );
  assert.equal(p1Body.publicState.thisTurn.estimatesByPlayerId, null);
  assert.equal("stateRevision" in p1Body.publicState.thisTurn.identity, false);
  assert.equal(
    JSON.stringify(p1Body.gameData).includes("committedProjection"),
    false,
  );

  test.setSession("p2");
  const p2Body = await (await test.app.request(
    `/make-server-825e19ab/game-state/${state.gameId}`,
  )).json();
  assert.equal(p2Body.requester.thisTurn.committedProjection, null);
  test.setSession("spec");
  const spectatorBody = await (await test.app.request(
    `/make-server-825e19ab/game-state/${state.gameId}`,
  )).json();
  assert.equal(spectatorBody.requester.thisTurn, null);
  assert.equal(JSON.stringify(spectatorBody).includes("1 x FIG"), false);
});

Deno.test("Charge projection ignores canonical revision and hidden declaration differences", () => {
  const left: any = createState("battle.charge_declaration");
  left.gameData.turnData.turnPhaseProgress = {
    turnNumber: 5,
    firstStrike: { expected: false, occurred: false },
    charges: { expected: true, occurred: true },
  };
  left.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(left.gameData.ships);
  replaceChargeDeclarationVisibilityState(left);
  const right = structuredClone(left);
  right.stateRevision = 99;
  right.gameData.turnData.pendingChargeDeclarations = {
    p2: [{ sourceInstanceId: "hidden", choiceId: "damage" }],
  };
  right.gameData.ships.p2[0].chargesCurrent = 0;
  const leftProjection = projectCurrentTurnFieldsForFullState({
    state: left,
    requestingParticipantId: "spec",
  });
  const rightProjection = projectCurrentTurnFieldsForFullState({
    state: right,
    requestingParticipantId: "spec",
  });
  assert.deepEqual(rightProjection, leftProjection);
  assert.ok(leftProjection.publicThisTurn?.estimatesByPlayerId);
  assert.deepEqual(
    Object.values(leftProjection.publicThisTurn.estimatesByPlayerId).map(
      (estimate: any) => estimate.status,
    ),
    ["privacy_frozen", "privacy_frozen"],
  );
  assert.equal(
    JSON.stringify(leftProjection).includes("stateRevision"),
    false,
  );
});

Deno.test("complete full GET responses ignore viewer-hidden Drawing, First Strike, and Charge data", async () => {
  for (const viewer of ["p1", "p2", "spec"] as const) {
    for (
      const [phase, createPair] of [
        ["Drawing", createDrawingNoninterferencePair],
        ["pending First Strike", createFirstStrikeNoninterferencePair],
        ["Charge Declaration", createChargeNoninterferencePair],
      ] as const
    ) {
      const { left, right } = createPair(viewer);
      await assertCompleteFullStateNoninterference({
        label: `${phase}/${viewer}`,
        viewer,
        left,
        right,
      });
    }
  }
});

Deno.test("Reveal is two-sided for players and spectators while later hidden barriers are noninterfering", async () => {
  const reveal: any = createState("battle.reveal");
  const revealFixture = fixture(reveal);
  const publicViews: any[] = [];
  for (const viewer of ["p1", "p2", "spec"]) {
    revealFixture.setSession(viewer);
    const response = await revealFixture.app.request(
      `/make-server-825e19ab/game-state/${reveal.gameId}`,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      Object.keys(body.publicState.thisTurn.estimatesByPlayerId),
      [
        "p1",
        "p2",
      ],
    );
    assert.deepEqual(
      body.publicState.thisTurn.battleLog.concealedBuildPlayerIds,
      [],
    );
    assert.equal(body.requester.thisTurn, null);
    publicViews.push(body.publicState.thisTurn);
  }
  assert.deepEqual(publicViews[1], publicViews[0]);
  assert.deepEqual(publicViews[2], publicViews[0]);

  const firstStrikeLeft: any = createState("battle.first_strike");
  const firstStrikeRight = structuredClone(firstStrikeLeft);
  firstStrikeRight.stateRevision = 55;
  firstStrikeRight.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId = {
    p2: { "secret-source": { targetShipInstanceIds: ["p1-def"] } },
  };
  assert.deepEqual(
    projectCurrentTurnFieldsForFullState({
      state: firstStrikeRight,
      requestingParticipantId: "p1",
    }),
    projectCurrentTurnFieldsForFullState({
      state: firstStrikeLeft,
      requestingParticipantId: "p1",
    }),
  );

  const resolution: any = createState("battle.end_of_turn_resolution");
  const resolutionProjection = projectCurrentTurnFieldsForFullState({
    state: resolution,
    requestingParticipantId: "p1",
  });
  assert.ok(resolutionProjection.publicThisTurn);
  assert.equal(resolutionProjection.publicThisTurn.estimatesByPlayerId, null);
  resolution.status = "finished";
  assert.deepEqual(
    projectCurrentTurnFieldsForFullState({
      state: resolution,
      requestingParticipantId: "p1",
    }),
    { publicThisTurn: null, requesterThisTurn: null },
  );
});

Deno.test("preview bounds, roles, and expired clocks fail without persistence", async () => {
  const state: any = createState();
  const test = fixture(state);
  const tooMany = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: {
      builds: Array.from(
        { length: 65 },
        () => ({ shipDefId: "DEF", count: 1 }),
      ),
    },
  });
  assert.equal(tooMany.status, 400);
  assert.equal((await tooMany.json()).reason, "preview_bounds_exceeded");

  test.setSession("spec");
  const spectator = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(spectator.status, 403);

  test.setSession("p1");
  state.gameData.clock = {
    timeControl: { baseMs: 1_000, incrementMs: 0 },
    remainingMsByPlayerId: { p1: 1, p2: 1_000 },
    lastUpdateAtMs: 0,
  };
  test.persistence.store.set(test.key, structuredClone(state));
  const before = structuredClone(test.persistence.store.get(test.key));
  const expired = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(expired.status, 409);
  assert.equal((await expired.json()).reason, "game_unavailable");
  assert.equal(test.persistence.writes, 0);
  assert.equal(test.persistence.headWrites, 0);
  assert.equal(test.kvWrites, 0);
  assert.deepEqual(test.persistence.store.get(test.key), before);
});

Deno.test("preview rejects authority fields, missing Quantum choices, incomplete preludes, and phase races safely", async () => {
  const state: any = createState();
  const test = fixture(state);
  const authorityField = await previewRequest(test.app, state.gameId, {
    playerId: "p2",
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(authorityField.status, 400);
  assert.equal(test.persistence.loads, 0);

  const missingQuantumChoice = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [{ shipDefId: "QUA", count: 1 }] },
  });
  assert.equal(missingQuantumChoice.status, 400);
  assert.equal((await missingQuantumChoice.json()).reason, "invalid_payload");

  const incomplete = structuredClone(state);
  incomplete.gameData.turnData.drawingPreludeByPlayerId.p1.status = "awaiting";
  test.persistence.store.set(test.key, incomplete);
  const incompleteResponse = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(incompleteResponse.status, 409);
  assert.equal(
    (await incompleteResponse.json()).reason,
    "drawing_prelude_incomplete",
  );

  const reveal = createState("battle.reveal");
  test.persistence.store.set(test.key, reveal);
  const raced = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(raced.status, 409);
  const racedBody = await raced.json();
  assert.equal(racedBody.reason, "turn_or_phase_changed");
  assert.equal(racedBody.retry.allowed, false);
});

Deno.test("head and history responses remain Phase 18-free", async () => {
  const state: any = createState();
  state.gameData.turnData.commitments.BUILD_5 = {
    p1: {
      commitHash: "own-hash",
      revealPayload: { builds: [{ shipDefId: "FIG", count: 1 }] },
    },
  };
  const test = fixture(state);
  const head = await test.app.request(
    `/make-server-825e19ab/game-state-head/${state.gameId}`,
  );
  assert.equal(head.status, 200);
  const headText = await head.text();
  assert.equal(headText.includes("thisTurn"), false);
  assert.equal(headText.includes("committedProjection"), false);

  const history = await test.app.request(
    `/make-server-825e19ab/game-history/${state.gameId}`,
  );
  assert.equal(history.status, 200);
  const historyText = await history.text();
  assert.equal(historyText.includes("thisTurn"), false);
  assert.equal(historyText.includes("committedProjection"), false);
});
