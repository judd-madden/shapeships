import type { AccountsMode } from "./accountsMode.ts";
import {
  AccountFault,
  type GameIdentityRepository,
  type GameIdentitySnapshot,
  type NameStatus,
} from "./accountRepository.ts";
import { ACCOUNT_ERRORS } from "./accountResponses.ts";
import { nameKeys } from "./nameKeys.ts";
import { tokenDigest } from "./tokens.ts";
import type { GameSession } from "./accountService.ts";

export const GAME_IDENTITY_CACHE_MS = 15_000;
const CACHE_LIMIT = 1024;
const HOUR = 3_600_000;
type Participant = { id: string; name?: string; accountId?: string };
export type ResolvedGameName = { displayName: string; accountId?: string };
export class GameIdentityConflict extends Error {}

export interface GameIdentityRequest {
  resolve(
    input: {
      hint?: unknown;
      source?: Participant;
      bootstrap?: boolean;
      start?: boolean;
    },
  ): Promise<ResolvedGameName | null>;
  seat(participant: Participant): Promise<void>;
}
export interface GameRequestIdentity {
  request(c: any, session: GameSession): GameIdentityRequest;
}
export interface GameIdentityRouteOptions {
  mode?: AccountsMode;
  getResolver?: () => GameRequestIdentity;
}
export function gameIdentityRequest(
  options: GameIdentityRouteOptions,
  c: any,
  session: GameSession,
): GameIdentityRequest {
  if (!options.getResolver) {
    throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  }
  return options.getResolver().request(c, session);
}

export function gameIdentityError(
  c: any,
  error: unknown,
  intent = false,
): Response | null {
  if (error instanceof GameIdentityConflict) {
    const message =
      "Game changed during identity resolution; retry the request";
    return c.json(
      intent
        ? {
          ok: false,
          state: null,
          events: [],
          rejected: { code: "STATE_CONFLICT", message },
        }
        : { error: message },
      409,
    );
  }
  if (!(error instanceof AccountFault)) return null;
  const [status, message] = ACCOUNT_ERRORS[error.code];
  if (error.retryAfterSeconds !== undefined) {
    c.header("Retry-After", String(error.retryAfterSeconds));
  }
  c.header("Cache-Control", "no-store");
  return c.json(
    intent
      ? {
        ok: false,
        state: null,
        events: [],
        rejected: { code: error.code, message },
      }
      : { error: error.code, message },
    status,
  );
}

export function createGameRequestIdentity(deps: {
  mode: Exclude<AccountsMode, "off">;
  getRepository: () => GameIdentityRepository;
  bindName: (
    token: string,
    session: GameSession,
    name: string,
  ) => Promise<string>;
  now?: () => number;
}): GameRequestIdentity {
  const now = deps.now ?? Date.now;
  const identities = new Map<
    string,
    { snapshot: GameIdentitySnapshot; until: number }
  >();
  function put<K, V>(cache: Map<K, V>, key: K, value: V) {
    cache.delete(key);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, value);
  }
  async function database<T>(
    work: (r: GameIdentityRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await work(deps.getRepository());
    } catch (error) {
      if (error instanceof AccountFault) throw error;
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
  }
  return {
    request(c, session) {
      let identityPromise: Promise<GameIdentitySnapshot> | undefined;
      let hash: Uint8Array, identityKey: string;
      let renewal: Promise<void> | undefined;
      let nameCall: {
        key: string;
        result: Promise<NameStatus>;
      } | undefined;
      let sourceFence: string | undefined;
      const raw = c.req.header("X-Account-Token");
      function fence(p: Participant) {
        const value = JSON.stringify([p.id, p.name, p.accountId]);
        if (sourceFence !== undefined && sourceFence !== value) {
          throw new GameIdentityConflict();
        }
        sourceFence = value;
      }
      async function identity(start = false): Promise<GameIdentitySnapshot> {
        return await (identityPromise ??= (async () => {
          if (!raw) throw new AccountFault("ACCOUNT_TOKEN_REQUIRED");
          hash = await tokenDigest(raw);
          identityKey =
            Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("") +
            ":" + session.sessionId;
          const cached = start ? undefined : identities.get(identityKey);
          if (cached && cached.until > now()) return cached.snapshot;
          identities.delete(identityKey);
          const checkedAt = now();
          const snapshot = await database((r) =>
            r.tokenSnapshot(hash, start ? undefined : session.sessionId)
          );
          if (
            !snapshot || snapshot.revokedAt !== null ||
            snapshot.tokenVersion !== snapshot.accountVersion
          ) {
            throw new AccountFault("ACCOUNT_TOKEN_INVALID");
          }
          if (Date.parse(snapshot.expiresAt) <= now()) {
            throw new AccountFault("ACCOUNT_TOKEN_EXPIRED");
          }
          if (snapshot.accountStatus !== "active") {
            throw new AccountFault("ACCOUNT_BLOCKED");
          }
          const l = snapshot.link;
          if (
            !start &&
            (!l || l.detachedAt !== null || l.sessionId !== session.sessionId ||
              l.accountId !== snapshot.account.id ||
              l.tokenId !== snapshot.tokenId)
          ) {
            throw new AccountFault("ACCOUNT_TOKEN_INVALID");
          }
          if (!start) {
            put(identities, identityKey, {
              snapshot,
              until: Math.min(
                checkedAt + GAME_IDENTITY_CACHE_MS,
                Date.parse(snapshot.expiresAt),
              ),
            });
          }
          return snapshot;
        })());
      }
      async function renew(snapshot: GameIdentitySnapshot) {
        if (Date.parse(snapshot.lastUsedAt) >= now() - HOUR) return;
        await (renewal ??= (async () => {
          const result = await database((r) => r.resume(hash)); // Never relink an action.
          snapshot.expiresAt = result.expiresAt;
          snapshot.lastUsedAt = new Date(now()).toISOString();
          const cached = identities.get(identityKey);
          if (cached) {
            cached.until = Math.min(cached.until, Date.parse(result.expiresAt));
          }
        })());
      }
      function status(displayName: string) {
        const key = displayName.toLowerCase();
        if (nameCall && nameCall.key !== key) throw new GameIdentityConflict();
        return (nameCall ??= {
          key,
          result: database((r) => r.nameStatus(displayName)),
        }).result;
      }
      async function authority(p: Participant) {
        fence(p);
        if (deps.mode === "on" && p.accountId) {
          const snapshot = await identity();
          if (snapshot.account.id !== p.accountId) {
            throw new AccountFault("ACCOUNT_TOKEN_INVALID");
          }
          return snapshot;
        }
      }
      return {
        async seat(p) {
          const snapshot = await authority(p);
          if (snapshot) await renew(snapshot);
        },
        async resolve({ hint, source, bootstrap, start }) {
          if (source) await authority(source);
          const snapshot = deps.mode === "on" && raw !== undefined
            ? await identity(start)
            : undefined;
          const provenance = deps.mode === "names-only"
            ? source?.accountId
            : undefined;
          if (snapshot && !source && hint !== undefined) {
            if (
              nameKeys(hint).nameKey !==
                snapshot.account.displayName.toLowerCase()
            ) {
              throw new AccountFault("INVALID_REQUEST");
            }
          }
          const bound = session.displayName;
          const value = snapshot?.account.displayName ??
            (provenance
              ? source?.name
              : bound || (hint !== undefined ? hint : source?.name));
          if (value === undefined || value === null) {
            if (bootstrap && hint === undefined) return null;
            throw new AccountFault("INVALID_NAME");
          }
          const chosen = nameKeys(
            typeof value === "string" && !snapshot ? value.trim() : value,
          ).displayName;
          if (start && snapshot) {
            const linked = await database((r) =>
              r.resume(hash, session.sessionId)
            );
            return {
              displayName: linked.account.displayName,
              accountId: linked.account.id,
            };
          }
          const verdict = await status(chosen); // Fresh for assignments; one RPC per request.
          if (verdict.outcome === "banned") {
            throw new AccountFault("NAME_BANNED");
          }
          if (!snapshot && !provenance) {
            if (verdict.outcome === "claimed") {
              throw new AccountFault("CLAIMED_NAME_REQUIRES_ACCOUNT");
            }
            if (verdict.outcome === "reserved") {
              throw new AccountFault("NAME_RESERVED");
            }
          }
          let displayName = chosen;
          if (!start && !snapshot && !bound) {
            displayName = await deps.bindName(
              c.req.header("X-Session-Token"),
              session,
              chosen,
            );
            if (displayName.toLowerCase() !== chosen.toLowerCase()) {
              throw new GameIdentityConflict();
            }
          }
          if (snapshot) await renew(snapshot);
          return {
            displayName,
            ...(snapshot
              ? { accountId: snapshot.account.id }
              : provenance
              ? { accountId: provenance }
              : {}),
          };
        },
      };
    },
  };
}

// CAS the validated token row; the session-id row is a metadata mirror only.
export function createGameSessionNameBinder(
  client: { from(table: string): any },
  _kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
) {
  return async (
    token: string,
    session: GameSession,
    displayName: string,
  ): Promise<string> => {
    try {
      const key = `session_token_${token}`;
      for (let attempt = 0; attempt < 3; attempt++) {
        const read = await client.from("kv_store_825e19ab")
          .select("value").eq("key", key).maybeSingle();
        if (read.error) throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
        const stored = read.data?.value;
        if (!stored || stored.sessionId !== session.sessionId) {
          throw new AccountFault("GAME_SESSION_INVALID");
        }
        if (stored.displayName) {
          return nameKeys(stored.displayName.trim()).displayName;
        }
        const next = { ...stored, displayName };
        const result = await client.from("kv_store_825e19ab").update({
          value: next,
        })
          .eq("key", key).eq("value", JSON.stringify(stored)).select("key");
        if (result.error || !Array.isArray(result.data)) {
          throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
        }
        if (result.data.length === 1 && result.data[0].key === key) {
          await kvSet(`session_id_${session.sessionId}`, next);
          return displayName;
        }
        if (result.data.length !== 0) {
          throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
        }
      }
      throw new GameIdentityConflict();
    } catch (error) {
      if (
        error instanceof AccountFault || error instanceof GameIdentityConflict
      ) throw error;
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
  };
}
