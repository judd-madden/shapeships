import assert from 'node:assert/strict';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createIntentPersistence } from '../../routes/intent_persistence.ts';
import { projectGameStateHead } from '../../routes/game_state_head.ts';

type RecordedRequest = {
  url: URL;
  method: string;
  body: string;
};

function createRecordingClient(responseBodies: unknown[]) {
  const requests: RecordedRequest[] = [];
  const bodies = [...responseBodies];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({
      url: new URL(request.url),
      method: request.method,
      body: await request.text(),
    });
    const body = bodies.shift() ?? [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createClient('https://example.supabase.co', 'test-key', {
    global: { fetch },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return { client, requests };
}

function canonicalState(gameId: string, stateRevision: number) {
  return {
    gameId,
    stateRevision,
    status: 'active',
    turnNumber: 1,
    players: [
      { id: 'p1', role: 'player', faction: 'human' },
      { id: 'p2', role: 'player', faction: 'xenite' },
    ],
    gameData: {
      turnNumber: 1,
      currentPhase: 'build',
      currentSubPhase: 'dice_roll',
      phaseReadiness: [],
      turnData: {
        currentMajorPhase: 'build',
        currentSubPhase: 'dice_roll',
      },
    },
  };
}

Deno.test('pinned client constructs distinct exact valid and missing revision filters', async () => {
  const fixture = createRecordingClient([[{ key: 'game_valid' }], []]);
  const persistence = createIntentPersistence(fixture.client);

  assert.deepEqual(await persistence.conditionalUpdate({
    key: 'game_valid',
    value: canonicalState('valid', 6),
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 5 },
  }), { status: 'updated' });
  assert.deepEqual(await persistence.conditionalUpdate({
    key: 'game_missing',
    value: canonicalState('missing', 2),
    revisionField: 'stateRevision',
    expected: { kind: 'missing' },
  }), { status: 'conflict' });

  assert.equal(fixture.requests[0].method, 'PATCH');
  assert.equal(
    fixture.requests[0].url.searchParams.get('value->stateRevision'),
    'eq.5',
  );
  assert.equal(
    fixture.requests[1].url.searchParams.get('value->stateRevision'),
    'is.null',
  );
  assert.notEqual(
    fixture.requests[1].url.searchParams.get('value->stateRevision'),
    'eq.null',
    'missing-property comparison must not be JSON-null equality',
  );
});

Deno.test('adapter distinguishes returned row, zero-row conflict, and database error', async () => {
  const fixture = createRecordingClient([[{ key: 'game_1' }], []]);
  const persistence = createIntentPersistence(fixture.client);

  assert.equal((await persistence.conditionalUpdate({
    key: 'game_1',
    value: canonicalState('1', 2),
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  })).status, 'updated');
  assert.equal((await persistence.conditionalUpdate({
    key: 'game_1',
    value: canonicalState('1', 2),
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  })).status, 'conflict');

  const errorClient = createClient('https://example.supabase.co', 'test-key', {
    global: {
      fetch: async () => new Response(JSON.stringify({
        code: 'XX000',
        message: 'database failed',
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const failed = await createIntentPersistence(errorClient).conditionalUpdate({
    key: 'game_1',
    value: canonicalState('1', 2),
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  });
  assert.equal(failed.status, 'error');

  const invariantFixture = createRecordingClient([[
    { key: 'game_1' },
    { key: 'game_1' },
  ]]);
  const invariant = await createIntentPersistence(
    invariantFixture.client,
  ).conditionalUpdate({
    key: 'game_1',
    value: canonicalState('1', 2),
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  });
  assert.equal(invariant.status, 'error');
});

Deno.test('canonical inserts and updates atomically include a projected game head', async () => {
  const fixture = createRecordingClient([
    [{ key: 'game_inserted' }],
    [{ key: 'game_updated' }],
  ]);
  const persistence = createIntentPersistence(fixture.client);
  const inserted = canonicalState('inserted', 1);
  const updated = canonicalState('updated', 8);

  assert.equal(
    (await persistence.insertIfMissing('game_inserted', inserted)).status,
    'updated',
  );
  assert.equal((await persistence.conditionalUpdate({
    key: 'game_updated',
    value: updated,
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 7 },
  })).status, 'updated');

  const insertBody = JSON.parse(fixture.requests[0].body);
  const insertedRow = Array.isArray(insertBody) ? insertBody[0] : insertBody;
  assert.deepEqual(insertedRow.value, inserted);
  assert.equal(insertedRow.game_head.gameId, 'inserted');
  assert.equal(insertedRow.game_head.stateRevision, 1);

  const updateBody = JSON.parse(fixture.requests[1].body);
  assert.deepEqual(updateBody.value, updated);
  assert.equal(updateBody.game_head.gameId, 'updated');
  assert.equal(updateBody.game_head.stateRevision, 8);
  assert.equal(
    fixture.requests[1].url.searchParams.get('value->stateRevision'),
    'eq.7',
  );
});

Deno.test('canonical projection and key invariant failures issue no database request', async () => {
  const fixture = createRecordingClient([]);
  const persistence = createIntentPersistence(fixture.client);

  const mismatchedUpdate = await persistence.conditionalUpdate({
    key: 'game_wrong',
    value: canonicalState('right', 2),
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  });
  assert.equal(mismatchedUpdate.status, 'error');

  const malformedUpdate = await persistence.conditionalUpdate({
    key: 'game_broken',
    value: { gameId: 'broken', stateRevision: 2, status: 'active' },
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  });
  assert.equal(malformedUpdate.status, 'error');

  const mismatchedInsert = await persistence.insertIfMissing(
    'game_wrong-insert',
    canonicalState('right-insert', 1),
  );
  assert.equal(mismatchedInsert.status, 'error');
  assert.equal(fixture.requests.length, 0);
});

Deno.test('history writes remain headless while head reads and fills touch only game_head', async () => {
  const projected = projectGameStateHead(canonicalState('head', 4));
  assert.equal(projected.ok, true);

  const fixture = createRecordingClient([
    [{ key: 'game_history_head' }],
    [{ key: 'game_history_insert' }],
    { game_head: projected.head },
    [{ key: 'game_head' }],
  ]);
  const persistence = createIntentPersistence(fixture.client);

  assert.equal((await persistence.conditionalUpdate({
    key: 'game_history_head',
    value: { gameId: 'head', revision: 3, entries: [] },
    revisionField: 'revision',
    expected: { kind: 'valid', revision: 2 },
  })).status, 'updated');
  const historyBody = JSON.parse(fixture.requests[0].body);
  assert.equal('game_head' in historyBody, false);

  assert.equal((await persistence.insertIfMissing(
    'game_history_insert',
    { gameId: 'insert', revision: 0, entries: [] },
  )).status, 'updated');
  const historyInsertBody = JSON.parse(fixture.requests[1].body);
  const historyInsertRow = Array.isArray(historyInsertBody)
    ? historyInsertBody[0]
    : historyInsertBody;
  assert.equal('game_head' in historyInsertRow, false);

  const loaded = await persistence.loadGameHead('game_head');
  assert.equal(loaded.status, 'found');
  assert.equal(fixture.requests[2].url.searchParams.get('select'), 'game_head');
  assert.equal(fixture.requests[2].url.searchParams.get('select')?.includes('value'), false);

  assert.equal((await persistence.conditionalUpdateGameHead({
    key: 'game_head',
    gameHead: projected.head,
    expectedStateRevision: 4,
  })).status, 'updated');
  const fillBody = JSON.parse(fixture.requests[3].body);
  assert.deepEqual(Object.keys(fillBody), ['game_head']);
  assert.equal(
    fixture.requests[3].url.searchParams.get('value->stateRevision'),
    'eq.4',
  );
});
