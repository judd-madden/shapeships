import assert from 'node:assert/strict';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createIntentPersistence } from '../../routes/intent_persistence.ts';

const runLiveSmokeTest =
  Deno.env.get('PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION') === '1';

const KV_TABLE = 'kv_store_825e19ab';

Deno.test({
  name: 'live PostgREST distinguishes valid, stale, missing, and explicit-null revision tokens',
  ignore: !runLiveSmokeTest,
  async fn() {
    const supabaseUrl = Deno.env.get('PHASE14E0_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get(
      'PHASE14E0_SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Phase 14E0 live integration environment/configuration mismatch: ' +
          'PHASE14E0_SUPABASE_URL and ' +
          'PHASE14E0_SUPABASE_SERVICE_ROLE_KEY are required when ' +
          'PHASE14E0_RUN_LIVE_SUPABASE_INTEGRATION=1.',
      );
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const persistence = createIntentPersistence(client);
    const testScope = crypto.randomUUID();
    const validKey = `__phase14e0_cas_smoke__:${testScope}:valid`;
    const missingKey = `__phase14e0_cas_smoke__:${testScope}:missing`;
    const nullKey = `__phase14e0_cas_smoke__:${testScope}:null`;
    const keys = [validKey, missingKey, nullKey];
    let rowsInserted = false;

    try {
      const { error: insertError } = await client
        .from(KV_TABLE)
        .insert([
          { key: validKey, value: { stateRevision: 5, marker: 'valid' } },
          { key: missingKey, value: { marker: 'missing' } },
          { key: nullKey, value: { stateRevision: null, marker: 'null' } },
        ]);
      if (insertError) {
        throw new Error(
          `Phase 14E0 live integration environment/configuration mismatch: ` +
            `could not insert UUID-scoped rows into the existing ${KV_TABLE} ` +
            `table (${insertError.code ?? 'unknown'}: ${insertError.message}). ` +
            'The test does not create or alter database schema.',
        );
      }
      rowsInserted = true;

      assert.deepEqual(
        await persistence.conditionalUpdate({
          key: validKey,
          value: { stateRevision: 6, marker: 'valid-updated' },
          revisionField: 'stateRevision',
          expected: { kind: 'valid', revision: 5 },
        }),
        { status: 'updated' },
      );

      assert.deepEqual(
        await persistence.conditionalUpdate({
          key: validKey,
          value: { stateRevision: 7, marker: 'stale-must-not-write' },
          revisionField: 'stateRevision',
          expected: { kind: 'valid', revision: 5 },
        }),
        { status: 'conflict' },
      );

      assert.deepEqual(
        await persistence.conditionalUpdate({
          key: missingKey,
          value: { stateRevision: 2, marker: 'missing-updated' },
          revisionField: 'stateRevision',
          expected: { kind: 'missing' },
        }),
        { status: 'updated' },
      );

      assert.deepEqual(
        await persistence.conditionalUpdate({
          key: nullKey,
          value: { stateRevision: 2, marker: 'null-must-not-write' },
          revisionField: 'stateRevision',
          expected: { kind: 'missing' },
        }),
        { status: 'conflict' },
      );

      const { data, error: loadError } = await client
        .from(KV_TABLE)
        .select('key,value')
        .in('key', keys);
      assert.equal(loadError, null);
      const byKey = new Map(data.map((row: any) => [row.key, row.value]));
      assert.deepEqual(byKey.get(validKey), {
        stateRevision: 6,
        marker: 'valid-updated',
      });
      assert.deepEqual(byKey.get(missingKey), {
        stateRevision: 2,
        marker: 'missing-updated',
      });
      assert.deepEqual(byKey.get(nullKey), {
        stateRevision: null,
        marker: 'null',
      });
    } finally {
      if (rowsInserted) {
        for (const key of keys) {
          const { error: deleteError } = await client
            .from(KV_TABLE)
            .delete()
            .eq('key', key);
          assert.equal(
            deleteError,
            null,
            `failed to remove exact smoke-test key ${key}`,
          );
        }

        const { data: remainingRows, error: cleanupLoadError } = await client
          .from(KV_TABLE)
          .select('key')
          .in('key', keys);
        assert.equal(cleanupLoadError, null);
        assert.deepEqual(remainingRows, []);
      }
    }
  },
});
