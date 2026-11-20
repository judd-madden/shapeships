import {
  AccountFault,
  type AccountProtectionRepository,
} from "./accountRepository.ts";

export interface HumanCheck {
  verifyClaim(turnstileToken: string | undefined): Promise<void>;
  verifySignin?(turnstileToken: string | undefined): Promise<void>;
  consumeClaim?(turnstileToken: string | undefined): Promise<void>;
}

// Dependency defaults stay closed; production explicitly supplies createHumanCheck.
export const closedHumanCheck: HumanCheck = {
  verifyClaim() {
    return Promise.reject(new AccountFault("CAPTCHA_UNAVAILABLE"));
  },
};

export const TURNSTILE_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
export const DUMMY_SECRETS = [
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
];
export interface HumanCheckConfig {
  secret?: string;
  hostnames?: string;
  localTest: boolean;
}

export function createHumanCheck(
  config: HumanCheckConfig,
  repository: AccountProtectionRepository,
  options: { fetch?: typeof fetch; now?: () => number; timeoutMs?: number } =
    {},
): HumanCheck {
  const siteverify = options.fetch ?? fetch, now = options.now ?? Date.now;
  const hosts = (config.hostnames ?? "").split(",").map((s) =>
    s.trim().toLowerCase()
  ).filter(Boolean);
  const dummySecret = DUMMY_SECRETS.includes(config.secret ?? "");
  function configured() {
    if (!config.secret || !hosts.length || (dummySecret && !config.localTest)) {
      throw new AccountFault("CAPTCHA_UNAVAILABLE");
    }
  }
  async function digest(proof: string) {
    return new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proof)),
    );
  }
  function proof(value: string | undefined): string {
    if (!value) throw new AccountFault("CAPTCHA_REQUIRED");
    if (value.length > 2048) throw new AccountFault("CAPTCHA_INVALID");
    return value;
  }
  const skipReplay = (value: string) =>
    config.localTest && dummySecret && value === DUMMY_TOKEN;
  async function consume(value: string) {
    if (
      !skipReplay(value) && !await repository.captcha(await digest(value), true)
    ) throw new AccountFault("CAPTCHA_REPLAY");
  }
  async function verify(
    value: string | undefined,
    action: "claim" | "sign-in",
  ) {
    configured();
    const token = proof(value);
    if (
      !skipReplay(token) &&
      !await repository.captcha(await digest(token), false)
    ) throw new AccountFault("CAPTCHA_REPLAY");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: Record<string, unknown>;
    try {
      const request = (async () => {
        const response = await siteverify(TURNSTILE_URL, {
          method: "POST",
          body: new URLSearchParams({
            secret: config.secret!,
            response: token,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unavailable");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Invalid upstream response");
        }
        return data as Record<string, unknown>;
      })();
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Deadline"));
        }, options.timeoutMs ?? 5000);
      });
      result = await Promise.race([request, deadline]);
    } catch {
      throw new AccountFault("CAPTCHA_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
    const timestamp = typeof result.challenge_ts === "string"
      ? Date.parse(result.challenge_ts)
      : NaN;
    const age = now() - timestamp;
    const dummyResponse = dummySecret && config.localTest &&
      result.hostname === "example.com" && !result.action;
    if (
      result.success !== true || typeof result.hostname !== "string" ||
      !hosts.includes(result.hostname.toLowerCase()) ||
      (!dummyResponse && result.action !== action) || !Number.isFinite(age) ||
      age < 0 || age > 300000 ||
      (!config.localTest &&
        (result.hostname === "example.com" || token === DUMMY_TOKEN))
    ) {
      // A locally consumed token wins over Cloudflare's ambiguous timeout-or-duplicate.
      if (
        !skipReplay(token) &&
        !await repository.captcha(await digest(token), false)
      ) throw new AccountFault("CAPTCHA_REPLAY");
      throw new AccountFault("CAPTCHA_INVALID");
    }
    if (action === "sign-in") await consume(token);
  }
  return {
    verifyClaim: (token) => verify(token, "claim"),
    verifySignin: (token) => verify(token, "sign-in"),
    consumeClaim: (token) => consume(proof(token)),
  };
}
