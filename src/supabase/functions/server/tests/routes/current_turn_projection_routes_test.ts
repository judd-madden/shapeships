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

function setAwaitingCarrierPrelude(state: any, playerId: "p1" | "p2") {
  const carrierId = `${playerId}-carrier`;
  const carrier = ship(carrierId, "CAR", {
    createdTurn: 4,
    chargesCurrent: 2,
  });
  state.gameData.ships[playerId].push(carrier);
  state.gameData.turnData.buildDrawingPublicFleetByPlayerId[playerId] =
    structuredClone(state.gameData.ships[playerId]);
  state.gameData.turnData.drawingPreludeByPlayerId[playerId] = {
    turnNumber: 5,
    requiredPassCount: 1,
    activePassIndex: 1,
    status: "awaiting_actions",
    eligibleSourcePowers: [{
      key: `${carrierId}:CAR#0`,
      sourceInstanceId: carrierId,
      shipDefId: "CAR",
      rawPowerIndex: 0,
      mode: "interactive",
    }],
    resolvedSourcePowerKeysByPass: {},
  };
}

function configureAncientProjectionPlayer(
  state: any,
  playerId: "p1" | "p2",
) {
  const player = state.players.find((candidate: any) => candidate.id === playerId);
  player.faction = "ancient";
  state.gameData.ships[playerId] = [
    ship(`${playerId}-mer`, "MER"),
    ship(`${playerId}-plu`, "PLU"),
  ];
  state.gameData.turnData.buildDrawingPublicFleetByPlayerId[playerId] =
    structuredClone(state.gameData.ships[playerId]);
  state.gameData.ancient.energyByPlayerId[playerId] = {
    battleTurnNumber: state.gameData.turnNumber,
    pool: { green: 3, red: 3, blue: 0 },
    sources: [],
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

function chargePreviewRequest(app: Hono, gameId: string, body: any) {
  return app.request(
    `/make-server-825e19ab/charge-declaration-preview/${gameId}`,
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
        buildGroupOrder: [
          { shipDefId: "OXI", sourceShipDefId: "EVO", afterCaptureSequence: 2 },
          { shipDefId: "FRI", afterCaptureSequence: 2 },
        ],
        frigateTriggers: [6],
        evolverChoices: [{ sourceKey: `${hiddenPlayerId}-evo`, choiceId: "oxite" }],
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
        shipDefId: "OXI",
        sourceShipDefId: "EVO",
        count: 2,
        appearanceAnchor: 2,
        appearanceRank: 2,
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
    right.gameData.phaseReadiness.push({
      playerId: hiddenPlayerId,
      isReady: true,
      currentStep: "battle.charge_declaration",
    });
    right.gameData.turnData.chargeDeclarationAcceptedOrdinaryActionsByPlayerId[
      hiddenPlayerId
    ] = {
      schemaVersion: 1,
      battleTurnNumber: 5,
      playerId: hiddenPlayerId,
      actions: [],
    };
    right.gameData.turnData.acceptedChargeDeclarationsByPlayerId[
      hiddenPlayerId
    ] = {
      schemaVersion: 1,
      contractVersion: 1,
      battleTurnNumber: 5,
      declarationId: `${hiddenPlayerId}-hidden-accepted`,
      declarationFingerprint: `${hiddenPlayerId}-hidden-fingerprint`,
      playerId: hiddenPlayerId,
      ordinaryChargeActions: [],
      solarCasts: [],
      autocastEnabled: false,
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

Deno.test("Drawing prelude full GET supplies only a validated requester turn-start projection", async () => {
  const state: any = createState();
  setAwaitingCarrierPrelude(state, "p1");
  state.gameData.ships.p1.push(
    ship("p1-carrier-produced-fig", "FIG", { createdTurn: 5 }),
  );
  state.gameData.turnData.shipsMadeThisTurnByPlayerId = { p1: 1 };

  const p1Body = await fullStateBody(state, "p1");
  const baseline = p1Body.requester.thisTurn.turnStartProjection;
  assert.equal(baseline.status, "estimated");
  assert.equal(baseline.damage.total, 0);
  assert.equal(baseline.healing.total, 1);
  assert.deepEqual(baseline.damage.rows, []);
  assert.deepEqual(baseline.healing.rows.map((row: any) => row.label), [
    "Defender",
  ]);
  assert.equal("turnStartProjection" in p1Body.publicState.thisTurn, false);
  assert.equal(
    JSON.stringify(p1Body.gameData).includes("turnStartProjection"),
    false,
  );

  const p2Body = await fullStateBody(state, "p2");
  assert.equal(p2Body.requester.thisTurn.turnStartProjection, null);
  const spectatorBody = await fullStateBody(state, "spec");
  assert.equal(spectatorBody.requester.thisTurn, null);

  const unavailable = structuredClone(state);
  delete unavailable.gameData.turnData.buildDrawingPublicFleetByPlayerId.p2;
  const unavailableBody = await fullStateBody(unavailable, "p1");
  assert.equal(
    unavailableBody.requester.thisTurn.turnStartProjection.status,
    "unavailable",
  );
  assert.equal(
    unavailableBody.requester.thisTurn.turnStartProjection.reason,
    "drawing_snapshot_unavailable",
  );
});

Deno.test("turn-start projection is hidden-data invariant and yields to normal preview eligibility", async () => {
  const left: any = createState();
  setAwaitingCarrierPrelude(left, "p1");
  setAwaitingCarrierPrelude(left, "p2");
  const right = structuredClone(left);
  right.stateRevision = 101;
  right.gameData.ships.p2.push(
    ship("p2-hidden-carrier-choice", "FIG", { createdTurn: 5 }),
  );
  right.gameData.turnData.drawingPreludeByPlayerId.p2 = {
    ...right.gameData.turnData.drawingPreludeByPlayerId.p2,
    requiredPassCount: 2,
    activePassIndex: 2,
    resolvedSourcePowerKeysByPass: { 1: ["p2-carrier:CAR#0"] },
  };
  await assertCompleteFullStateNoninterference({
    label: "Drawing turn-start baseline/p1",
    viewer: "p1",
    left,
    right,
  });

  const completed = structuredClone(left);
  completed.gameData.turnData.drawingPreludeByPlayerId.p1.status = "complete";
  completed.gameData.turnData.drawingPreludeByPlayerId.p1
    .resolvedSourcePowerKeysByPass = { 1: ["p1-carrier:CAR#0"] };
  const completedBody = await fullStateBody(completed, "p1");
  assert.equal(completedBody.requester.thisTurn.turnStartProjection, null);

  const test = fixture(completed);
  const preview = await previewRequest(test.app, completed.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).status, "estimated");
});

Deno.test("Ancient preview, accepted submission, committed projection, and Reveal handoff keep the private pair scoped", async () => {
  const state: any = createState();
  configureAncientProjectionPlayer(state, "p1");
  setAwaitingCarrierPrelude(state, "p1");

  const turnStartBody = await fullStateBody(state, "p1");
  const turnStart = turnStartBody.requester.thisTurn.turnStartProjection;
  assert.equal(turnStart.status, "estimated");
  assert.ok(turnStart.withAutocast);
  assert.equal("identity" in turnStart.withAutocast, false);

  state.gameData.turnData.drawingPreludeByPlayerId.p1.status = "complete";
  state.gameData.turnData.drawingPreludeByPlayerId.p1.resolvedSourcePowerKeysByPass = {
    1: ["p1-carrier:CAR#0"],
  };
  const previewFixture = fixture(state);
  const previewResponse = await previewRequest(previewFixture.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: { builds: [] },
  });
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.ok(preview.withAutocast);
  assert.equal("identity" in preview.withAutocast, false);

  state.gameData.turnData.commitments.BUILD_5 = {
    p1: { commitHash: "ancient-own", revealPayload: { builds: [] } },
  };
  const committedBody = await fullStateBody(state, "p1");
  const committed = committedBody.requester.thisTurn.committedProjection;
  assert.ok(committed.withAutocast);
  assert.deepEqual(committed.identity, preview.identity);
  assert.equal(
    JSON.stringify(committedBody.publicState.thisTurn).includes("withAutocast"),
    false,
  );

  const revealState = structuredClone(state);
  revealState.gameData.currentPhase = "battle";
  revealState.gameData.currentSubPhase = "reveal";
  revealState.gameData.turnData.currentMajorPhase = "battle";
  revealState.gameData.turnData.currentSubPhase = "reveal";
  revealState.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  const revealBody = await fullStateBody(revealState, "p1");
  const current = revealBody.requester.thisTurn.currentProjection;
  assert.equal(current.status, "estimated");
  assert.ok(current.withAutocast);
  assert.equal("committedProjection" in revealBody.requester.thisTurn, false);
  assert.equal(
    JSON.stringify(revealBody.publicState.thisTurn).includes("withAutocast"),
    false,
  );
});

Deno.test("preview accepts validated EVO group ordering metadata", async () => {
  const state: any = createState();
  state.players.find((player: any) => player.id === "p1").faction = "xenite";
  state.gameData.ships.p1 = [
    ship("p1-evo", "EVO"),
    ship("p1-xen", "XEN"),
    ship("p1-oxi", "OXI"),
  ];
  state.gameData.turnData.buildDrawingPublicFleetByPlayerId.p1 = structuredClone(
    state.gameData.ships.p1,
  );
  const test = fixture(state);
  const response = await previewRequest(test.app, state.gameId, {
    observed: { turnNumber: 5, phaseKey: "build.drawing" },
    draft: {
      builds: [{ shipDefId: "OXF", count: 1 }],
      buildGroupOrder: [
        { shipDefId: "OXF", afterCaptureSequence: 2 },
        {
          shipDefId: "OXI",
          sourceShipDefId: "EVO",
          afterCaptureSequence: 2,
        },
      ],
      evolverChoices: [{ sourceKey: "p1-evo", choiceId: "oxite" }],
    },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.build.lines.slice(0, 2), ["1 x OXF", "1 x OXI (EVO)"]);
});

Deno.test("preview rejects an unchanged draft when the requester capture identity has advanced", async () => {
  const state: any = createState();
  const test = fixture(state);
  const getBefore = await test.app.request(
    `/make-server-825e19ab/game-state/${state.gameId}`,
  );
  const beforeBody = await getBefore.json();
  const captureIdentity = beforeBody.requester.thisTurn.ownBuildCaptureIdentity;
  assert.equal(typeof captureIdentity, "string");

  const advanced = structuredClone(test.persistence.store.get(test.key));
  advanced.battleLogScratch.currentTurnCapture.buildAtomsByPlayerId.p1.push({
    kind: "produced_build",
    shipDefId: "DEF",
    sourceShipDefId: "CAR",
    count: 1,
  });
  test.persistence.store.set(test.key, advanced);

  const response = await previewRequest(test.app, state.gameId, {
    observed: {
      turnNumber: 5,
      phaseKey: "build.drawing",
      ownBuildCaptureIdentity: captureIdentity,
    },
    draft: {
      builds: [{ shipDefId: "FIG", count: 1 }],
      buildGroupOrder: [{ shipDefId: "FIG", afterCaptureSequence: 2 }],
    },
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.reason, "capture_context_changed");
  assert.equal(body.retry.allowed, false);
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

Deno.test("submitted ZEN recovers its immediate ANT production in frozen own rows", async () => {
  const state: any = createState();
  state.players.find((player: any) => player.id === "p1").faction = "xenite";
  state.gameData.turnData.commitments.BUILD_5 = {
    p1: {
      commitHash: "zen-hash",
      revealPayload: {
        builds: [
          { shipDefId: "ANT", count: 1 },
          { shipDefId: "ZEN", count: 1 },
        ],
        buildGroupOrder: [{ shipDefId: "ZEN", afterCaptureSequence: 2 }],
      },
    },
  };
  const test = fixture(state);
  const body = await (await test.app.request(
    `/make-server-825e19ab/game-state/${state.gameId}`,
  )).json();
  assert.deepEqual(
    body.requester.thisTurn.committedProjection.build.lines.slice(0, 2),
    ["1 x ANT (ZEN)", "1 x ZEN"],
  );
});

Deno.test("Charge projection ignores canonical revision and hidden declaration differences", () => {
  const left: any = createState("battle.charge_declaration");
  left.gameData.ships.p1 = [ship("p1-int", "INT", { chargesCurrent: 1 })];
  left.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
    p1: ["p1-int"],
    p2: [],
  };
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
    leftProjection.publicThisTurn.estimatesByPlayerId.p1
      .chargeDeclarationUncertain,
    true,
  );
  assert.equal(
    leftProjection.publicThisTurn.estimatesByPlayerId.p2
      .chargeDeclarationUncertain,
    false,
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

Deno.test("battle paired estimates are Ancient-requester-only in both orientations and leave public Base independent", async () => {
  for (const ancientPlayerId of ["p1", "p2"] as const) {
    const state: any = createState("battle.reveal");
    configureAncientProjectionPlayer(state, ancientPlayerId);
    const otherPlayerId = ancientPlayerId === "p1" ? "p2" : "p1";
    state.players.find((player: any) => player.id === otherPlayerId).faction = "human";

    const ancientBody = await fullStateBody(state, ancientPlayerId);
    const otherBody = await fullStateBody(state, otherPlayerId);
    const spectatorBody = await fullStateBody(state, "spec");
    const requesterProjection = ancientBody.requester.thisTurn.currentProjection;

    assert.equal(requesterProjection.status, "estimated");
    assert.ok(requesterProjection.withAutocast);
    assert.equal("identity" in requesterProjection.withAutocast, false);
    assert.deepEqual(requesterProjection.damage,
      ancientBody.publicState.thisTurn.estimatesByPlayerId[ancientPlayerId].damage);
    assert.deepEqual(requesterProjection.healing,
      ancientBody.publicState.thisTurn.estimatesByPlayerId[ancientPlayerId].healing);
    assert.equal(otherBody.requester.thisTurn, null);
    assert.equal(spectatorBody.requester.thisTurn, null);
    assert.deepEqual(otherBody.publicState.thisTurn, ancientBody.publicState.thisTurn);
    assert.deepEqual(spectatorBody.publicState.thisTurn, ancientBody.publicState.thisTurn);
    assert.equal(
      JSON.stringify(ancientBody.publicState.thisTurn).includes("withAutocast"),
      false,
    );
  }
});

Deno.test("Charge Solar preview is requester-only, canonical, stale-safe, and nonmutating", async () => {
  const state: any = createState("battle.charge_declaration");
  configureAncientProjectionPlayer(state, "p1");
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: structuredClone(state.gameData.ships.p1),
    p2: structuredClone(state.gameData.ships.p2),
  };
  replaceChargeDeclarationVisibilityState(state);
  const test = fixture(state);
  const before = structuredClone(test.persistence.store.get(test.key));
  const envelope = {
    observed: { turnNumber: 5, phaseKey: "battle.charge_declaration" },
    solarSelection: {
      solarCasts: [{ solarPowerId: "SLIF" }],
      autocastEnabled: true,
    },
    requestToken: "solar-1",
  };

  const response = await chargePreviewRequest(test.app, state.gameId, envelope);
  assert.equal(response.status, 200);
  const body: any = await response.json();
  assert.equal(body.status, "estimated");
  assert.equal(body.requestToken, "solar-1");
  assert.equal(body.playerId, "p1");
  assert.equal(body.withSolarSelection.healing.total, 3);
  assert.equal(body.withSolarSelection.damage.total, 7);
  assert.equal(body.withSolarSelection.autocastEnabled, true);
  assert.equal(typeof body.identity.solarSelectionKey, "string");
  assert.deepEqual(test.persistence.store.get(test.key), before);
  assert.equal(test.persistence.writes, 0);
  assert.equal(test.kvWrites, 0);

  test.setSession("p2");
  const other = await chargePreviewRequest(test.app, state.gameId, envelope);
  assert.equal(other.status, 403);

  test.setSession("p1");
  const unsupported = await chargePreviewRequest(test.app, state.gameId, {
    ...envelope,
    solarSelection: {
      solarCasts: [{ solarPowerId: "SVOR" }],
      autocastEnabled: true,
    },
  });
  assert.equal(unsupported.status, 400);

  const stale = await chargePreviewRequest(test.app, state.gameId, {
    ...envelope,
    observed: {
      ...envelope.observed,
      sourceContextKey: "stale-context",
    },
  });
  assert.equal(stale.status, 409);
  const staleBody: any = await stale.json();
  assert.equal(staleBody.reason, "source_context_changed");
  assert.equal(staleBody.retry.allowed, true);
});

Deno.test("preferred Charge preview returns a distinct complete declaration variant for every species", async () => {
  for (const faction of ["human", "xenite", "centaur", "ancient"]) {
    const state: any = createState("battle.charge_declaration");
    state.players.find((player: any) => player.id === "p1").faction = faction;
    state.gameData.ships.p1 = [
      ship("p1-int", "INT", { chargesCurrent: 1 }),
      ship("p1-bat", "BAT"),
    ];
    state.gameData.pendingTurn = {
      damageByPlayerId: { p2: 4 },
      healByPlayerId: {},
      breakdownEntries: [{
        effectId: "route-first-strike",
        kind: "Damage",
        ownerPlayerId: "p1",
        targetPlayerId: "p2",
        sourceLabel: "First Strike",
        baseAmount: 4,
        finalAmount: 4,
      }],
    };
    state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
    state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
      p1: ["p1-int"],
      p2: [],
    };
    state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
      structuredClone(state.gameData.ships);
    replaceChargeDeclarationVisibilityState(state);
    const test = fixture(state);
    const declaration = {
      contractVersion: 1,
      declarationId: `route-complete-${faction}`,
      ordinaryChargeActions: [{
        actionType: "power",
        actionId: "INT#0",
        sourceInstanceId: "p1-int",
        choiceId: "damage",
      }],
      solarCasts: [],
      autocastEnabled: false,
    };
    const response = await chargePreviewRequest(test.app, state.gameId, {
      observed: { turnNumber: 5, phaseKey: "battle.charge_declaration" },
      declaration,
      requestToken: `complete-declaration-${faction}`,
    });
    assert.equal(response.status, 200, faction);
    const body: any = await response.json();
    assert.equal(body.damage.total, 6, faction);
    assert.equal(body.healing.total, 3, faction);
    assert.equal(body.withChargeDeclaration.damage.total, 11, faction);
    assert.equal(body.withChargeDeclaration.healing.total, 3, faction);
    assert.equal(
      body.identity.declarationFingerprint,
      body.withChargeDeclaration.declarationFingerprint,
      faction,
    );
    assert.equal(body.withChargeDeclaration.autocastEnabled, false, faction);
    assert.equal(test.persistence.writes, 0, faction);

    state.gameData.turnData.acceptedChargeDeclarationsByPlayerId.p1 = {
      schemaVersion: 1,
      contractVersion: 1,
      battleTurnNumber: 5,
      declarationId: declaration.declarationId,
      declarationFingerprint: body.identity.declarationFingerprint,
      playerId: "p1",
      ordinaryChargeActions: structuredClone(declaration.ordinaryChargeActions),
      solarCasts: [],
      autocastEnabled: false,
    };
    for (const recoveredState of [state, JSON.parse(JSON.stringify(state))]) {
      const recovered: any = await fullStateBody(recoveredState, "p1");
      const projection = recovered.requester.thisTurn.currentProjection;
      assert.equal(projection.withChargeDeclaration.damage.total, 11, faction);
      assert.equal(projection.withChargeDeclaration.healing.total, 3, faction);
      assert.equal(
        projection.identity.declarationFingerprint,
        body.identity.declarationFingerprint,
        faction,
      );
    }
  }
});

Deno.test("Charge preview distinguishes retained conflicts from finalized submissions", async () => {
  const state: any = createState("battle.charge_declaration");
  state.gameData.ships.p1 = [
    ship("p1-int", "INT", { chargesCurrent: 1 }),
    ship("p1-int-b", "INT", { chargesCurrent: 1 }),
  ];
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.turnData.chargeDeclarationEligibleSourceIdsByPlayerId = {
    p1: ["p1-int", "p1-int-b"],
    p2: [],
  };
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId =
    structuredClone(state.gameData.ships);
  replaceChargeDeclarationVisibilityState(state);
  const acceptedAction = {
    actionType: "power",
    actionId: "INT#0",
    sourceInstanceId: "p1-int",
    choiceId: "damage",
  };
  state.gameData.turnData.chargeDeclarationAcceptedOrdinaryActionsByPlayerId.p1 = {
    schemaVersion: 1,
    battleTurnNumber: 5,
    playerId: "p1",
    actions: [acceptedAction],
  };
  const request = (ordinaryChargeActions: any[]) => ({
    observed: { turnNumber: 5, phaseKey: "battle.charge_declaration" },
    declaration: {
      contractVersion: 1,
      declarationId: "conflict-check",
      ordinaryChargeActions,
      solarCasts: [],
      autocastEnabled: false,
    },
  });

  const retainedFixture = fixture(state);
  const retainedConflict = await chargePreviewRequest(
    retainedFixture.app,
    state.gameId,
    request([{ ...acceptedAction, choiceId: "heal" }]),
  );
  assert.equal(retainedConflict.status, 409);
  assert.equal((await retainedConflict.json()).reason, "declaration_conflict");

  state.gameData.turnData.acceptedChargeDeclarationsByPlayerId.p1 = {
    schemaVersion: 1,
    contractVersion: 1,
    battleTurnNumber: 5,
    declarationId: "finalized",
    declarationFingerprint: JSON.stringify({
      contractVersion: 1,
      ordinaryChargeActions: [acceptedAction],
      solarCasts: [],
      autocastEnabled: false,
    }),
    playerId: "p1",
    ordinaryChargeActions: [acceptedAction],
    solarCasts: [],
    autocastEnabled: false,
  };
  for (const actions of [
    [{ ...acceptedAction, choiceId: "heal" }],
    [acceptedAction, {
      ...acceptedAction,
      sourceInstanceId: "p1-int-b",
    }],
  ]) {
    const finalizedFixture = fixture(state);
    const response = await chargePreviewRequest(
      finalizedFixture.app,
      state.gameId,
      request(actions),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).reason, "already_submitted");
  }
});

Deno.test("accepted Charge Solar projection replays captured initial energy, not spent live energy", async () => {
  const state: any = createState("battle.charge_declaration");
  configureAncientProjectionPlayer(state, "p1");
  state.gameData.turnData.ancientBattleRevealPreparedTurnNumber = 5;
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = {
    p1: structuredClone(state.gameData.ships.p1),
    p2: structuredClone(state.gameData.ships.p2),
  };
  replaceChargeDeclarationVisibilityState(state);
  state.gameData.ancient.energyByPlayerId.p1.pool = {
    green: 0,
    red: 0,
    blue: 0,
  };
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    contractVersion: 1,
    declarationId: "accepted-solar",
    declarationFingerprint: "normalized-on-load",
    playerId: "p1",
    context: {
      contextVersion: 1,
      battleTurnNumber: 5,
      initialEnergy: { green: 3, red: 3, blue: 0 },
      energySourceIds: [],
    },
    ordinaryChargeActions: [],
    solarCasts: [{ solarPowerId: "SLIF" }],
    autocastEnabled: true,
  };

  const body: any = await fullStateBody(state, "p1");
  const selected = body.requester.thisTurn.currentProjection.withSolarSelection;
  assert.equal(selected.healing.total, 3);
  assert.equal(selected.damage.total, 7);
  assert.equal(selected.autocastEnabled, true);
  const publicOwn = body.publicState.thisTurn.estimatesByPlayerId.p1;
  assert.equal("withSolarSelection" in publicOwn, false);
  const otherBody: any = await fullStateBody(state, "p2");
  assert.equal(JSON.stringify(otherBody).includes("withSolarSelection"), false);

  const acceptedFixture = fixture(state);
  const alreadyAccepted = await chargePreviewRequest(
    acceptedFixture.app,
    state.gameId,
    {
      observed: { turnNumber: 5, phaseKey: "battle.charge_declaration" },
      solarSelection: {
        solarCasts: [{ solarPowerId: "SLIF" }],
        autocastEnabled: true,
      },
      requestToken: "accepted-retry",
    },
  );
  assert.equal(alreadyAccepted.status, 409);
  assert.equal((await alreadyAccepted.json()).reason, "already_submitted");
  assert.equal(acceptedFixture.persistence.writes, 0);
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
