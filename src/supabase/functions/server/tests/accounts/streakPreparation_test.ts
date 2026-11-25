import assert from "node:assert/strict";
import {
  prepareFreshAccountComputerGame,
  prepareParticipantAdoption,
} from "../../accounts/streakPreparation.ts";
import { projectGameStateHead } from "../../routes/game_state_head.ts";
import { gameIdentityFixture } from "../routes/game_identity_fixture.ts";
import { createFreshComputerGameData } from "../../routes/computer_game_factory.ts";

const accountId = "00000000-0000-4000-8000-000000000001";
Deno.test("account preparation matches actual guest creation value, head and history", async () => {
  const OriginalDate = Date, fixed = Date.parse("2026-11-24T12:00:00Z");
  class FixedDate extends OriginalDate {
    constructor(value?: string | number) {
      super(value ?? fixed);
    }
    static override now() {
      return fixed;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
  try {
    for (const timed of [false, true]) {
      for (const count of [0, 17]) {
        const f = gameIdentityFixture({ mode: "off" });
        const response = await f.request("/create-computer-game", {
          playerName: "Pilot1",
          timed,
          minutes: 10,
          incrementSeconds: 5,
          winStreakCount: count,
        });
        assert.equal(response.status, 200);
        const { gameId } = await response.json();
        const guest = structuredClone(f.state(gameId));
        const prepared = prepareFreshAccountComputerGame({
          gameId,
          sessionId: "p1",
          displayName: "Pilot1",
          accountId,
          currentCount: count,
          timeControl: guest.gameData.clock?.timeControl ?? null,
        });
        const account = structuredClone(prepared.game.value);
        delete account.players[0].accountId;
        assert.deepEqual(account, guest);
        const head = projectGameStateHead(guest);
        assert.ok(head.ok);
        assert.deepEqual(prepared.game.game_head, head.head);
        assert.equal(prepared.game.key, `game_${gameId}`);
        assert.deepEqual(prepared.history, {
          key: `game_history_${gameId}`,
          value: f.persistence.store.get(`game_history_${gameId}`),
        });
        assert.equal(
          prepared.game.value.gameData.winStreakBonus.appliedCount,
          count,
        );
      }
    }
  } finally {
    globalThis.Date = OriginalDate;
  }
});
Deno.test("adoption prepares an immutable participant-only CAS and matching head", () => {
  const original = createFreshComputerGameData(
    "GUEST1",
    "p1",
    "Guest",
    null,
    25,
  );
  const saved = structuredClone(original);
  const prepared = prepareParticipantAdoption(original, "p1", accountId);
  assert.deepEqual(original, saved);
  assert.equal(prepared.expectedRevision, 1);
  const state = structuredClone(prepared.update!.value);
  assert.equal(state.players[0].accountId, accountId);
  delete state.players[0].accountId;
  state.stateRevision = 1;
  assert.deepEqual(state, original);
  const projected = projectGameStateHead(prepared.update!.value);
  assert.ok(projected.ok);
  assert.deepEqual(prepared.update!.game_head, projected.head);
  const legacy = structuredClone(original);
  delete legacy.stateRevision;
  const adoptedLegacy = prepareParticipantAdoption(legacy, "p1", accountId);
  assert.equal(adoptedLegacy.expectedRevision, null);
  assert.equal(adoptedLegacy.update!.value.stateRevision, 2);
  for (
    const game of [{ ...original, stateRevision: null }, {
      ...original,
      stateRevision: "1",
    }]
  ) {
    assert.throws(() => prepareParticipantAdoption(game, "p1", accountId), {
      code: "STREAK_CONFLICT",
    });
  }
  assert.throws(
    () => prepareParticipantAdoption(original, "other", accountId),
    { code: "STREAK_SEAT_FORBIDDEN" },
  );
  const owned = structuredClone(original);
  owned.players[0].accountId = accountId;
  assert.throws(() => prepareParticipantAdoption(owned, "p1", accountId), {
    code: "STREAK_SEAT_FORBIDDEN",
  });
});
