import { Hono } from "npm:hono";
import { registerAuthRoutes } from "../../routes/auth_routes.ts";
import { registerGameRoutes } from "../../routes/game_routes.ts";
import { registerIntentRoutes } from "../../routes/intent_routes.ts";
import { projectGameStateHead } from "../../routes/game_state_head.ts";
import type { GameStatePersistence } from "../../routes/intent_persistence.ts";

export const prefix = "/make-server-825e19ab";

export class IdentityMemoryPersistence implements GameStatePersistence {
  store = new Map<string, any>();
  writes: string[] = [];
  conflicts = 0;
  beforeConflict?: (key: string) => void;
  async load(key: string) {
    return this.store.has(key)
      ? {
        status: "found" as const,
        value: structuredClone(this.store.get(key)),
      }
      : { status: "missing" as const };
  }
  async conditionalUpdate(
    args: Parameters<GameStatePersistence["conditionalUpdate"]>[0],
  ) {
    if (this.conflicts > 0) {
      this.conflicts--;
      this.beforeConflict?.(args.key);
      return { status: "conflict" as const };
    }
    const current = this.store.get(args.key);
    if (
      !current ||
      (args.expected.kind === "valid"
        ? current[args.revisionField] !== args.expected.revision
        : args.expected.kind !== "missing" ||
          Object.hasOwn(current, args.revisionField))
    ) {
      return { status: "conflict" as const };
    }
    this.store.set(args.key, structuredClone(args.value));
    this.writes.push(args.key);
    return { status: "updated" as const };
  }
  async insertIfMissing(key: string, value: any) {
    if (this.store.has(key)) return { status: "conflict" as const };
    this.store.set(key, structuredClone(value));
    this.writes.push(key);
    return { status: "updated" as const };
  }
  async loadGameHead(key: string) {
    if (!this.store.has(key)) return { status: "missing" as const };
    const projected = projectGameStateHead(this.store.get(key));
    return {
      status: "found" as const,
      value: projected.ok ? projected.head : null,
    };
  }
  async conditionalUpdateGameHead() {
    return { status: "updated" as const };
  }
}

// Reflect.apply deliberately accepts the future optional options argument without
// editing production signatures: the characterization suite runs before wiring.
export function gameIdentityFixture(
  options: Record<string, unknown> = { mode: "off" },
) {
  const app = new Hono(), persistence = new IdentityMemoryPersistence();
  let currentSession = "p1", nextGame = 0;
  const sessions = new Map<string, any>();
  for (const id of ["p1", "p2", "p3", "p4"]) {
    sessions.set(id, {
      sessionId: id,
      displayName: null,
      createdAt: new Date().toISOString(),
    });
  }
  const kvGet = async (key: string) =>
    structuredClone(persistence.store.get(key));
  const kvSet = async (key: string, value: any) => {
    persistence.store.set(key, structuredClone(value));
    persistence.writes.push(key);
  };
  const requireSession = async (c: any) => {
    const raw = c.req.header("X-Session-Token");
    if (raw === "invalid") {
      return c.json({
        error: "Unauthorized",
        message: "Invalid or expired session token",
      }, 401);
    }
    return sessions.get(raw || currentSession) ??
      persistence.store.get(`session_token_${raw}`) ??
      c.json({
        error: "Unauthorized",
        message: "Invalid or expired session token",
      }, 401);
  };
  Reflect.apply(registerAuthRoutes, undefined, [app, kvGet, kvSet, options]);
  Reflect.apply(registerGameRoutes, undefined, [
    app,
    kvGet,
    kvSet,
    requireSession,
    () => `G${++nextGame}`,
    persistence,
    undefined,
    options,
  ]);
  Reflect.apply(registerIntentRoutes, undefined, [
    app,
    kvGet,
    kvSet,
    requireSession,
    persistence,
    options,
  ]);
  async function request(
    path: string,
    body: unknown = {},
    headers: Record<string, string> = {},
  ) {
    return await app.request(prefix + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": currentSession,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }
  async function create(computer = false, name: unknown = "Pilot1") {
    const response = await request(
      computer ? "/create-computer-game" : "/create-game",
      { playerName: name, timed: false },
    );
    const body = await response.json();
    if (response.status !== 200) throw new Error(JSON.stringify(body));
    return body.gameId as string;
  }
  return {
    app,
    persistence,
    sessions,
    request,
    create,
    kvGet,
    kvSet,
    session(id: string) {
      currentSession = id;
    },
    state(id: string) {
      return persistence.store.get(`game_${id}`);
    },
  };
}
