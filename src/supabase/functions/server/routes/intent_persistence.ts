import type { PersistedRevisionToken } from './state_revision.ts';
import {
  parsePersistedGameStateHead,
  projectGameStateHead,
  type PersistedGameStateHeadV1,
} from './game_state_head.ts';

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

export interface GameHeadPersistence {
  loadGameHead(key: string): Promise<PersistenceLoadResult>;
  conditionalUpdateGameHead(args: {
    key: string;
    gameHead: PersistedGameStateHeadV1;
    expectedStateRevision: number;
  }): Promise<ConditionalWriteResult>;
}

export type GameStatePersistence = IntentPersistence & GameHeadPersistence;

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

function projectCanonicalGameWrite(
  key: string,
  value: unknown,
):
  | { ok: true; gameHead: PersistedGameStateHeadV1 }
  | { ok: false; error: PersistenceError } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: { message: 'Canonical game state must be an object' },
    };
  }

  const gameId = (value as Record<string, unknown>).gameId;
  if (typeof gameId !== 'string' || key !== `game_${gameId}`) {
    return {
      ok: false,
      error: {
        message: 'Canonical game persistence key does not match state gameId',
      },
    };
  }

  const projected = projectGameStateHead(value);
  if (!projected.ok) {
    return {
      ok: false,
      error: { message: `Canonical game head projection failed: ${projected.error}` },
    };
  }
  return { ok: true, gameHead: projected.head };
}

export function createIntentPersistence(supabase: any): GameStatePersistence {
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

      let updatePayload: { value: any; game_head?: PersistedGameStateHeadV1 } = {
        value: args.value,
      };
      if (args.revisionField === 'stateRevision') {
        const projected = projectCanonicalGameWrite(args.key, args.value);
        if (!projected.ok) return { status: 'error', error: projected.error };
        updatePayload = { value: args.value, game_head: projected.gameHead };
      }

      let query = supabase
        .from(KV_TABLE)
        .update(updatePayload)
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
      let insertPayload: {
        key: string;
        value: any;
        game_head?: PersistedGameStateHeadV1;
      } = { key, value };
      if (value && typeof value === 'object' && !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, 'stateRevision')) {
        const projected = projectCanonicalGameWrite(key, value);
        if (!projected.ok) return { status: 'error', error: projected.error };
        insertPayload = { key, value, game_head: projected.gameHead };
      }

      const { data, error } = await supabase
        .from(KV_TABLE)
        .insert(insertPayload)
        .select('key');

      if (error) {
        if (error.code === '23505') return { status: 'conflict' };
        return { status: 'error', error: toPersistenceError(error) };
      }
      return classifyReturnedRow(data, key);
    },

    async loadGameHead(key: string): Promise<PersistenceLoadResult> {
      const { data, error } = await supabase
        .from(KV_TABLE)
        .select('game_head')
        .eq('key', key)
        .maybeSingle();

      if (error) return { status: 'error', error: toPersistenceError(error) };
      if (!data) return { status: 'missing' };
      return { status: 'found', value: data.game_head };
    },

    async conditionalUpdateGameHead(args): Promise<ConditionalWriteResult> {
      const parsed = parsePersistedGameStateHead(args.gameHead);
      if (!parsed || args.key !== `game_${parsed.gameId}` ||
        parsed.stateRevision !== args.expectedStateRevision) {
        return {
          status: 'error',
          error: { message: 'Invalid conditional game-head update' },
        };
      }

      const { data, error } = await supabase
        .from(KV_TABLE)
        .update({ game_head: parsed })
        .eq('key', args.key)
        .eq('value->stateRevision', args.expectedStateRevision)
        .select('key');
      if (error) return { status: 'error', error: toPersistenceError(error) };
      return classifyReturnedRow(data, args.key);
    },
  };
}
