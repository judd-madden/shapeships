import assert from "node:assert/strict";
import { DEFAULT_PLAYER_MAX_HEALTH } from "../../engine_shared/maximumHealth.ts";
import {
  buildBattleLogTurnSummaryFromScratch,
  normalizeBattleLogHistoryStore,
} from "./battleLogHistory.ts";

Deno.test("new battle history summaries derive maximum health at turn end", () => {
  const summary = buildBattleLogTurnSummaryFromScratch({
    scratch: {
      currentTurnCapture: {
        turnNumber: 4,
        diceValue: 6,
        buildAtomsByPlayerId: {},
        battleAtomsByPlayerId: {},
        savedResourcesByPlayerId: {},
      },
      lastFinalizedTurnNumber: 3,
    },
    finalizedTurnNumber: 4,
    finalizedState: {
      status: "active",
      players: [{
        id: "p1",
        name: "Player One",
        role: "player",
        health: 29,
        lines: 7,
        joiningLines: 2,
      }],
      gameData: {
        turnNumber: 4,
        ships: { p1: [{ instanceId: "spi-1", shipDefId: "SPI" }] },
        lastTurnDamageByPlayerId: { p1: 4 },
        lastTurnHealByPlayerId: { p1: 8 },
        lastTurnNetByPlayerId: { p1: 4 },
      },
    },
  });

  assert.deepEqual(summary.players, [{
    playerId: "p1",
    name: "Player One",
    healthEnd: 29,
    maxHealthEnd: 40,
    healthDelta: 4,
    fleetValueEnd: 6,
  }]);
  assert.deepEqual(summary.analysisByPlayerId?.p1, {
    damageTaken: 4,
    healReceived: 8,
    netHealthDelta: 4,
    savedLinesEnd: 7,
    savedJoiningLinesEnd: 2,
  });
});

Deno.test("legacy history normalizes maximum health without changing summary data", () => {
  const normalized = normalizeBattleLogHistoryStore("history-test", {
    gameId: "history-test",
    revision: 2,
    completedTurnCount: 1,
    turns: [{
      turnNumber: 3,
      diceValue: 5,
      players: [{
        playerId: "p1",
        name: "Player One",
        healthEnd: 27,
        healthDelta: -3,
        fleetValueEnd: 18,
      }],
      buildLinesByPlayerId: { p1: ["DEF"] },
      battleLinesByPlayerId: { p1: ["2 Damage"] },
      analysisByPlayerId: {
        p1: {
          damageTaken: 3,
          healReceived: 0,
          netHealthDelta: -3,
          savedLinesEnd: 4,
          savedJoiningLinesEnd: 1,
        },
      },
    }],
    currentTurnCapture: null,
  });

  assert.deepEqual(normalized.turns[0].players[0], {
    playerId: "p1",
    name: "Player One",
    healthEnd: 27,
    maxHealthEnd: DEFAULT_PLAYER_MAX_HEALTH,
    healthDelta: -3,
    fleetValueEnd: 18,
  });
  assert.deepEqual(normalized.turns[0].buildLinesByPlayerId, {
    p1: ["DEF"],
  });
  assert.deepEqual(normalized.turns[0].battleLinesByPlayerId, {
    p1: ["2 Damage"],
  });
  assert.deepEqual(normalized.turns[0].analysisByPlayerId?.p1, {
    damageTaken: 3,
    healReceived: 0,
    netHealthDelta: -3,
    savedLinesEnd: 4,
    savedJoiningLinesEnd: 1,
    damageDealtBreakdown: undefined,
    healingReceivedBreakdown: undefined,
  });
});

Deno.test("non-finite stored maximum health normalizes to the default", () => {
  const normalized = normalizeBattleLogHistoryStore("history-test", {
    turns: [{
      turnNumber: 1,
      diceValue: null,
      players: [{
        playerId: "p1",
        name: "Player One",
        healthEnd: 25,
        maxHealthEnd: Number.NaN,
        healthDelta: 0,
        fleetValueEnd: 0,
      }],
      buildLinesByPlayerId: {},
      battleLinesByPlayerId: {},
    }],
  });

  assert.equal(
    normalized.turns[0].players[0].maxHealthEnd,
    DEFAULT_PLAYER_MAX_HEALTH,
  );
});
