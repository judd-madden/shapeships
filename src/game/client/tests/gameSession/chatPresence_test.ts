declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  mapChatEntryToLeftRailMessage,
  normalizeChatEntries,
  normalizeChatEntry,
} from "../../gameSession/chatEntries";

function assertEqual(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

Deno.test("chat normalization preserves structured spectator presence", () => {
  assertDeepEqual(
    normalizeChatEntry({
      id: "presence-1",
      type: "spectator_presence",
      presence: "joined",
      playerId: "spectator-session",
      playerName: "Steven",
      timestamp: 123,
    }),
    {
      id: "presence-1",
      type: "spectator_presence",
      presence: "joined",
      playerId: "spectator-session",
      playerName: "Steven",
      timestamp: 123,
    },
  );

  assertEqual(
    normalizeChatEntry({
      type: "spectator_presence",
      presence: "arrived",
      playerId: "spectator-session",
      playerName: "Steven",
      timestamp: 123,
    }),
    null,
  );
});

Deno.test("chat VM mapping preserves spectator name and presence kind", () => {
  assertDeepEqual(
    mapChatEntryToLeftRailMessage({
      type: "spectator_presence",
      presence: "joined",
      playerId: "spectator-session",
      playerName: "Steven",
      timestamp: 123,
    }),
    {
      type: "spectator_presence",
      presence: "joined",
      playerName: "Steven",
    },
  );
  assertDeepEqual(
    mapChatEntryToLeftRailMessage({
      type: "spectator_presence",
      presence: "left",
      playerId: "spectator-session",
      playerName: "Steven",
      timestamp: 124,
    }),
    {
      type: "spectator_presence",
      presence: "left",
      playerName: "Steven",
    },
  );
});

Deno.test("ordinary chat normalization and VM mapping remain unchanged", () => {
  const entries = normalizeChatEntries([
    {
      type: "message",
      playerId: "p1",
      playerName: "Player One",
      content: "hello",
      timestamp: 1,
    },
    { type: "system", content: "system text", timestamp: 2 },
    {
      type: "rematch_invite",
      playerId: "p2",
      playerName: "Player Two",
      content: "Player Two wants to play again",
      newGameId: "next-game",
      timestamp: 3,
    },
  ]);

  assertDeepEqual(entries.map(mapChatEntryToLeftRailMessage), [
    { type: "player", playerName: "Player One", text: "hello" },
    { type: "system", text: "system text" },
    {
      type: "rematch_invite",
      text: "Player Two wants to play again",
      targetGameId: "next-game",
    },
  ]);
});
