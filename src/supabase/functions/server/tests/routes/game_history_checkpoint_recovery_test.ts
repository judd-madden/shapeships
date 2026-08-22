import assert from 'node:assert/strict';
import { Hono } from 'npm:hono';
import { registerGameRoutes } from '../../routes/game_routes.ts';

function summary(turnNumber: number, buildLine: string) {
  return {
    turnNumber,
    diceValue: 4,
    players: [{
      playerId: 'p1',
      name: 'One',
      healthEnd: 20,
      maxHealthEnd: 30,
      healthDelta: -1,
      fleetValueEnd: 5,
    }],
    buildLinesByPlayerId: { p1: [buildLine] },
    battleLinesByPlayerId: { p1: ['1 x Frigate hit'] },
  };
}

function createFixture(history: any = null, readErrorKey: string | null = null) {
  const gameId = 'terminal-recovery';
  const checkpointSummary = summary(7, '1 x Scout');
  const store = new Map<string, any>([
    [`game_${gameId}`, {
      gameId,
      players: [{ id: 'p1', role: 'player' }],
      battleLogScratch: {
        currentTurnCapture: null,
        lastFinalizedTurnNumber: 7,
        archiveCheckpoint: {
          finalizedTurnNumber: 7,
          acceptedStateRevision: 12,
          summary: checkpointSummary,
        },
      },
    }],
  ]);
  if (history) store.set(`game_history_${gameId}`, structuredClone(history));
  const writes: Array<{ key: string; value: any }> = [];
  const app = new Hono();
  const persistence = {
    async load(key: string) {
      if (key === readErrorKey) {
        return {
          status: 'error' as const,
          error: { message: 'database unavailable' },
        };
      }
      return store.has(key)
        ? { status: 'found' as const, value: structuredClone(store.get(key)) }
        : { status: 'missing' as const };
    },
    async conditionalUpdate(args: any) {
      const current = store.get(args.key);
      if (!current) return { status: 'conflict' as const };
      const hasRevision = Object.prototype.hasOwnProperty.call(
        current,
        args.revisionField,
      );
      const matches = args.expected.kind === 'missing'
        ? !hasRevision
        : args.expected.kind === 'valid' &&
          current[args.revisionField] === args.expected.revision;
      if (!matches) return { status: 'conflict' as const };
      const value = structuredClone(args.value);
      writes.push({ key: args.key, value });
      store.set(args.key, value);
      return { status: 'updated' as const };
    },
  };
  registerGameRoutes(
    app,
    async (key) => structuredClone(store.get(key)),
    async (key, value) => {
      writes.push({ key, value: structuredClone(value) });
      store.set(key, structuredClone(value));
    },
    async () => ({ sessionId: 'p1' }),
    () => 'unused',
    persistence,
  );
  return { app, gameId, checkpointSummary, store, writes };
}

Deno.test('game-history projects a missing terminal checkpoint in memory with zero writes', async () => {
  const fixture = createFixture();
  const url = `/make-server-825e19ab/game-history/${fixture.gameId}`;

  const first = await fixture.app.request(url);
  const second = await fixture.app.request(url);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstBody = await first.json();
  const secondBody = await second.json();
  assert.deepEqual(firstBody, secondBody);
  assert.equal(firstBody.revision, 1);
  assert.equal(firstBody.completedTurnCount, 1);
  assert.deepEqual(firstBody.turns, [fixture.checkpointSummary]);
  assert.equal(fixture.writes.length, 0);
  assert.equal(fixture.store.has(`game_history_${fixture.gameId}`), false);
});

Deno.test('game-history returns 500 instead of a partial checkpoint-only transcript on history read error', async () => {
  const storedHistory = {
    gameId: 'terminal-recovery',
    revision: 6,
    completedTurnCount: 6,
    turns: Array.from({ length: 6 }, (_, index) =>
      summary(index + 1, `Turn ${index + 1}`)
    ),
    currentTurnCapture: null,
  };
  const historyKey = 'game_history_terminal-recovery';
  const fixture = createFixture(storedHistory, historyKey);
  const response = await fixture.app.request(
    `/make-server-825e19ab/game-history/${fixture.gameId}`,
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error' });
  assert.equal(fixture.writes.length, 0);
  assert.deepEqual(fixture.store.get(historyKey), storedHistory);
});

Deno.test('game-history keeps divergent stored content and remains read-only', async () => {
  const divergent = summary(7, '1 x Destroyer');
  const storedHistory = {
    gameId: 'terminal-recovery',
    revision: 5,
    completedTurnCount: 1,
    turns: [divergent],
    currentTurnCapture: null,
  };
  const fixture = createFixture(storedHistory);
  const response = await fixture.app.request(
    `/make-server-825e19ab/game-history/${fixture.gameId}`,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.revision, 5);
  assert.deepEqual(body.turns, [divergent]);
  assert.equal(fixture.writes.length, 0);
  assert.deepEqual(
    fixture.store.get(`game_history_${fixture.gameId}`),
    storedHistory,
  );
});
