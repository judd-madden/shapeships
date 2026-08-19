import assert from "node:assert/strict";
import { accrueClocks, clocksAreLive } from "../../../engine/clock/clock.ts";
import {
  applyIntent,
  type IntentRequest,
} from "../../../engine/intent/IntentReducer.ts";
import { RejectionCode } from "../../../engine/intent/IntentTypes.ts";
import { validateReveal } from "../../../engine/intent/Hash.ts";
import { runBotsUntilSettled } from "../../../engine/bot/botRunner.ts";
import type { MissionChallengeAssignment } from "../../../engine/mission/MissionChallenge.ts";
import { getMissionPool } from "../../../engine/mission/MissionStories.ts";
import { normalizeAncientGameState } from "../../../engine/state/ancientState.ts";

function setupComputerState(
  args: { assigned?: MissionChallengeAssignment; speciesSet?: boolean } = {},
) {
  const speciesSet = args.speciesSet ?? false;
  const state = {
    gameId: "mission-intent-game",
    status: "active",
    currentPhase: "setup",
    currentSubPhase: "species_selection",
    turnNumber: 0,
    players: [
      {
        id: "human",
        name: "Human",
        role: "player",
        faction: speciesSet ? "human" : null,
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: "bot",
        name: "Computer",
        role: "player",
        faction: speciesSet ? "xenite" : null,
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      human: { kind: "human" },
      bot: {
        kind: "bot",
        speciesId: speciesSet ? "XEN" : null,
        chosenPlanId: null,
      },
    },
    gameData: {
      turnNumber: 0,
      currentPhase: "setup",
      currentSubPhase: "species_selection",
      phaseReadiness: [],
      ships: { human: [], bot: [] },
      turnData: {
        turnNumber: 0,
        currentMajorPhase: "setup",
        currentSubPhase: "species_selection",
        commitments: {},
      },
    },
    actions: [],
    ...(args.assigned ? { missionChallengeAssignment: args.assigned } : {}),
  };
  return normalizeAncientGameState(state).state;
}

function setupMultiplayerState() {
  const state = setupComputerState();
  state.controllersByPlayerId = {
    human: { kind: "human" },
    bot: { kind: "human" },
  } as any;
  return state;
}

function pendingGameState(
  args: { timed?: boolean; introPending?: boolean } = {},
) {
  const assignment: MissionChallengeAssignment = {
    playerId: "human",
    missionId: "mission-human-v-xenite-save-colonies",
    challenge: { shipDefId: "DEF", condition: "with" },
    introPending: args.introPending ?? true,
  };
  return {
    gameId: "mission-pending-game",
    status: "active",
    currentPhase: "build",
    currentSubPhase: "drawing",
    turnNumber: 1,
    players: [
      {
        id: "human",
        name: "Human",
        role: "player",
        faction: "human",
        health: 25,
        lines: 10,
        joiningLines: 0,
      },
      {
        id: "bot",
        name: "Computer",
        role: "player",
        faction: "xenite",
        health: 25,
        lines: 10,
        joiningLines: 0,
      },
      {
        id: "spectator",
        name: "Spectator",
        role: "spectator",
        faction: null,
        health: 0,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      human: { kind: "human" },
      bot: { kind: "bot", speciesId: "XEN", chosenPlanId: null },
    },
    missionChallengeAssignment: assignment,
    gameData: {
      turnNumber: 1,
      currentPhase: "build",
      currentSubPhase: "drawing",
      phaseReadiness: [],
      ships: { human: [], bot: [] },
      ...(args.timed
        ? {
          clock: {
            timeControl: { baseMs: 60_000, incrementMs: 0 },
            remainingMsByPlayerId: { human: 60_000, bot: 60_000 },
            lastUpdateAtMs: 1_000,
            incrementAppliedTurnByPlayerId: {},
          },
        }
        : {}),
      turnData: {
        turnNumber: 1,
        currentMajorPhase: "build",
        currentSubPhase: "drawing",
        commitments: {},
      },
    },
    actions: [],
  };
}

function intent(
  intentType: IntentRequest["intentType"],
  payload: unknown = {},
): IntentRequest {
  return {
    gameId: "mission-pending-game",
    intentType,
    turnNumber: 1,
    payload,
    nonce: `nonce-${intentType}`,
  };
}

Deno.test("computer species resolution assigns before normal phase progression", async () => {
  const result = await applyIntent(
    setupComputerState(),
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: { species: "human", botSpecies: "xenite" },
      nonce: "species-nonce",
    },
    1_000,
  );

  assert.equal(result.ok, true);
  assert.equal(result.state.missionChallengeAssignment?.playerId, "human");
  assert.equal(result.state.missionChallengeAssignment?.introPending, true);
  assert.notEqual(result.state.gameData.currentPhase, "mission");
  assert.notEqual(result.state.gameData.currentSubPhase, "mission");
  assert.equal(
    result.state.players.find((player: any) => player.id === "bot")?.faction,
    "xenite",
  );
});

Deno.test("species submit metadata stays transient and canonical reveal hashing remains valid", async () => {
  const nonce = "canonical-species-nonce";
  const result = await applyIntent(
    setupComputerState(),
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: {
        species: "human",
        botSpecies: "xenite",
        completedMissionIds: { malformed: true },
      },
      nonce,
    },
    1_000,
  );

  assert.equal(result.ok, true);
  const commitment =
    result.state.gameData.turnData.commitments.SPECIES_0.human;
  assert.deepEqual(commitment.revealPayload, {
    species: "human",
    botSpecies: "xenite",
  });
  assert.equal(
    await validateReveal(
      commitment.revealPayload,
      commitment.nonce,
      commitment.commitHash,
    ),
    true,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.state.missionChallengeAssignment,
      "completedMissionIds",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.state, "completedMissionIds"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.state.gameData,
      "completedMissionIds",
    ),
    false,
  );
  assert.equal(
    result.events.some((event: any) =>
      Object.prototype.hasOwnProperty.call(event, "completedMissionIds")
    ),
    false,
  );
});

Deno.test("multiplayer ignores Mission metadata without persisting it", async () => {
  const result = await applyIntent(
    setupMultiplayerState(),
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: {
        species: "human",
        completedMissionIds: ["mission-human-v-human-eliminate-rebels"],
      },
      nonce: "multiplayer-hint",
    },
    1_000,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.state.gameData.turnData.commitments.SPECIES_0.human.revealPayload,
    { species: "human" },
  );
  assert.equal(result.state.missionChallengeAssignment, undefined);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.state, "completedMissionIds"),
    false,
  );
  assert.equal(
    result.events.some((event: any) =>
      Object.prototype.hasOwnProperty.call(event, "completedMissionIds")
    ),
    false,
  );
});

Deno.test("same-species idempotent submission reconstructs a missing assignment and preserves an existing one", async () => {
  const request = {
    gameId: "mission-intent-game",
    intentType: "SPECIES_SUBMIT" as const,
    turnNumber: 0,
    payload: { species: "human", botSpecies: "xenite" },
    nonce: "species-retry",
  };
  const recovered = await applyIntent(
    setupComputerState({ speciesSet: true }),
    "human",
    request,
    1_000,
  );
  assert.equal(recovered.ok, true);
  assert.ok(recovered.state.missionChallengeAssignment);
  const recoveredAck = await applyIntent(
    recovered.state,
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "MISSION_INTRO_ACK",
      turnNumber: 0,
      payload: {},
      nonce: "recovered-ack",
    },
    1_001,
  );
  assert.equal(recoveredAck.ok, true);
  assert.equal(
    recoveredAck.state.missionChallengeAssignment.introPending,
    false,
  );

  const existing: MissionChallengeAssignment = {
    playerId: "human",
    missionId: "preserve-this-assignment",
    challenge: { shipDefId: "CUB", condition: "without" },
    introPending: false,
  };
  const preserved = await applyIntent(
    setupComputerState({ speciesSet: true, assigned: existing }),
    "human",
    request,
    1_000,
  );
  assert.equal(preserved.ok, true);
  assert.strictEqual(preserved.state.missionChallengeAssignment, existing);

  for (const completedMissionIds of [
    [],
    ["mission-human-v-human-eliminate-rebels"],
    [
      "mission-human-v-human-eliminate-rebels",
      "mission-human-v-human-defend-against-pirates",
    ],
  ]) {
    const repeated = await applyIntent(
      preserved.state,
      "human",
      {
        ...request,
        payload: { ...request.payload, completedMissionIds },
      },
      1_001,
    );
    assert.equal(repeated.ok, true);
    assert.strictEqual(repeated.state.missionChallengeAssignment, existing);
  }
});

Deno.test("missing assignment recovery uses one current hint then becomes immutable", async () => {
  const state = setupComputerState({ speciesSet: true });
  state.players.find((player: any) => player.id === "bot")!.faction = "human";
  (state.controllersByPlayerId.bot as any).speciesId = "HUM";
  const pool = getMissionPool("human", "human");

  const recovered = await applyIntent(
    state,
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: {
        species: "human",
        botSpecies: "human",
        completedMissionIds: [pool[0].id],
      },
      nonce: "recovery-first",
    },
    1_000,
  );
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.missionChallengeAssignment.missionId, pool[1].id);
  const recoveredAssignment = recovered.state.missionChallengeAssignment;
  const acknowledged = await applyIntent(
    recovered.state,
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "MISSION_INTRO_ACK",
      turnNumber: 0,
      payload: {},
      nonce: "recovery-ack",
    },
    1_001,
  );
  assert.equal(acknowledged.ok, true);
  assert.equal(
    acknowledged.state.missionChallengeAssignment.missionId,
    recoveredAssignment.missionId,
  );
  assert.deepEqual(
    acknowledged.state.missionChallengeAssignment.challenge,
    recoveredAssignment.challenge,
  );
  const assignment = acknowledged.state.missionChallengeAssignment;

  const repeated = await applyIntent(
    acknowledged.state,
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: {
        species: "human",
        botSpecies: "human",
        completedMissionIds: [pool[1].id],
      },
      nonce: "recovery-second",
    },
    1_002,
  );
  assert.equal(repeated.ok, true, JSON.stringify(repeated.rejected));
  assert.strictEqual(repeated.state.missionChallengeAssignment, assignment);
});

Deno.test("enabled intro gate blocks ordinary human gameplay while preserving narrow exceptions", async () => {
  for (
    const ordinaryIntent of [
      intent("BUILD_SUBMIT", { builds: [] }),
      intent("DECLARE_READY"),
      intent("ACTION", {
        actionType: "power",
        actionId: "INT#0",
        sourceInstanceId: "int-1",
        choiceId: "damage",
      }),
      intent("DRAW_OFFER"),
    ]
  ) {
    const result = await applyIntent(
      pendingGameState(),
      "human",
      ordinaryIntent,
      2_000,
    );
    assert.equal(result.ok, false, ordinaryIntent.intentType);
    assert.equal(
      result.rejected?.code,
      RejectionCode.MISSION_INTRO_PENDING,
      ordinaryIntent.intentType,
    );
  }

  const chat = await applyIntent(
    pendingGameState(),
    "human",
    intent("ACTION", { actionType: "message", content: "hello" }),
    2_000,
  );
  assert.equal(chat.ok, true);

  const surrender = await applyIntent(
    pendingGameState(),
    "human",
    intent("SURRENDER"),
    2_000,
  );
  assert.equal(surrender.ok, true);
  assert.equal(surrender.state.status, "finished");

  const continuation = await applyIntent(
    pendingGameState(),
    "human",
    intent("CONTINUE_PHASE_HOLD"),
    2_000,
  );
  assert.equal(continuation.ok, true);

  const acknowledgement = await applyIntent(
    pendingGameState(),
    "human",
    intent("MISSION_INTRO_ACK"),
    2_000,
  );
  assert.equal(acknowledgement.ok, true);
  assert.equal(
    acknowledgement.state.missionChallengeAssignment.introPending,
    false,
  );
  assert.deepEqual(acknowledgement.state.missionChallengeAssignment.challenge, {
    shipDefId: "DEF",
    condition: "with",
  });
  assert.deepEqual(acknowledgement.state.gameData.phaseReadiness, []);
  assert.equal(acknowledgement.state.gameData.currentPhase, "build");
  assert.equal(acknowledgement.state.gameData.currentSubPhase, "drawing");

  const buildAfterAcknowledgement = await applyIntent(
    acknowledgement.state,
    "human",
    intent("BUILD_SUBMIT", { builds: [] }),
    2_001,
  );
  assert.equal(buildAfterAcknowledgement.ok, false);
  assert.equal(
    buildAfterAcknowledgement.rejected?.code,
    RejectionCode.DRAWING_PRELUDE_INCOMPLETE,
  );
});

Deno.test("acknowledgement is idempotent for the assigned human and unavailable to every other actor", async () => {
  const acknowledgedState = pendingGameState({ introPending: false });
  const repeated = await applyIntent(
    acknowledgedState,
    "human",
    intent("MISSION_INTRO_ACK"),
    2_000,
  );
  assert.equal(repeated.ok, true);
  assert.equal(repeated.state.missionChallengeAssignment.introPending, false);

  for (const playerId of ["bot", "spectator"]) {
    const rejected = await applyIntent(
      pendingGameState(),
      playerId,
      intent("MISSION_INTRO_ACK"),
      2_000,
    );
    assert.equal(rejected.ok, false);
    assert.equal(
      rejected.rejected?.code,
      RejectionCode.MISSION_INTRO_UNAVAILABLE,
    );
  }

  const multiplayer = pendingGameState();
  delete (multiplayer as any).missionChallengeAssignment;
  const unavailable = await applyIntent(
    multiplayer,
    "human",
    intent("MISSION_INTRO_ACK"),
    2_000,
  );
  assert.equal(unavailable.ok, false);
  assert.equal(
    unavailable.rejected?.code,
    RejectionCode.MISSION_INTRO_UNAVAILABLE,
  );
});

Deno.test("enabled intro gate pauses clocks without back-charging and acknowledgement resumes eligibility", () => {
  const pending = pendingGameState({ timed: true });
  assert.equal(pending.missionChallengeAssignment.introPending, true);
  assert.equal(clocksAreLive(pending), false);
  const accrued = accrueClocks(pending, 11_000);
  assert.deepEqual(accrued.gameData.clock.remainingMsByPlayerId, {
    human: 60_000,
    bot: 60_000,
  });
  assert.equal(accrued.gameData.clock.lastUpdateAtMs, 11_000);

  const acknowledged = pendingGameState({ timed: true, introPending: false });
  assert.equal(clocksAreLive(acknowledged), true);
  const resumed = accrueClocks(acknowledged, 11_000);
  assert.deepEqual(resumed.gameData.clock.remainingMsByPlayerId, {
    human: 50_000,
    bot: 50_000,
  });
});

Deno.test("bot gameplay remains available without acknowledging the human Mission intro", async () => {
  const surrender = await applyIntent(
    pendingGameState(),
    "bot",
    intent("SURRENDER"),
    2_000,
  );
  assert.equal(surrender.ok, true);
  assert.equal(surrender.state.winnerPlayerId, "human");

  const speciesResult = await applyIntent(
    setupComputerState(),
    "human",
    {
      gameId: "mission-intent-game",
      intentType: "SPECIES_SUBMIT",
      turnNumber: 0,
      payload: { species: "human", botSpecies: "xenite" },
      nonce: "bot-runner-species",
    },
    1_000,
  );
  const settled = await runBotsUntilSettled({
    state: speciesResult.state,
    nowMs: 1_001,
  });
  assert.ok(settled.botStepsApplied > 0);
  assert.equal(settled.state.missionChallengeAssignment.introPending, true);
});
