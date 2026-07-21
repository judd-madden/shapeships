import assert from "node:assert/strict";
import {
  DEFAULT_PLAYER_MAX_HEALTH,
  getPlayerMaxHealth,
} from "./maximumHealth.ts";
import { resolvePhase } from "./resolve/resolvePhase.ts";

function createState(args?: {
  p1Faction?: string;
  p1Health?: number;
  p1Ships?: any[];
  p2Faction?: string;
  p2Health?: number;
  p2Ships?: any[];
  quantumMysticMarkerByInstanceId?: Record<string, unknown>;
}) {
  return {
    gameId: "maximum-health-test",
    status: "active",
    players: [
      {
        id: "p1",
        role: "player",
        faction: args?.p1Faction ?? "ancient",
        health: args?.p1Health ?? 25,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: "p2",
        role: "player",
        faction: args?.p2Faction ?? "human",
        health: args?.p2Health ?? 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 3,
      ships: {
        p1: args?.p1Ships ?? [],
        p2: args?.p2Ships ?? [],
      },
      turnData: { turnNumber: 3 },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: {},
        quantumMysticRevealByInstanceId:
          args?.quantumMysticMarkerByInstanceId ?? {},
      },
    },
  } as any;
}

Deno.test("maximum health defaults to 35 across player factions", () => {
  const state = createState({
    p1Faction: "ancient",
    p2Faction: "xenite",
  });

  assert.equal(
    getPlayerMaxHealth(state, "p1"),
    DEFAULT_PLAYER_MAX_HEALTH,
  );
  assert.equal(
    getPlayerMaxHealth(state, "p2"),
    DEFAULT_PLAYER_MAX_HEALTH,
  );
});

Deno.test("RED sets its owner to derived maximum health through resolvePhase", () => {
  const state = createState({
    p1Health: -4,
    p1Ships: [{
      instanceId: "red-1",
      shipDefId: "RED",
      createdTurn: 3,
    }],
  });

  const result = resolvePhase(state, "build.end_of_build");

  assert.equal(
    result.state.players.find((player: any) => player.id === "p1")?.health,
    DEFAULT_PLAYER_MAX_HEALTH,
  );
  assert.equal(
    result.state.gameData.lastTurnHealByPlayerId,
    undefined,
  );
});

Deno.test("end-of-turn healing and final clamp use derived player maximums", () => {
  const state = createState({
    p1Health: 34,
    p2Health: 41,
    p1Ships: [{
      instanceId: "qua-1",
      shipDefId: "QUA",
      permanentConfiguration: { selectedNumber: 3 },
    }],
    quantumMysticMarkerByInstanceId: {
      "qua-1": { battleTurnNumber: 3, controllerPlayerId: "p1" },
    },
  });

  const result = resolvePhase(state, "battle.end_of_turn_resolution");
  const p1 = result.state.players.find((player: any) => player.id === "p1");
  const p2 = result.state.players.find((player: any) => player.id === "p2");

  assert.equal(p1?.health, DEFAULT_PLAYER_MAX_HEALTH);
  assert.equal(p2?.health, DEFAULT_PLAYER_MAX_HEALTH);
  assert.equal(result.state.gameData.lastTurnHealByPlayerId?.p1, 5);
  assert.equal(result.state.gameData.lastTurnNetByPlayerId?.p1, 1);
});
