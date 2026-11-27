import type { Context } from "npm:hono";
import {
  AccountFault,
  type AccountIdentity,
  type AccountRepository,
  type AccountRpcClient,
  createAccountProtectionRepository,
  createAccountRepository,
  type PreferencePatch,
  isMissionProgressId,
  MISSION_PROGRESS_MAX_BYTES,
  MISSION_PROGRESS_MAX_ENTRIES,
} from "./accountRepository.ts";
import { MISSION_STORIES } from "../engine/mission/MissionStories.ts";
import {
  accountError,
  accountNoContent,
  accountSuccess,
} from "./accountResponses.ts";
import {
  claimPreferences,
  readAccountJson,
  requireFields,
} from "./accountRequests.ts";
import { HashAdmission, workerHashAdmission } from "./hashAdmission.ts";
import {
  closedHumanCheck,
  createHumanCheck,
  type HumanCheck,
} from "./humanCheck.ts";
import { nameKeys } from "./nameKeys.ts";
import {
  createPasswordHasher,
  type PasswordHasher,
} from "./passwordHashing.ts";
import { normalizePassword, PASSWORD_FORMAT } from "./passwordPolicy.ts";
import {
  type AccountAdmissionContext,
  type AccountCategory,
  type AccountRateLimit,
  closedAccountRateLimit,
  createAccountRateLimit,
} from "./rateLimit.ts";
import {
  issueToken,
  type RandomBytes,
  secureRandomBytes,
  tokenDigest,
} from "./tokens.ts";
import { type AccountStreakDependencies, handleAccountStreak, streakCall } from "./streakService.ts";
import type { AccountStreakSnapshot, StreakAuth } from "./streakRepository.ts";

export interface GameSession {
  sessionId: string;
  createdAt: string;
  displayName: string | null;
  lastRenewedAt?: string;
}
export type SessionValidator = (token: string) => Promise<GameSession | null>;
export type AccountLog = (
  category: string,
  code: string,
  details?: {
    requestId?: string;
    durationMs?: number;
    scope?: string;
    retryAfterSeconds?: number;
  },
) => void;
export interface AccountServiceDependencies {
  repository: AccountRepository;
  validateSession: SessionValidator;
  hasher?: PasswordHasher;
  admission?: HashAdmission;
  humanCheck?: HumanCheck;
  rateLimit?: AccountRateLimit;
  random?: RandomBytes;
  log?: AccountLog;
  streak?: AccountStreakDependencies;
}
export interface AccountService {
  handle(c: Context): Promise<Response>;
  optionalIdentity(
    raw: string,
    sessionId: string,
  ): Promise<AccountIdentity | null>;
}

const prefix = "/make-server-825e19ab/accounts/";
const routes: readonly string[] = [
  "name-check",
  "claim",
  "sign-in",
  "password",
  "resume",
  "logout",
  "preferences",
  "missions/state",
  "missions/add",
  "missions/reset",
  "streak/state",
  "streak/import",
  "streak/reset",
];
const knownMissionIds = new Set(MISSION_STORIES.map((mission) => mission.id));
const knownFindingIds = new Set(
  MISSION_STORIES.flatMap((mission) => mission.findingIds),
);
export function createAccountService(
  deps: AccountServiceDependencies,
): AccountService {
  const { repository, validateSession } = deps;
  const hasher = deps.hasher ?? createPasswordHasher();
  const admission = deps.admission ?? workerHashAdmission;
  const human = deps.humanCheck ?? closedHumanCheck;
  const rate = deps.rateLimit ?? closedAccountRateLimit;
  const random = deps.random ?? secureRandomBytes;
  function log(
    category: string,
    code: string,
    details?: Parameters<AccountLog>[2],
  ) {
    try {
      deps.log?.(category, code, details);
    } catch { /* Logging cannot change an auth result. */ }
  }
  async function session(
    c: Context,
    required: boolean,
  ): Promise<GameSession | undefined> {
    const raw = c.req.header("X-Session-Token");
    if (raw === undefined && !required) return undefined;
    if (!raw) throw new AccountFault("GAME_SESSION_INVALID");
    const result = await validateSession(raw);
    if (!result) throw new AccountFault("GAME_SESSION_INVALID");
    return result;
  }
  async function hashes<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await admission.run(work);
    } catch (error) {
      if (error instanceof AccountFault) throw error;
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
  }
  return {
    async optionalIdentity(raw, sessionId) {
      try {
        return await repository.identity(await tokenDigest(raw), sessionId);
      } catch {
        return null;
      } // Optional account state cannot gate this read.
    },
    async handle(c) {
      const path = c.req.path;
      const route = path.startsWith(prefix) ? path.slice(prefix.length) : "";
      if (!routes.includes(route)) {
        log("accounts", "NOT_FOUND");
        return accountError(c, "NOT_FOUND");
      }
      if (
        route === "preferences"
          ? c.req.method !== "GET" && c.req.method !== "PUT"
          : route === "missions/state"
          ? c.req.method !== "GET"
          : c.req.method !== "POST"
      ) {
        log(route, "METHOD_NOT_ALLOWED");
        return accountError(c, "METHOD_NOT_ALLOWED");
      }
      const isStreak = route.startsWith("streak/");
      const isMission = route.startsWith("missions/");
      const category: AccountCategory = isStreak || isMission
        ? "preferences"
        : route as AccountCategory;
      const started = performance.now(), requestId = crypto.randomUUID();
      const report = (code: string) =>
        log(route, code, {
          requestId,
          durationMs: Math.round(performance.now() - started),
        });
      const admissionHeaders = new Headers(c.req.raw.headers);
      for (
        const header of [
          "Authorization",
          "apikey",
          "X-Session-Token",
          "X-Account-Token",
        ]
      ) admissionHeaders.delete(header);
      const context: AccountAdmissionContext = {
        category,
        headers: admissionHeaders,
      };
      let streakAuth: StreakAuth | undefined;
      try {
        // 22C.3 RATE: IP/global entry admission, including format failures.
        await rate.entry(context);
        // Token admission precedes body/session failures, and arbitrary digests
        // cannot create their own recognized-token buckets.
        let tokenHash: Uint8Array | undefined,
          tokenFault: AccountFault | undefined;
        if (
          category === "resume" || category === "logout" ||
          category === "preferences"
        ) {
          const raw = c.req.header("X-Account-Token");
          if (raw !== undefined) {
            try {
              tokenHash = await tokenDigest(raw);
            } catch {
              if (category !== "logout") {
                tokenFault = new AccountFault("ACCOUNT_TOKEN_INVALID");
              }
            }
          } else if (category !== "logout") {
            tokenFault = new AccountFault("ACCOUNT_TOKEN_REQUIRED");
          }
          await rate.token(context, tokenHash);
        }
        if (isMission) {
          const body = await readAccountJson(
            c.req.raw,
            route !== "missions/add",
            MISSION_PROGRESS_MAX_BYTES,
          );
          requireFields(
            body,
            route === "missions/add" ? ["missions", "findings"] : [],
          );
          // Like preferences, progress needs only A; never renew or link a session.
          if (route === "missions/state") {
            if (tokenFault) throw tokenFault;
            const missionProgress = await repository.getMissionProgress(
              tokenHash!,
            );
            report("OK");
            return accountSuccess(c, { missionProgress });
          }
          const lists: { missions: string[]; findings: string[] } = {
            missions: [], findings: [],
          };
          for (const key of ["missions", "findings"] as const) {
            const list = body[key];
            if (list === undefined) continue;
            if (
              !Array.isArray(list) ||
              list.length > MISSION_PROGRESS_MAX_ENTRIES ||
              !list.every(isMissionProgressId)
            ) throw new AccountFault("INVALID_REQUEST", key);
            lists[key] = list;
          }
          if (tokenFault) throw tokenFault;
          // Validate the raw lists before dropping unknown IDs or deduplicating.
          const missionProgress = route === "missions/reset"
            ? await repository.resetMissionProgress(tokenHash!)
            : await repository.addMissionProgress(
              tokenHash!,
              lists.missions.filter((id) => knownMissionIds.has(id)),
              lists.findings.filter((id) => knownFindingIds.has(id)),
            );
          report("OK");
          return accountSuccess(c, { missionProgress });
        }
        if (isStreak) {
          const gameSession = await session(c, true);
          const body = await readAccountJson(c.req.raw);
          if (tokenFault) throw tokenFault;
          streakAuth = { tokenHash: tokenHash!, sessionId: gameSession!.sessionId };
          const result = await handleAccountStreak(deps.streak ?? {
            loadGame: () => Promise.reject(new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE")),
          }, route, body, streakAuth);
          report("OK");
          return accountSuccess(c, result);
        }
        if (category === "preferences") {
          // Preferences never validate S, renew A or touch a session binding.
          if (c.req.method === "GET") {
            if (tokenFault) throw tokenFault;
            const preferences = await repository.getPreferences(tokenHash!);
            report("OK");
            return accountSuccess(c, { preferences });
          }
          const body = await readAccountJson(c.req.raw);
          requireFields(body, ["patch", "expectedRevision"]);
          const patch = body.patch;
          if (
            !patch || typeof patch !== "object" || Array.isArray(patch) ||
            Object.keys(patch).length === 0 ||
            Object.entries(patch).some(([key, value]) =>
              ![
                "soundEnabled",
                "healthFlashEnabled",
                "chatMinimized",
                "battleLogPreferred",
                "musicEnabled",
              ].includes(key) || typeof value !== "boolean"
            )
          ) throw new AccountFault("INVALID_REQUEST", "patch");
          const revision = body.expectedRevision;
          if (
            typeof revision !== "string" ||
            !/^[1-9][0-9]{0,18}$/.test(revision) ||
            BigInt(revision) > 9223372036854775807n
          ) {
            throw new AccountFault("INVALID_REQUEST", "expectedRevision");
          }
          if (tokenFault) throw tokenFault;
          const result = await repository.updatePreferences(
            tokenHash!,
            patch as PreferencePatch,
            revision,
          );
          if (result.status === "conflict") {
            report("PREFERENCE_CONFLICT");
            return accountError(
              c,
              "PREFERENCE_CONFLICT",
              {},
              result.preferences,
            );
          }
          report("OK");
          return accountSuccess(c, { preferences: result.preferences });
        }
        const gameSession = category === "logout" || category === "name-check"
          ? undefined
          : await session(
            c,
            category === "claim" || category === "sign-in" ||
              category === "password",
          );
        const body = await readAccountJson(c.req.raw, category === "logout");
        if (category === "name-check") {
          requireFields(body, ["name"]);
          const keys = nameKeys(body.name);
          await rate.target(context, keys.nameKey);
          const result = await repository.nameStatus(keys.displayName);
          report("OK");
          return accountSuccess(c, result);
        }
        if (category === "resume" || category === "logout") {
          requireFields(body, []);
          if (tokenFault) throw tokenFault;
          const hash = tokenHash;
          if (category === "logout") {
            if (hash) await repository.logout(hash);
            report("OK");
            return accountNoContent(c);
          }
          const result = await repository.resume(hash!, gameSession?.sessionId);
          report("OK");
          return accountSuccess(c, result);
        }
        requireFields(
          body,
          category === "claim"
            ? ["name", "password", "turnstileToken", "preferences"]
            : category === "password"
            ? ["name", "currentPassword", "newPassword", "turnstileToken"]
            : ["name", "password", "turnstileToken"],
        );
        const keys = nameKeys(body.name);
        const newPassword = category === "password"
          ? normalizePassword(body.newPassword, "newPassword")
          : undefined;
        const password = normalizePassword(
          category === "password" ? body.currentPassword : body.password,
          category === "password" ? "currentPassword" : "password",
        );
        const preferences = category === "claim"
          ? claimPreferences(body.preferences)
          : undefined;
        if (
          body.turnstileToken !== undefined &&
          typeof body.turnstileToken !== "string"
        ) throw new AccountFault("INVALID_REQUEST", "turnstileToken");
        context.turnstileToken = body.turnstileToken as string | undefined;
        // 22C.3 RATE: validated target checks, before any external proof/hash work.
        await rate.target(context, keys.nameKey);
        if (category === "claim") {
          await human.verifyClaim(context.turnstileToken);
          // 22C.3 RATE: final claim admission after the human-check seam.
          await rate.beforeHash(context, keys.nameKey);
          const passwordHash = await hashes(() => hasher.hash(password));
          const token = await issueToken(random);
          await human.consumeClaim?.(context.turnstileToken);
          const result = await repository.claim({
            ...keys,
            passwordHash,
            passwordFormat: PASSWORD_FORMAT,
            tokenHash: token.hash,
            sessionId: gameSession!.sessionId,
            preferences: preferences!,
          });
          report("OK");
          return accountSuccess(c, { ...result, accountToken: token.raw }, 201);
        }
        // 22C.3 RATE: sign-in/password limits and CAPTCHA escalation before hash.
        await rate.beforeHash(context, keys.nameKey);
        const snapshot = await repository.readCredential(keys.nameKey);
        if (!snapshot) {
          await rate.verification(context, keys.nameKey, false); // 22C.3 RATE: unknown target failure.
          throw new AccountFault("INVALID_CREDENTIALS");
        }
        const verified = await hashes(async () => {
          const verification = await hasher.verify(
            password,
            snapshot.passwordHash,
            snapshot.passwordFormat,
          );
          if (!verification.matches) return { matches: false };
          if (category === "password" && newPassword === password) {
            return { matches: true, unchanged: true };
          }
          const replacement = category === "password"
            ? await hasher.hash(newPassword!)
            : verification.needsRehash && !snapshot.mustChangePassword
            ? await hasher.hash(password)
            : undefined;
          return { matches: true, replacement };
        });
        // 22C.3 RATE: verified must-change/blocked credentials count as success.
        await rate.verification(context, keys.nameKey, verified.matches);
        if (!verified.matches) throw new AccountFault("INVALID_CREDENTIALS");
        if ("unchanged" in verified && verified.unchanged) {
          throw new AccountFault("PASSWORD_UNCHANGED", "newPassword");
        }
        const token = await issueToken(random);
        const result = category === "password"
          ? await repository.changePassword(
            snapshot,
            verified.replacement!,
            PASSWORD_FORMAT,
            token.hash,
            gameSession!.sessionId,
          )
          : await repository.finishSignin(
            snapshot,
            token.hash,
            gameSession!.sessionId,
          );
        if (category === "sign-in" && verified.replacement) {
          try {
            await repository.rehash(
              snapshot,
              verified.replacement,
              PASSWORD_FORMAT,
            );
          } catch {
            log("sign-in", "REHASH_UNAVAILABLE");
          } // Optional maintenance cannot lose a successful sign-in.
        }
        report("OK");
        return accountSuccess(c, { ...result, accountToken: token.raw });
      } catch (error) {
        const fault = error instanceof AccountFault
          ? error
          : new AccountFault("INTERNAL_ERROR");
        let streak: AccountStreakSnapshot | undefined;
        if (fault.code === "STREAK_CONFLICT" && streakAuth) {
          try {
            streak = await streakCall(deps.streak ?? {}, (r) => r.reconcile(streakAuth!));
          } catch { /* Preserve the conflict if its optional refresh fails. */ }
        }
        report(fault.code);
        return accountError(c, fault.code, {
          ...(fault.field ? { field: fault.field } : {}),
          ...(fault.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: fault.retryAfterSeconds }
            : {}),
        }, undefined, streak);
      }
    },
  };
}

export function createProductionAccountService(
  client: AccountRpcClient,
  validateSession: SessionValidator,
  log: AccountLog,
  streak?: AccountStreakDependencies,
): AccountService {
  const repository = createAccountRepository(client);
  const protection = createAccountProtectionRepository(client);
  const localTest = Deno.env.get("ACCOUNTS_LOCAL_TEST_MODE") === "true";
  const human = createHumanCheck({
    secret: Deno.env.get("ACCOUNTS_TURNSTILE_SECRET"),
    hostnames: Deno.env.get("ACCOUNTS_TURNSTILE_HOSTNAMES"),
    localTest,
  }, protection);
  const rateLimit = createAccountRateLimit(
    {
      secret: Deno.env.get("ACCOUNTS_RATE_LIMIT_SECRET"),
      ipSource: Deno.env.get("ACCOUNTS_IP_SOURCE"),
      localTest,
    },
    protection,
    human,
    { limited: (event) => log("accounts", "RATE_LIMITED", event) },
  );
  return createAccountService({
    repository,
    humanCheck: human,
    rateLimit,
    validateSession,
    log,
    streak,
  });
}
