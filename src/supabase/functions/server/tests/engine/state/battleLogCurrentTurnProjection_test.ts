import assert from "node:assert/strict";
import {
  applyIntent,
  type IntentRequest,
} from "../../../engine/intent/IntentReducer.ts";
import { onEnterPhase } from "../../../engine/phase/onEnterPhase.ts";
import {
  buildBattleLogTurnSummaryFromScratch,
  foldBattleLogCaptureEventsIntoScratch,
  projectBattleLogCurrentTurnPublic,
  projectBattleLogCurrentTurnRequester,
  projectBattleLogCurrentTurnForViewer,
} from "../../../engine/state/battleLogHistory.ts";

function player(playerId: string, faction = "human") {
  return {
    id: playerId,
    name: playerId.toUpperCase(),
    role: "player",
    faction,
    health: 25,
    lines: 0,
    joiningLines: 0,
  };
}

function createState(args: {
  phase?: string;
  status?: "waiting" | "active" | "finished";
  turnNumber?: number;
  scratch?: any;
} = {}): any {
  const phase = args.phase ?? "build.drawing";
  const [currentPhase, currentSubPhase] = phase.split(".");
  const turnNumber = args.turnNumber ?? 4;
  return {
    gameId: "live-log-projection",
    status: args.status ?? "active",
    players: [
      player("p1"),
      player("p2", "centaur"),
      { id: "spec", name: "Spectator", role: "spectator" },
    ],
    gameData: {
      turnNumber,
      currentPhase,
      currentSubPhase,
      ships: { p1: [], p2: [] },
      turnData: {
        turnNumber,
        currentMajorPhase: currentPhase,
        currentSubPhase,
      },
    },
    battleLogScratch: args.scratch ?? {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: turnNumber - 1,
      archiveCheckpoint: null,
    },
  };
}

function setPhase(state: any, phase: string): any {
  const next = structuredClone(state);
  const [currentPhase, currentSubPhase] = phase.split(".");
  next.gameData.currentPhase = currentPhase;
  next.gameData.currentSubPhase = currentSubPhase;
  next.gameData.turnData.currentMajorPhase = currentPhase;
  next.gameData.turnData.currentSubPhase = currentSubPhase;
  return next;
}

function foldEvents(state: any, events: unknown[]): any {
  const next = structuredClone(state);
  next.battleLogScratch = foldBattleLogCaptureEventsIntoScratch(
    next.battleLogScratch,
    events,
  );
  return next;
}

function buildCapture(overrides: Record<string, unknown> = {}): any {
  return {
    turnNumber: 4,
    diceValue: 4,
    buildAtomsByPlayerId: {},
    battleAtomsByPlayerId: {},
    savedResourcesByPlayerId: {},
    ...overrides,
  };
}

function actionIntent(
  gameId: string,
  turnNumber: number,
  actionId: string,
  sourceInstanceId: string,
  choiceId: string,
): IntentRequest {
  return {
    gameId,
    intentType: "ACTION",
    turnNumber,
    nonce: `${sourceInstanceId}-${choiceId}-${crypto.randomUUID()}`,
    payload: {
      actionType: "power",
      actionId,
      sourceInstanceId,
      choiceId,
    },
  };
}

function readyIntent(
  gameId: string,
  turnNumber: number,
  playerId: string,
): IntentRequest {
  return {
    gameId,
    intentType: "DECLARE_READY",
    turnNumber,
    nonce: `ready-${playerId}-${crypto.randomUUID()}`,
  };
}

function createDiceState(
  p1Ships: Array<
    { instanceId: string; shipDefId: string; createdTurn: number }
  >,
  p2Ships: Array<
    { instanceId: string; shipDefId: string; createdTurn: number }
  >,
): any {
  const state = createState({ phase: "build.dice_roll", turnNumber: 1 });
  state.gameId = "live-log-dice-barrier";
  state.players = [player("p1"), player("p2", "centaur")];
  state.gameData.turnNumber = 1;
  state.gameData.diceRoll = null;
  state.gameData.phaseReadiness = [];
  state.gameData.ships = { p1: p1Ships, p2: p2Ships };
  state.gameData.ancient = {
    schemaVersion: 1,
    energyByPlayerId: {},
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId: {},
    pendingSimulacrumCopies: [],
    pendingBlackHoleDestructions: [],
  };
  state.gameData.turnData = {
    turnNumber: 1,
    currentMajorPhase: "build",
    currentSubPhase: "dice_roll",
    diceRolled: false,
    diceFinalized: false,
  };
  state.battleLogScratch = {
    currentTurnCapture: null,
    lastFinalizedTurnNumber: null,
    archiveCheckpoint: null,
  };
  return state;
}

Deno.test("active empty turns project stable player maps while terminal games project no live turn", () => {
  const active = createState();
  const p1 = projectBattleLogCurrentTurnForViewer(active, "p1");
  const p2 = projectBattleLogCurrentTurnForViewer(active, "p2");
  const spectator = projectBattleLogCurrentTurnForViewer(active, "spec");

  assert.deepEqual(p1, {
    turnNumber: 4,
    diceValue: null,
    buildLinesByPlayerId: { p1: [], p2: [] },
    battleLinesByPlayerId: { p1: [], p2: [] },
    concealedBuildPlayerIds: ["p2"],
  });
  assert.deepEqual(p2, {
    turnNumber: 4,
    diceValue: null,
    buildLinesByPlayerId: { p1: [], p2: [] },
    battleLinesByPlayerId: { p1: [], p2: [] },
    concealedBuildPlayerIds: ["p1"],
  });
  assert.deepEqual(spectator, {
    turnNumber: 4,
    diceValue: null,
    buildLinesByPlayerId: { p1: [], p2: [] },
    battleLinesByPlayerId: { p1: [], p2: [] },
    concealedBuildPlayerIds: ["p1", "p2"],
  });

  const unfinishedCapture = buildCapture({
    buildAtomsByPlayerId: {
      p1: [{ kind: "manual_build", shipDefId: "SCO" }],
    },
  });
  const resigned = createState({
    status: "finished",
    scratch: {
      currentTurnCapture: unfinishedCapture,
      lastFinalizedTurnNumber: 3,
      archiveCheckpoint: null,
    },
  });
  resigned.resultReason = "resignation";
  assert.equal(projectBattleLogCurrentTurnForViewer(resigned, "p1"), null);
  assert.equal(projectBattleLogCurrentTurnForViewer(resigned, "spec"), null);
});

Deno.test("Drawing projection keeps private build atoms owner-only and shape-stable", () => {
  const state = createState({
    scratch: {
      currentTurnCapture: buildCapture({
        buildAtomsByPlayerId: {
          p1: [
            { kind: "chronoswarm_roll", rolls: [2, 5] },
            {
              kind: "produced_build",
              shipDefId: "DEF",
              sourceShipDefId: "CAR",
              count: 1,
              sourceShipInstanceId: "car-p1",
              producedBuildOccurrence: {
                stage: "drawing_prelude",
                passIndex: 1,
              },
            },
          ],
          p2: [{ kind: "reroll", sourceShipDefId: "KNO", values: [3, 6] }],
        },
      }),
      lastFinalizedTurnNumber: 3,
      archiveCheckpoint: null,
    },
  });
  state.gameData.turnData.commitments = {
    BUILD_4: {
      p1: {
        commitHash: "private-build-hash",
        revealPayload: { builds: [{ shipDefId: "FIG", count: 1 }] },
        nonce: "private-build-nonce",
      },
    },
  };

  const p1 = projectBattleLogCurrentTurnForViewer(state, "p1");
  const p2 = projectBattleLogCurrentTurnForViewer(state, "p2");
  const spectator = projectBattleLogCurrentTurnForViewer(state, "spec");

  assert.deepEqual(p1?.buildLinesByPlayerId, {
    p1: ["CHR rolled 2, 5", "1 x DEF (CAR)"],
    p2: ["KNO rerolled 3 -> 6"],
  });
  assert.deepEqual(p2?.buildLinesByPlayerId, {
    p1: ["CHR rolled 2, 5"],
    p2: ["KNO rerolled 3 -> 6"],
  });
  assert.deepEqual(spectator?.buildLinesByPlayerId, p2?.buildLinesByPlayerId);
  assert.deepEqual(p1?.concealedBuildPlayerIds, ["p2"]);
  assert.deepEqual(p2?.concealedBuildPlayerIds, ["p1"]);
  assert.deepEqual(spectator?.concealedBuildPlayerIds, ["p1", "p2"]);
  assert.equal(
    p1?.buildLinesByPlayerId.p1.some((line) => line.includes("FIG")),
    false,
  );

  const changedHiddenOpponent = structuredClone(state);
  changedHiddenOpponent.battleLogScratch.currentTurnCapture
    .buildAtomsByPlayerId.p2.push(
      { kind: "manual_build", shipDefId: "FIG" },
      {
        kind: "produced_build",
        shipDefId: "XEN",
        sourceShipDefId: "BUG",
        count: 9,
        sourceShipInstanceId: "bug-p2",
        producedBuildOccurrence: { stage: "drawing" },
      },
    );
  assert.deepEqual(
    projectBattleLogCurrentTurnForViewer(changedHiddenOpponent, "p1"),
    p1,
  );
});

Deno.test("Reveal exposes captured creation history without recounting the current fleet", () => {
  const drawing = createState({
    scratch: {
      currentTurnCapture: buildCapture({
        buildAtomsByPlayerId: {
          p1: [{ kind: "manual_build", shipDefId: "SCO" }],
          p2: [{
            kind: "produced_build",
            shipDefId: "FIG",
            sourceShipDefId: "DRE",
            count: 2,
            sourceShipInstanceId: "dre-p2",
            producedBuildOccurrence: { stage: "reveal" },
          }],
        },
      }),
      lastFinalizedTurnNumber: 3,
      archiveCheckpoint: null,
    },
  });
  drawing.gameData.ships = { p1: [], p2: [] };

  const revealed = setPhase(drawing, "battle.reveal");
  const p1 = projectBattleLogCurrentTurnForViewer(revealed, "p1");
  const p2 = projectBattleLogCurrentTurnForViewer(revealed, "p2");
  const spectator = projectBattleLogCurrentTurnForViewer(revealed, "spec");
  assert.deepEqual(p1?.buildLinesByPlayerId, {
    p1: ["1 x SCO"],
    p2: ["2 x FIG (DRE)"],
  });
  assert.deepEqual(p2, p1);
  assert.deepEqual(spectator, p1);
  assert.deepEqual(p1?.concealedBuildPlayerIds, []);
});

Deno.test("First Strike and Charge Declaration atoms open only at their own barriers", () => {
  const state = createState({
    phase: "battle.first_strike",
    scratch: {
      currentTurnCapture: buildCapture({
        battleAtomsByPlayerId: {
          p1: [{
            kind: "destroy",
            sourceShipDefId: "GUA",
            targetShipDefIds: ["BUG"],
            bucket: 1,
          }, {
            kind: "charge_action",
            sourceShipDefId: "INT",
            actionLabel: "Damage",
            bucket: 2,
          }],
        },
      }),
      lastFinalizedTurnNumber: 3,
      archiveCheckpoint: null,
    },
  });

  for (const viewerId of ["p1", "p2", "spec"]) {
    assert.deepEqual(
      projectBattleLogCurrentTurnForViewer(state, viewerId)
        ?.battleLinesByPlayerId.p1,
      [],
    );
  }

  const charge = setPhase(state, "battle.charge_declaration");
  for (const viewerId of ["p1", "p2", "spec"]) {
    assert.deepEqual(
      projectBattleLogCurrentTurnForViewer(charge, viewerId)
        ?.battleLinesByPlayerId.p1,
      ["GUA destroys BUG"],
    );
  }

  const resolution = setPhase(state, "battle.end_of_turn_resolution");
  for (const viewerId of ["p1", "p2", "spec"]) {
    assert.deepEqual(
      projectBattleLogCurrentTurnForViewer(resolution, viewerId)
        ?.battleLinesByPlayerId.p1,
      ["GUA destroys BUG", "1 x INT Damage"],
    );
  }
});

Deno.test("refresh is stable and a stale capture never attaches to the next turn", () => {
  const state = createState({
    phase: "battle.reveal",
    scratch: {
      currentTurnCapture: buildCapture({
        buildAtomsByPlayerId: {
          p1: [{ kind: "manual_build", shipDefId: "SCO" }],
        },
      }),
      lastFinalizedTurnNumber: 3,
      archiveCheckpoint: null,
    },
  });
  const beforeRefresh = projectBattleLogCurrentTurnForViewer(state, "p1");
  const afterRefresh = projectBattleLogCurrentTurnForViewer(
    JSON.parse(JSON.stringify(state)),
    "p1",
  );
  assert.deepEqual(afterRefresh, beforeRefresh);

  const nextTurn = setPhase(state, "build.drawing");
  nextTurn.gameData.turnNumber = 5;
  nextTurn.gameData.turnData.turnNumber = 5;
  assert.deepEqual(projectBattleLogCurrentTurnForViewer(nextTurn, "p1"), {
    turnNumber: 5,
    diceValue: null,
    buildLinesByPlayerId: { p1: [], p2: [] },
    battleLinesByPlayerId: { p1: [], p2: [] },
    concealedBuildPlayerIds: ["p2"],
  });
});

Deno.test("partial KNO choices cannot publish a reroll result or row", async () => {
  const enteredResult = onEnterPhase(
    createDiceState(
      [{ instanceId: "kno-p1", shipDefId: "KNO", createdTurn: 1 }],
      [{ instanceId: "kno-p2", shipDefId: "KNO", createdTurn: 1 }],
    ),
    "battle.end_of_turn_resolution",
    "build.dice_roll",
    100,
  );
  const entered = foldEvents(enteredResult.state, enteredResult.events);
  const initial = projectBattleLogCurrentTurnForViewer(entered, "p1");
  assert.equal(entered.gameData.turnData.diceManipulationStage, "kno");
  assert.equal(typeof initial?.diceValue, "number");

  const p1Reroll = await applyIntent(
    entered,
    "p1",
    actionIntent(entered.gameId, 1, "KNO#0", "kno-p1", "reroll"),
    110,
  );
  assert.equal(p1Reroll.ok, true);
  const p1WaitingResult = await applyIntent(
    foldEvents(p1Reroll.state, p1Reroll.events),
    "p1",
    readyIntent(entered.gameId, 1, "p1"),
    120,
  );
  const p1Waiting = foldEvents(p1WaitingResult.state, p1WaitingResult.events);
  const waitingProjection = projectBattleLogCurrentTurnForViewer(
    p1Waiting,
    "p1",
  );
  assert.equal(waitingProjection?.diceValue, initial?.diceValue);
  assert.equal(
    Object.values(waitingProjection?.buildLinesByPlayerId ?? {}).flat().some(
      (line) => line.includes("KNO"),
    ),
    false,
  );

  const alternateChoice = await applyIntent(
    entered,
    "p1",
    actionIntent(entered.gameId, 1, "KNO#0", "kno-p1", "hold"),
    111,
  );
  const alternateWaitingResult = await applyIntent(
    foldEvents(alternateChoice.state, alternateChoice.events),
    "p1",
    readyIntent(entered.gameId, 1, "p1"),
    121,
  );
  const alternateWaiting = foldEvents(
    alternateWaitingResult.state,
    alternateWaitingResult.events,
  );
  assert.deepEqual(
    projectBattleLogCurrentTurnForViewer(alternateWaiting, "p1"),
    waitingProjection,
  );
  assert.deepEqual(
    projectBattleLogCurrentTurnForViewer(p1Waiting, undefined),
    projectBattleLogCurrentTurnForViewer(alternateWaiting, undefined),
  );

  const p2Hold = await applyIntent(
    p1Waiting,
    "p2",
    actionIntent(entered.gameId, 1, "KNO#0", "kno-p2", "hold"),
    130,
  );
  const resolvedResult = await applyIntent(
    foldEvents(p2Hold.state, p2Hold.events),
    "p2",
    readyIntent(entered.gameId, 1, "p2"),
    140,
  );
  const releasedDice = resolvedResult.events.filter((event: any) =>
    event.type === "DICE_ROLLED"
  ).at(-1)?.value;
  assert.equal(typeof releasedDice, "number");
  const resolved = foldEvents(resolvedResult.state, resolvedResult.events);
  const released = projectBattleLogCurrentTurnForViewer(resolved, undefined);
  assert.equal(released?.diceValue, releasedDice);
  assert.equal(
    released?.buildLinesByPlayerId.p1.some((line) =>
      line.includes("KNO rerolled")
    ),
    true,
  );
});

Deno.test("partial CUB choices cannot publish locked values or intervention rows", async () => {
  const enteredResult = onEnterPhase(
    createDiceState(
      [{ instanceId: "cube-p1", shipDefId: "CUB", createdTurn: 1 }],
      [{ instanceId: "cube-p2", shipDefId: "CUB", createdTurn: 1 }],
    ),
    "battle.end_of_turn_resolution",
    "build.dice_roll",
    200,
  );
  const entered = foldEvents(enteredResult.state, enteredResult.events);
  const initial = projectBattleLogCurrentTurnForViewer(entered, "p1");
  const p1LockedValue =
    entered.gameData.turnData.cubeDiceRollsByPlayerId.p1[0].value;
  assert.equal(entered.gameData.turnData.diceManipulationStage, "cube");
  assert.equal(typeof initial?.diceValue, "number");

  const p1Cube = await applyIntent(
    entered,
    "p1",
    actionIntent(
      entered.gameId,
      1,
      "CUB#0",
      "cube-p1",
      "cube:cube-p1",
    ),
    210,
  );
  const p1WaitingResult = await applyIntent(
    foldEvents(p1Cube.state, p1Cube.events),
    "p1",
    readyIntent(entered.gameId, 1, "p1"),
    220,
  );
  const p1Waiting = foldEvents(p1WaitingResult.state, p1WaitingResult.events);
  const waitingProjection = projectBattleLogCurrentTurnForViewer(
    p1Waiting,
    "p1",
  );
  assert.equal(waitingProjection?.diceValue, initial?.diceValue);
  assert.notEqual(waitingProjection?.diceValue, undefined);
  assert.equal(
    Object.values(waitingProjection?.buildLinesByPlayerId ?? {}).flat().some(
      (line) => line.includes("CUB rolled"),
    ),
    false,
  );

  const p1Main = await applyIntent(
    entered,
    "p1",
    actionIntent(entered.gameId, 1, "CUB#0", "cube-p1", "main"),
    211,
  );
  const alternateWaitingResult = await applyIntent(
    foldEvents(p1Main.state, p1Main.events),
    "p1",
    readyIntent(entered.gameId, 1, "p1"),
    221,
  );
  const alternateWaiting = foldEvents(
    alternateWaitingResult.state,
    alternateWaitingResult.events,
  );
  assert.deepEqual(
    projectBattleLogCurrentTurnForViewer(alternateWaiting, "p2"),
    projectBattleLogCurrentTurnForViewer(p1Waiting, "p2"),
  );

  const p2Main = await applyIntent(
    p1Waiting,
    "p2",
    actionIntent(entered.gameId, 1, "CUB#0", "cube-p2", "main"),
    230,
  );
  const resolvedResult = await applyIntent(
    foldEvents(p2Main.state, p2Main.events),
    "p2",
    readyIntent(entered.gameId, 1, "p2"),
    240,
  );
  assert.equal(
    resolvedResult.events.some((event: any) => event.type === "DICE_ROLLED"),
    false,
  );
  const resolved = foldEvents(resolvedResult.state, resolvedResult.events);
  const released = projectBattleLogCurrentTurnForViewer(resolved, undefined);
  assert.equal(released?.diceValue, initial?.diceValue);
  assert.equal(
    released?.buildLinesByPlayerId.p1.includes(`CUB rolled ${p1LockedValue}`),
    true,
  );
});

Deno.test("ordinary charge and targeted Solar lines release together and match archive formatting", () => {
  const scratch = {
    currentTurnCapture: {
      turnNumber: 8,
      diceValue: 5,
      buildAtomsByPlayerId: {},
      battleAtomsByPlayerId: {
        p1: [{
          kind: "charge_action",
          sourceShipDefId: "INT",
          actionLabel: "Damage",
          bucket: 2,
        }],
      },
      savedResourcesByPlayerId: {},
    },
    lastFinalizedTurnNumber: 7,
    archiveCheckpoint: null,
  };
  const state = createState({
    phase: "battle.charge_declaration",
    turnNumber: 8,
    scratch,
  });
  state.gameData.voidShipsByPlayerId = {
    p2: [{ instanceId: "orb-target", shipDefId: "ORB", createdTurn: 2 }],
  };
  state.gameData.ancient = {
    solarLedgerByPlayerId: {
      p1: {
        battleTurnNumber: 8,
        entries: [{
          entryId: "black-hole-targeted",
          order: 0,
          solarPowerId: "SBLA",
          sourceMode: "manual",
          paidEnergy: { green: 0, red: 0, blue: 0 },
          targets: [{ playerId: "p2", shipInstanceId: "orb-target" }],
        }],
      },
    },
  };

  for (const viewerId of ["p1", "p2", "spec"]) {
    const hidden = projectBattleLogCurrentTurnForViewer(state, viewerId);
    assert.deepEqual(hidden?.battleLinesByPlayerId.p1, []);
  }

  const releasedState = setPhase(state, "battle.end_of_turn_resolution");
  const scratchBefore = JSON.stringify(releasedState.battleLogScratch);
  const ledgerBefore = JSON.stringify(releasedState.gameData.ancient);
  const live = projectBattleLogCurrentTurnForViewer(releasedState, "spec");
  assert.deepEqual(live?.battleLinesByPlayerId.p1, [
    "1 x INT Damage",
    "1 x Black Hole destroyed ORB",
  ]);
  assert.deepEqual(
    projectBattleLogCurrentTurnForViewer(releasedState, "p1")
      ?.battleLinesByPlayerId,
    live?.battleLinesByPlayerId,
  );
  assert.deepEqual(
    projectBattleLogCurrentTurnForViewer(releasedState, "p2")
      ?.battleLinesByPlayerId,
    live?.battleLinesByPlayerId,
  );

  const archive = buildBattleLogTurnSummaryFromScratch({
    scratch: releasedState.battleLogScratch,
    finalizedTurnNumber: 8,
    finalizedState: releasedState,
  });
  assert.deepEqual(live?.battleLinesByPlayerId, archive.battleLinesByPlayerId);
  assert.equal(JSON.stringify(releasedState.battleLogScratch), scratchBefore);
  assert.equal(JSON.stringify(releasedState.gameData.ancient), ledgerBefore);
});

Deno.test("public and requester Drawing projections are atomically disjoint", () => {
  const state = createState({
    scratch: {
      currentTurnCapture: buildCapture({
        buildAtomsByPlayerId: {
          p1: [
            { kind: "reroll", sourceShipDefId: "KNO", values: [2, 4] },
            {
              kind: "produced_build",
              shipDefId: "FIG",
              sourceShipDefId: "DRE",
              count: 1,
            },
          ],
          p2: [{ kind: "cube_change", fromValue: 2, toValue: 5 }],
        },
      }),
      lastFinalizedTurnNumber: 3,
      archiveCheckpoint: null,
    },
  });
  const publicProjection = projectBattleLogCurrentTurnPublic(state);
  const requesterProjection = projectBattleLogCurrentTurnRequester(state, "p1");
  assert.deepEqual(publicProjection?.buildLinesByPlayerId, {
    p1: ["KNO rerolled 2 -> 4"],
    p2: ["CUB rolled 5"],
  });
  assert.deepEqual(requesterProjection?.capturedBuildLines, [
    "1 x FIG (DRE)",
  ]);
  assert.deepEqual(publicProjection?.concealedBuildPlayerIds, ["p1", "p2"]);

  const revealed = setPhase(state, "battle.reveal");
  assert.equal(projectBattleLogCurrentTurnRequester(revealed, "p1"), null);
  assert.deepEqual(
    projectBattleLogCurrentTurnPublic(revealed)?.buildLinesByPlayerId.p1,
    ["KNO rerolled 2 -> 4", "1 x FIG (DRE)"],
  );
});
