import type { PersistedRevisionToken } from './state_revision.ts';

const KV_TABLE = 'kv_store_825e19ab';

export type PersistenceError = {
  code?: string;
  message: string;
  details?: unknown;
};

export type PersistenceLoadResult =
  | { status: 'found'; value: any }
  | { status: 'missing' }
  | { status: 'error'; error: PersistenceError };

export type ConditionalWriteResult =
  | { status: 'updated' }
  | { status: 'conflict' }
  | { status: 'error'; error: PersistenceError };

export interface IntentPersistence {
  load(key: string): Promise<PersistenceLoadResult>;
  conditionalUpdate(args: {
    key: string;
    value: any;
    revisionField: 'stateRevision' | 'revision';
    expected: PersistedRevisionToken;
  }): Promise<ConditionalWriteResult>;
  insertIfMissing(key: string, value: any): Promise<ConditionalWriteResult>;
}

function toPersistenceError(error: any): PersistenceError {
  return {
    code: typeof error?.code === 'string' ? error.code : undefined,
    message: typeof error?.message === 'string'
      ? error.message
      : 'Unknown persistence error',
    details: error?.details,
  };
}

function classifyReturnedRow(
  data: any,
  key: string,
): ConditionalWriteResult {
  if (!Array.isArray(data)) {
    return {
      status: 'error',
      error: { message: 'Persistence response did not contain a row array' },
    };
  }
  if (data.length === 0) return { status: 'conflict' };
  if (data.length === 1 && data[0]?.key === key) return { status: 'updated' };
  return {
    status: 'error',
    error: {
      message: `Persistence response returned ${data.length} unexpected rows`,
    },
  };
}

export function createIntentPersistence(supabase: any): IntentPersistence {
  return {
    async load(key: string): Promise<PersistenceLoadResult> {
      const { data, error } = await supabase
        .from(KV_TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error) return { status: 'error', error: toPersistenceError(error) };
      if (!data) return { status: 'missing' };
      return { status: 'found', value: data.value };
    },

    async conditionalUpdate(args): Promise<ConditionalWriteResult> {
      if (args.expected.kind === 'invalid') {
        return {
          status: 'error',
          error: { message: 'Invalid persisted revision token' },
        };
      }

      let query = supabase
        .from(KV_TABLE)
        .update({ value: args.value })
        .eq('key', args.key);

      const revisionPath = `value->${args.revisionField}`;
      // JSONB `->` yields SQL NULL for an absent property, while an explicit
      // JSON null remains a JSONB value. PostgREST `is.null` therefore targets
      // only the genuinely missing token; the pinned-client URL is locked by
      // the adapter test.
      query = args.expected.kind === 'valid'
        ? query.eq(revisionPath, args.expected.revision)
        : query.is(revisionPath, null);

      const { data, error } = await query.select('key');
      if (error) return { status: 'error', error: toPersistenceError(error) };
      return classifyReturnedRow(data, args.key);
    },

    async insertIfMissing(key: string, value: any): Promise<ConditionalWriteResult> {
      const { data, error } = await supabase
        .from(KV_TABLE)
        .insert({ key, value })
        .select('key');

      if (error) {
        if (error.code === '23505') return { status: 'conflict' };
        return { status: 'error', error: toPersistenceError(error) };
      }
      return classifyReturnedRow(data, key);
    },
  };
}
