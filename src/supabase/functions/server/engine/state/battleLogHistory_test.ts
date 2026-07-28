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

Deno.test("typed Solar rows survive turn-summary finalization with canonical identity and counts", () => {
  const summary = buildBattleLogTurnSummaryFromScratch({
    scratch: {
      currentTurnCapture: {
        turnNumber: 7,
        diceValue: 4,
        buildAtomsByPlayerId: {},
        battleAtomsByPlayerId: {},
        savedResourcesByPlayerId: {},
      },
      lastFinalizedTurnNumber: 6,
    },
    finalizedTurnNumber: 7,
    finalizedState: {
      status: "active",
      players: [{
        id: "p1",
        name: "Player One",
        role: "player",
        health: 34,
        lines: 3,
        joiningLines: 1,
      }, {
        id: "p2",
        name: "Player Two",
        role: "player",
        health: 22,
        lines: 5,
        joiningLines: 0,
      }],
      gameData: {
        turnNumber: 7,
        ships: {},
        lastTurnDamageByPlayerId: { p1: 6, p2: 18 },
        lastTurnHealByPlayerId: { p1: 4, p2: 0 },
        lastTurnNetByPlayerId: { p1: -2, p2: -18 },
        lastTurnDamageDealtBreakdownByPlayerId: {
          p1: [{
            rowKind: "solar_power",
            solarPowerId: "SSUP",
            label: "Stale Supernova Label",
            count: 2,
            amount: 12,
          }, {
            rowKind: "solar_power",
            solarPowerId: "SSUP",
            label: "Another Stale Label",
            count: 1,
            amount: 6,
          }],
        },
        lastTurnHealingReceivedBreakdownByPlayerId: {
          p1: [{
            rowKind: "solar_power",
            solarPowerId: "SSIP",
            label: "Stale Siphon Label",
            count: 1,
            amount: 4,
          }],
        },
      },
    },
  });

  assert.deepEqual(summary.analysisByPlayerId?.p1, {
    damageTaken: 6,
    healReceived: 4,
    netHealthDelta: -2,
    savedLinesEnd: 3,
    savedJoiningLinesEnd: 1,
    damageDealtBreakdown: [{
      rowKind: "solar_power",
      solarPowerId: "SSUP",
      label: "Supernova",
      count: 3,
      amount: 18,
    }],
    healingReceivedBreakdown: [{
      rowKind: "solar_power",
      solarPowerId: "SSIP",
      label: "Siphon",
      count: 1,
      amount: 4,
    }],
  });
  assert.deepEqual(summary.players, [{
    playerId: "p1",
    name: "Player One",
    healthEnd: 34,
    maxHealthEnd: DEFAULT_PLAYER_MAX_HEALTH,
    healthDelta: -2,
    fleetValueEnd: 0,
  }, {
    playerId: "p2",
    name: "Player Two",
    healthEnd: 22,
    maxHealthEnd: DEFAULT_PLAYER_MAX_HEALTH,
    healthDelta: -18,
    fleetValueEnd: 0,
  }]);
});

Deno.test("history breakdown normalization preserves identity, legacy counts, sorting, and idempotence", () => {
  const gameId = "typed-history-test";
  const input = {
    gameId,
    revision: 4,
    completedTurnCount: 1,
    turns: [{
      turnNumber: 2,
      diceValue: 3,
      players: [{
        playerId: "p1",
        name: "Player One",
        healthEnd: 31,
        maxHealthEnd: 40,
        healthDelta: -1,
        fleetValueEnd: 12,
      }],
      buildLinesByPlayerId: { p1: ["DEF"] },
      battleLinesByPlayerId: { p1: ["1 Damage"] },
      analysisByPlayerId: {
        p1: {
          damageTaken: 1,
          healReceived: 0,
          netHealthDelta: -1,
          savedLinesEnd: 2,
          savedJoiningLinesEnd: 1,
          damageDealtBreakdown: [{
            label: "Legacy Fleet",
            amount: 6,
          }, {
            label: "Legacy Fleet",
            amount: 4,
          }, {
            label: "Solo Legacy",
            amount: 9,
          }, {
            rowKind: "solar_power",
            solarPowerId: "SSTA",
            label: "Old Star Name",
            count: 2,
            amount: 6,
          }, {
            rowKind: "solar_power",
            solarPowerId: "SSTA",
            label: "Different Old Name",
            count: 1,
            amount: 3,
          }, {
            rowKind: "adjustment",
            label: "Star Birth",
            count: 99,
            solarPowerId: "SSTA",
            amount: 2,
          }, {
            rowKind: "solar_power",
            solarPowerId: "INVALID",
            label: "Invalid",
            count: 1,
            amount: 20,
          }, {
            rowKind: "solar_power",
            solarPowerId: "SSUP",
            label: "Invalid Count",
            count: 0,
            amount: 20,
          }, {
            rowKind: "unknown",
            label: "Unknown Kind",
            amount: 20,
          }],
          healingReceivedBreakdown: [{
            rowKind: "ship",
            label: "Beta",
            count: 1,
            amount: 5,
          }, {
            rowKind: "adjustment",
            label: "Alpha",
            amount: 5,
          }],
        },
      },
    }],
    currentTurnCapture: null,
  };

  const once = normalizeBattleLogHistoryStore(gameId, input);
  const twice = normalizeBattleLogHistoryStore(gameId, once);

  assert.deepEqual(once.turns[0].analysisByPlayerId?.p1, {
    damageTaken: 1,
    healReceived: 0,
    netHealthDelta: -1,
    savedLinesEnd: 2,
    savedJoiningLinesEnd: 1,
    damageDealtBreakdown: [{
      rowKind: "ship",
      label: "Legacy Fleet",
      count: 2,
      amount: 10,
    }, {
      rowKind: "ship",
      label: "Solo Legacy",
      count: undefined,
      amount: 9,
    }, {
      rowKind: "solar_power",
      solarPowerId: "SSTA",
      label: "Star Birth",
      count: 3,
      amount: 9,
    }, {
      rowKind: "adjustment",
      label: "Star Birth",
      amount: 2,
    }],
    healingReceivedBreakdown: [{
      rowKind: "adjustment",
      label: "Alpha",
      amount: 5,
    }, {
      rowKind: "ship",
      label: "Beta",
      count: 1,
      amount: 5,
    }],
  });
  assert.deepEqual(once.turns[0].players[0], input.turns[0].players[0]);
  assert.deepEqual(once.turns[0].buildLinesByPlayerId, { p1: ["DEF"] });
  assert.deepEqual(once.turns[0].battleLinesByPlayerId, { p1: ["1 Damage"] });
  assert.deepEqual(twice, once);
});
