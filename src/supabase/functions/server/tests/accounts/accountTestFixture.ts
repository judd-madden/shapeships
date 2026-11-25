import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "npm:hono";
import { cors } from "npm:hono/cors";
import {
  type AccountService,
  createAccountService,
  type GameSession,
} from "../../accounts/accountService.ts";
import type { AccountsMode } from "../../accounts/accountsMode.ts";
import { HashAdmission } from "../../accounts/hashAdmission.ts";
import type { HumanCheck } from "../../accounts/humanCheck.ts";
import type { PasswordHasher } from "../../accounts/passwordHashing.ts";
import {
  type AccountRateLimit,
  allowAccountRateLimit,
} from "../../accounts/rateLimit.ts";
import {
  accountCorsOptions,
  accountPrivacyMiddleware,
  registerAccountRoutes,
  registerSessionMeRoute,
} from "../../routes/account_routes.ts";
import { FakeAccountRepository, FakeHasher } from "./fakeAccountRepository.ts";

export const prefix = "/make-server-825e19ab";
export const preferences = {
  soundEnabled: true,
  healthFlashEnabled: false,
  chatMinimized: true,
  battleLogPreferred: true,
  musicEnabled: false,
};

export function accountFixture(options: {
  mode?: AccountsMode;
  human?: HumanCheck;
  hasher?: PasswordHasher;
  rate?: Partial<AccountRateLimit>;
  rejectDependencies?: boolean;
  requestLogger?: MiddlewareHandler;
  useDefaultHuman?: boolean;
  admission?: HashAdmission;
  streak?: import("../../accounts/streakService.ts").AccountStreakDependencies;
} = {}) {
  const repository = new FakeAccountRepository(), fakeHasher = new FakeHasher();
  const logs: Array<{ category: string; code: string }> = [],
    events: string[] = [];
  const sessions = new Map<string, GameSession>(
    ["s1", "s2", "s3", "s4", "s5"].map((s) => [
      s,
      {
        sessionId: "session-" + s,
        createdAt: "2026-11-20T00:00:00Z",
        displayName: "Guest123",
      },
    ]),
  );
  let random = 0, dependencyCalls = 0, service: AccountService | undefined;
  const log = (category: string, code: string) => {
    logs.push({ category, code });
  };
  const validateSession = (raw: string) =>
    Promise.resolve(sessions.get(raw) ?? null);
  const rate: AccountRateLimit = {
    ...allowAccountRateLimit,
    entry: (context) => {
      events.push("entry:" + context.category);
      return Promise.resolve();
    },
    target: () => {
      events.push("target");
      return Promise.resolve();
    },
    beforeHash: () => {
      events.push("before-hash");
      return Promise.resolve();
    },
    verification: (_context, _name, success) => {
      events.push("verified:" + success);
      return Promise.resolve();
    },
    token: () => {
      events.push("token");
      return Promise.resolve();
    },
    ...options.rate,
  };
  const getService = () => {
    dependencyCalls++;
    if (options.rejectDependencies) {
      throw new Error("Dependencies must remain dormant");
    }
    return service ??= createAccountService({
      repository,
      streak: options.streak,
      hasher: options.hasher ?? fakeHasher,
      admission: options.admission ?? new HashAdmission(),
      validateSession,
      ...options.useDefaultHuman ? {} : {
        humanCheck: options.human ?? {
          verifyClaim: () => {
            events.push("human");
            return Promise.resolve();
          },
        },
      },
      rateLimit: rate,
      random: (n) => new Uint8Array(n).fill(++random),
      log,
    });
  };
  const app = new Hono();
  app.use("*", accountPrivacyMiddleware(options.requestLogger));
  app.use("/*", cors(accountCorsOptions));
  registerAccountRoutes(app, {
    mode: options.mode ?? "on",
    log,
    handleEnabledRequest: (c) => getService().handle(c),
  });
  registerSessionMeRoute(app, {
    mode: options.mode ?? "on",
    validateSession,
    log,
    resolveAccount: (raw, sessionId) =>
      getService().optionalIdentity(raw, sessionId),
  });
  app.get("/ordinary", (c) => c.json({ guest: true }));
  function post(
    route: string,
    body: unknown = {},
    session: string | null = "s1",
    token?: string,
  ) {
    return app.request(prefix + "/accounts/" + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer synthetic-anon",
        apikey: "synthetic-anon",
        ...session ? { "X-Session-Token": session } : {},
        ...token !== undefined ? { "X-Account-Token": token } : {},
      },
      body: JSON.stringify(body),
    });
  }
  async function claim(
    name = "Pilot1",
    session = "s1",
    password = "abcdefghij",
  ) {
    const response = await post("claim", {
      name,
      password,
      preferences,
      turnstileToken: "synthetic-proof",
    }, session);
    assert.equal(response.status, 201);
    return await response.json();
  }
  return {
    app,
    repository,
    fakeHasher,
    sessions,
    logs,
    events,
    post,
    claim,
    get dependencyCalls() {
      return dependencyCalls;
    },
  };
}
