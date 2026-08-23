import type {
  ConditionalWriteResult,
  PersistenceError,
} from "./intent_persistence.ts";

const GAME_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const GAME_ID_LENGTH = 6;
const MAX_UNBIASED_BYTE = Math.floor(256 / GAME_ID_ALPHABET.length) *
  GAME_ID_ALPHABET.length;

export const MAX_GAME_ID_ALLOCATION_ATTEMPTS = 5;

export function generateSecureGameId(): string {
  const randomByte = new Uint8Array(1);
  let gameId = "";

  while (gameId.length < GAME_ID_LENGTH) {
    crypto.getRandomValues(randomByte);
    if (randomByte[0] >= MAX_UNBIASED_BYTE) continue;
    gameId += GAME_ID_ALPHABET[randomByte[0] % GAME_ID_ALPHABET.length];
  }

  return gameId;
}

export type GameIdAllocationResult<T> =
  | { status: "allocated"; gameId: string; gameState: T }
  | { status: "exhausted" }
  | { status: "error"; error: PersistenceError };

export async function allocateGameId<T>(args: {
  generateGameId: () => string;
  createGameState: (gameId: string) => T;
  insertIfMissing: (
    key: string,
    value: T,
  ) => Promise<ConditionalWriteResult>;
}): Promise<GameIdAllocationResult<T>> {
  for (
    let attempt = 0;
    attempt < MAX_GAME_ID_ALLOCATION_ATTEMPTS;
    attempt += 1
  ) {
    const gameId = args.generateGameId();
    const gameState = args.createGameState(gameId);
    const insertResult = await args.insertIfMissing(
      `game_${gameId}`,
      gameState,
    );

    if (insertResult.status === "updated") {
      return { status: "allocated", gameId, gameState };
    }
    if (insertResult.status === "error") {
      return { status: "error", error: insertResult.error };
    }
  }

  return { status: "exhausted" };
}
