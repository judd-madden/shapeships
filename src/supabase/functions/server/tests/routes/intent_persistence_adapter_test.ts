import assert from 'node:assert/strict';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createIntentPersistence } from '../../routes/intent_persistence.ts';

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

Deno.test('pinned client constructs distinct exact valid and missing revision filters', async () => {
  const fixture = createRecordingClient([[{ key: 'game_valid' }], []]);
  const persistence = createIntentPersistence(fixture.client);

  assert.deepEqual(await persistence.conditionalUpdate({
    key: 'game_valid',
    value: { stateRevision: 6 },
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 5 },
  }), { status: 'updated' });
  assert.deepEqual(await persistence.conditionalUpdate({
    key: 'game_missing',
    value: { stateRevision: 2 },
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
    value: { stateRevision: 2 },
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  })).status, 'updated');
  assert.equal((await persistence.conditionalUpdate({
    key: 'game_1',
    value: { stateRevision: 2 },
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
    value: { stateRevision: 2 },
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
    value: { stateRevision: 2 },
    revisionField: 'stateRevision',
    expected: { kind: 'valid', revision: 1 },
  });
  assert.equal(invariant.status, 'error');
});
