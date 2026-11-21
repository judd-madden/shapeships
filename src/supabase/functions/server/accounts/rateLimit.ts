import {
  AccountFault,
  type AccountProtectionRepository,
  type RateBucket,
} from "./accountRepository.ts";
import { clientIp, type IpSource, parseIpSource } from "./clientIp.ts";
import type { HumanCheck } from "./humanCheck.ts";

export type AccountCategory =
  | "name-check"
  | "claim"
  | "sign-in"
  | "password"
  | "resume"
  | "logout"
  | "preferences";
export interface AccountAdmissionContext {
  category: AccountCategory;
  // Gateway/session/account credentials are removed; never log this context.
  headers: Headers;
  turnstileToken?: string;
}

// No raw account token/password is passed to the persisted protection hooks.
export interface AccountRateLimit {
  entry(context: AccountAdmissionContext): Promise<void>;
  target(context: AccountAdmissionContext, nameKey: string): Promise<void>;
  beforeHash(context: AccountAdmissionContext, nameKey: string): Promise<void>;
  verification(
    context: AccountAdmissionContext,
    nameKey: string,
    success: boolean,
  ): Promise<void>;
  token(
    context: AccountAdmissionContext,
    tokenHash?: Uint8Array,
  ): Promise<void>;
}
export const allowAccountRateLimit: AccountRateLimit = {
  entry: () => Promise.resolve(),
  target: () => Promise.resolve(),
  beforeHash: () => Promise.resolve(),
  verification: () => Promise.resolve(),
  token: () => Promise.resolve(),
};

export const LA13_NAME_CHECK_LIMIT = 600;
export const LA13_CLAIM_LIMIT = 300;
export const LA13_SIGNIN_LIMIT = 600;
export const LA13_PASSWORD_LIMIT = 60;
export const LA13_RESUME_LIMIT = 1200;
export const LA13_LOGOUT_LIMIT = 1200;
export const LA13_PREFERENCES_LIMIT = 1200;
export const LA13_GLOBAL_LIMITS: Record<
  AccountCategory,
  { limit: number; seconds: number; scope: string }
> = {
  "name-check": {
    limit: LA13_NAME_CHECK_LIMIT,
    seconds: 60,
    scope: "name_check_global",
  },
  claim: { limit: LA13_CLAIM_LIMIT, seconds: 3600, scope: "claim_global" },
  "sign-in": { limit: LA13_SIGNIN_LIMIT, seconds: 900, scope: "signin_global" },
  password: {
    limit: LA13_PASSWORD_LIMIT,
    seconds: 900,
    scope: "password_global",
  },
  resume: { limit: LA13_RESUME_LIMIT, seconds: 60, scope: "resume_global" },
  logout: { limit: LA13_LOGOUT_LIMIT, seconds: 60, scope: "logout_global" },
  preferences: {
    limit: LA13_PREFERENCES_LIMIT,
    seconds: 60,
    scope: "preferences_global",
  },
};
export interface RateLimitConfig {
  secret?: string;
  ipSource?: string;
  localTest: boolean;
}
export interface RateEvent {
  scope: string;
  retryAfterSeconds: number;
}

export function createAccountRateLimit(
  config: RateLimitConfig,
  repository: AccountProtectionRepository,
  human: HumanCheck,
  options: { now?: () => number; limited?: (event: RateEvent) => void } = {},
): AccountRateLimit {
  let source: IpSource | undefined;
  try {
    source = parseIpSource(config.ipSource, config.localTest);
  } catch { /* Fault raised on admission, not while dormant. */ }
  const secret = config.secret;
  const valid = !!secret && /^(?:[a-fA-F0-9]{2}){32,}$/.test(secret);
  let key: Promise<CryptoKey> | undefined;
  const state = new WeakMap<AccountAdmissionContext, { ip?: string }>();
  const now = options.now ?? Date.now;
  let cleanupAfter = -Infinity;
  function ready() {
    if (!valid || !source) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
  }
  async function subject(parts: string[]): Promise<string> {
    ready();
    key ??= crypto.subtle.importKey(
      "raw",
      Uint8Array.from(secret!.match(/../g)!, (s) => parseInt(s, 16)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const hash = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        await key,
        new TextEncoder().encode(JSON.stringify(parts)),
      ),
    );
    return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function bucket(
    scope: string,
    parts: string[],
    limit: number,
    seconds: number,
    operation: "hit" | "probe" = "hit",
    applies?: "recognized" | "unknown",
  ): Promise<RateBucket> {
    return {
      scope,
      subjectHash: await subject([scope, ...parts]),
      limit,
      windowSeconds: seconds,
      operation,
      ...(applies ? { applies } : {}),
    };
  }
  async function hit(buckets: RateBucket[], tokenHash?: Uint8Array) {
    if (!buckets.length) {
      return {
        allowed: true,
        retryAfterSeconds: 0,
        counts: {} as Record<string, number>,
      };
    }
    const result = await repository.rateHit(buckets, tokenHash);
    if (!result.allowed) {
      try {
        options.limited?.({
          scope: buckets.map((b) => b.scope).join(","),
          retryAfterSeconds: result.retryAfterSeconds,
        });
      } catch { /* Logs never change admission. */ }
      throw new AccountFault(
        "RATE_LIMITED",
        undefined,
        result.retryAfterSeconds,
      );
    }
    return result;
  }
  function ip(c: AccountAdmissionContext) {
    ready();
    let current = state.get(c);
    if (!current) {
      current = { ip: clientIp(source!, c.headers) };
      state.set(c, current);
    }
    return current.ip;
  }
  async function failureBuckets(
    c: AccountAdmissionContext,
    name: string,
    operation: "hit" | "probe",
  ) {
    const address = ip(c), buckets: RateBucket[] = [];
    if (address) {
      buckets.push(
        await bucket(
          "signin_failure_ip_target",
          [address, name],
          10,
          900,
          operation,
        ),
      );
    }
    buckets.push(
      await bucket("signin_failure_target", [name], 30, 900, operation),
    );
    return buckets;
  }
  return {
    async entry(c) {
      const address = ip(c), buckets: RateBucket[] = [];
      if (source!.mode === "la13") {
        const global = LA13_GLOBAL_LIMITS[c.category];
        buckets.push(
          await bucket(
            global.scope,
            [c.category],
            global.limit,
            global.seconds,
          ),
        );
      } else if (c.category === "name-check") {
        buckets.push(await bucket("name_check_ip", [address!], 120, 60));
      } else if (c.category === "claim") {
        buckets.push(await bucket("claim_ip", [address!], 10, 3600));
      } else if (c.category === "sign-in" || c.category === "password") {
        buckets.push(await bucket("signin_ip", [address!], 60, 900));
      }
      await hit(buckets);
      if (now() >= cleanupAfter) {
        cleanupAfter = now() + 60000;
        try {
          await repository.cleanup();
        } catch { /* Best-effort maintenance cannot change admission. */ }
      }
    },
    async target(c, name) {
      if (c.category === "name-check") {
        await hit([await bucket("name_check_target", [name], 30, 60)]);
      } else if (c.category === "claim") {
        await hit([await bucket("claim_target", [name], 3, 900)]);
      } else await hit(await failureBuckets(c, name, "probe"));
    },
    async beforeHash(c, name) {
      if (c.category === "claim") return;
      const result = await hit(await failureBuckets(c, name, "probe"));
      if (
        source!.mode === "la13" ||
        (result.counts.signin_failure_ip_target ?? 0) >= 3 ||
        (result.counts.signin_failure_target ?? 0) >= 10
      ) {
        if (!human.verifySignin) throw new AccountFault("CAPTCHA_UNAVAILABLE");
        await human.verifySignin(c.turnstileToken);
      }
    },
    async verification(c, name, success) {
      if (!success) await hit(await failureBuckets(c, name, "hit"));
    },
    async token(c, hash) {
      const address = ip(c), buckets: RateBucket[] = [];
      if (hash) {
        buckets.push(
          await bucket(
            "account_token",
            [Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("")],
            120,
            60,
            "hit",
            "recognized",
          ),
        );
      }
      if (address) {
        buckets.push(
          await bucket(
            "account_unknown_ip",
            [address],
            120,
            60,
            "hit",
            "unknown",
          ),
        );
      }
      await hit(buckets, hash);
    },
  };
}

export const closedAccountRateLimit: AccountRateLimit = {
  ...allowAccountRateLimit,
  entry: () => Promise.reject(new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE")),
};
