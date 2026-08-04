import assert from "node:assert/strict";
import { DEFAULT_PLAYER_MAX_HEALTH } from "../../../engine_shared/maximumHealth.ts";
import type {
  AncientSolarLedgerEntry,
  AncientSolarPowerId,
} from "../../../engine/state/GameStateTypes.ts";
import {
  appendBattleLogTurnSummaryIdempotently,
  buildBattleLogTurnSummaryFromScratch,
  createBattleLogBattleCaptureEventsFromResolution,
  foldBattleLogCaptureEventsIntoScratch,
  normalizeBattleLogHistoryStore,
} from "../../../engine/state/battleLogHistory.ts";

function solarLedgerEntry(
  solarPowerId: AncientSolarPowerId,
  order: number,
  overrides: Partial<AncientSolarLedgerEntry> = {},
): AncientSolarLedgerEntry {
  return {
    entryId: `solar-entry-${order}`,
    order,
    solarPowerId,
    sourceMode: "manual",
    paidEnergy: { green: 0, red: 0, blue: 0 },
    ...overrides,
  };
}

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

Deno.test("accepted charge actions are captured once only during final Declaration", () => {
  const resolution = {
    stateBeforeResolution: {
      gameData: { ships: { p1: [], p2: [] } },
    },
    turnNumber: 6,
    playerId: "p1",
    choiceId: "damage",
    effects: [{
      kind: "Damage",
      amount: 5,
      targetPlayerId: "p2",
      timing: "end_of_turn",
      source: {
        type: "ship",
        playerId: "p1",
        shipDefId: "INT",
        shipInstanceId: "p1-int",
      },
    }],
    effectEvents: [],
  };
  const declarationEvents = createBattleLogBattleCaptureEventsFromResolution({
    ...resolution,
    phaseKey: "battle.charge_declaration",
  } as any);
  const outsideDeclaration = createBattleLogBattleCaptureEventsFromResolution({
    ...resolution,
    phaseKey: "battle.end_of_turn_resolution",
  } as any);

  assert.deepEqual(declarationEvents, [{
    type: "BATTLE_LOG_CAPTURE_BATTLE_CHARGE_ACTION",
    turnNumber: 6,
    playerId: "p1",
    sourceShipDefId: "INT",
    actionLabel: "Damage",
  }]);
  assert.deepEqual(outsideDeclaration, []);

  const scratch = foldBattleLogCaptureEventsIntoScratch(
    { currentTurnCapture: null, lastFinalizedTurnNumber: 5 },
    declarationEvents,
  );
  assert.equal(
    scratch.currentTurnCapture?.battleAtomsByPlayerId.p1.length,
    1,
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

Deno.test("completed-turn Solar ledger appends canonical action-only Battle lines in authoritative order", () => {
  const scratch: any = {
      currentTurnCapture: {
        turnNumber: 8,
        diceValue: 5,
        buildAtomsByPlayerId: {
          p1: [{
            kind: "produced_build" as const,
            shipDefId: "CUB",
            sourceShipDefId: "SSIM",
            count: 1,
          }],
        },
        battleAtomsByPlayerId: {
          p1: [{
            kind: "destroy",
            sourceShipDefId: "GUA",
            targetShipDefIds: ["BUG"],
            bucket: 1,
          }, {
            kind: "steal",
            sourceShipDefId: "DOM",
            targetShipDefIds: ["CAR", "FIG"],
            bucket: 1,
          }, {
            kind: "charge_action",
            sourceShipDefId: "INT",
            actionLabel: "Heal",
            bucket: 2,
          }, {
            kind: "frigate_hit",
            bucket: 2,
          }],
        },
        savedResourcesByPlayerId: {},
      },
      lastFinalizedTurnNumber: 7,
    };
  const finalizedState = {
      status: "active",
      players: [{
        id: "p1",
        name: "Ancient Player",
        role: "player",
        health: 35,
        lines: 2,
        joiningLines: 0,
      }, {
        id: "p2",
        name: "Opponent",
        role: "player",
        health: 21,
        lines: 4,
        joiningLines: 1,
      }],
      gameData: {
        turnNumber: 8,
        ships: {
          p1: [],
          p2: [{ instanceId: "active-orb", shipDefId: "ORB" }],
        },
        voidShipsByPlayerId: {
          p2: [{ instanceId: "void-def", shipDefId: "DEF" }],
        },
        ancient: {
          solarLedgerByPlayerId: {
            p1: {
              battleTurnNumber: 8,
              entries: [
                solarLedgerEntry("SLIF", 0),
                solarLedgerEntry("SSUP", 1),
                solarLedgerEntry("SLIF", 2, { sourceMode: "autocast" }),
                solarLedgerEntry("SSUP", 3, { sourceMode: "autocast" }),
                solarLedgerEntry("SSIM", 4, {
                  simulacrum: {
                    sourceTargetInstanceId: "car-source",
                    copiedShipDefId: "CAR",
                  },
                }),
                solarLedgerEntry("SSIM", 5, {
                  simulacrum: {
                    sourceTargetInstanceId: "fig-source",
                    copiedShipDefId: "FIG",
                  },
                }),
                solarLedgerEntry("SSIM", 6),
                solarLedgerEntry("SBLA", 7, {
                  targets: [{
                    playerId: "p2",
                    shipInstanceId: "active-orb",
                  }, {
                    playerId: "p2",
                    shipInstanceId: "void-def",
                  }],
                }),
                solarLedgerEntry("SBLA", 8),
                solarLedgerEntry("SBLA", 9, {
                  targets: [{
                    playerId: "p2",
                    shipInstanceId: "missing-target",
                  }, {
                    playerId: "p2",
                    shipInstanceId: "active-orb",
                  }],
                }),
                solarLedgerEntry("SCON", 10),
              ],
            },
            p2: {
              battleTurnNumber: 7,
              entries: [solarLedgerEntry("SCON", 0)],
            },
          },
        },
        lastTurnDamageByPlayerId: { p1: 4, p2: 10 },
        lastTurnHealByPlayerId: { p1: 3, p2: 0 },
        lastTurnNetByPlayerId: { p1: -1, p2: -10 },
        lastTurnDamageDealtBreakdownByPlayerId: {
          p1: [{
            rowKind: "solar_power",
            solarPowerId: "SSUP",
            label: "Stale Supernova",
            count: 2,
            amount: 10,
          }],
        },
      },
    };
  const summary = buildBattleLogTurnSummaryFromScratch({
    scratch,
    finalizedTurnNumber: 8,
    finalizedState,
  });

  assert.deepEqual(summary.buildLinesByPlayerId.p1, [
    "1 x CUB (SSIM)",
  ]);
  assert.deepEqual(summary.battleLinesByPlayerId.p1, [
    "GUA destroys BUG",
    "DOM stole CAR and FIG",
    "1 x INT Heal",
    "1 x FRI Hit",
    "2 x Life",
    "2 x Supernova",
    "1 x Simulacrum (CAR)",
    "1 x Simulacrum (FIG)",
    "1 x Simulacrum",
    "1 x Black Hole destroyed ORB and DEF",
    "1 x Black Hole",
    "1 x Black Hole destroyed ORB",
    "1 x Convert",
  ]);
  assert.deepEqual(summary.battleLinesByPlayerId.p2, []);
  assert.deepEqual(summary.analysisByPlayerId?.p1, {
    damageTaken: 4,
    healReceived: 3,
    netHealthDelta: -1,
    savedLinesEnd: 2,
    savedJoiningLinesEnd: 0,
    damageDealtBreakdown: [{
      rowKind: "solar_power",
      solarPowerId: "SSUP",
      label: "Supernova",
      count: 2,
      amount: 10,
    }],
  });

  const initialStore = {
    gameId: "solar-action-history",
    revision: 0,
    completedTurnCount: 0,
    turns: [],
    currentTurnCapture: null,
  };
  const firstAppend = appendBattleLogTurnSummaryIdempotently(
    initialStore,
    summary,
  );
  const reloadedHistory = JSON.parse(JSON.stringify(firstAppend.historyStore));
  const reloadedScratch = JSON.parse(JSON.stringify(scratch));
  const reloadedFinalizedState = JSON.parse(JSON.stringify(finalizedState));
  const replayedSummary = buildBattleLogTurnSummaryFromScratch({
    scratch: reloadedScratch,
    finalizedTurnNumber: 8,
    finalizedState: reloadedFinalizedState,
  });
  const secondAppend = appendBattleLogTurnSummaryIdempotently(
    reloadedHistory,
    replayedSummary,
  );
  const normalizedOnce = normalizeBattleLogHistoryStore(
    initialStore.gameId,
    secondAppend.historyStore,
  );
  const normalizedTwice = normalizeBattleLogHistoryStore(
    initialStore.gameId,
    normalizedOnce,
  );

  assert.equal(firstAppend.appended, true);
  assert.equal(secondAppend.appended, false);
  const finalizedTurn = secondAppend.historyStore.turns[0];
  const countLine = (lines: string[], expected: string) =>
    lines.filter((line) => line === expected).length;
  assert.equal(countLine(finalizedTurn.buildLinesByPlayerId.p1, "1 x CUB (SSIM)"), 1);
  assert.equal(countLine(finalizedTurn.battleLinesByPlayerId.p1, "2 x Life"), 1);
  assert.equal(
    countLine(finalizedTurn.battleLinesByPlayerId.p1, "1 x Simulacrum (CAR)"),
    1,
  );
  assert.equal(
    countLine(
      finalizedTurn.battleLinesByPlayerId.p1,
      "1 x Black Hole destroyed ORB and DEF",
    ),
    1,
  );
  assert.equal(countLine(finalizedTurn.battleLinesByPlayerId.p1, "1 x Convert"), 1);
  assert.equal(
    finalizedTurn.battleLinesByPlayerId.p1.some((line) =>
      line.includes("Cube") && line.includes("Solar")
    ),
    false,
  );
  assert.equal(
    reloadedFinalizedState.gameData.ancient.solarLedgerByPlayerId.p1.entries
      .filter((entry: any) => entry.sourceMode === "cube").length,
    0,
  );
  assert.deepEqual(
    secondAppend.historyStore.turns[0].battleLinesByPlayerId.p1,
    replayedSummary.battleLinesByPlayerId.p1,
  );
  assert.deepEqual(normalizedTwice, normalizedOnce);
});
