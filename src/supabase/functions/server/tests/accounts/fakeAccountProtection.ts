import type {
  AccountProtectionRepository,
  RateBucket,
  RateResult,
} from "../../accounts/accountRepository.ts";

// Synchronous map changes within each RPC model an atomic DB transaction. These
// tests establish the Edge contract, not real PostgreSQL isolation/ACL behavior.
export class FakeAccountProtection implements AccountProtectionRepository {
  now = Date.parse("2026-11-20T00:00:00Z");
  counters = new Map<string, { count: number; expires: number }>();
  replays = new Map<string, number>();
  recognized = new Set<string>();
  calls: RateBucket[][] = [];
  cleanupCalls = 0;
  captchaCalls: boolean[] = [];
  async rateHit(buckets: RateBucket[], hash?: Uint8Array): Promise<RateResult> {
    this.calls.push(structuredClone(buckets));
    const known = hash && this.recognized.has(hex(hash));
    const result: RateResult = {
      allowed: true,
      retryAfterSeconds: 0,
      counts: {},
    };
    for (
      const b of [...buckets].sort((a, b) => a.scope.localeCompare(b.scope))
    ) {
      if (
        (b.applies === "recognized" && !known) ||
        (b.applies === "unknown" && known)
      ) continue;
      const start = Math.floor(this.now / (b.windowSeconds * 1000)) *
        b.windowSeconds * 1000;
      const end = start + b.windowSeconds * 1000;
      const key = b.scope + ":" + b.subjectHash + ":" + start;
      const row = this.counters.get(key) ??
        { count: 0, expires: end + 3600000 };
      if (b.operation === "hit") {
        row.count = Math.min(
          row.count + 1,
          b.limit + 1,
        );
      }
      this.counters.set(key, row);
      result.counts[b.scope] = row.count;
      if (b.operation === "hit" ? row.count > b.limit : row.count >= b.limit) {
        result.allowed = false;
        result.retryAfterSeconds = Math.max(
          result.retryAfterSeconds,
          Math.ceil((end - this.now) / 1000),
        );
      }
    }
    return result;
  }
  captcha(hash: Uint8Array, consume: boolean): Promise<boolean> {
    this.captchaCalls.push(consume);
    const key = hex(hash);
    if ((this.replays.get(key) ?? 0) > this.now) return Promise.resolve(false);
    if (consume) this.replays.set(key, this.now + 600000);
    return Promise.resolve(true);
  }
  cleanup(): Promise<number> {
    this.cleanupCalls++;
    let count = 0;
    for (const [key, row] of this.counters) {
      if (count < 100 && row.expires <= this.now) {
        this.counters.delete(key);
        count++;
      }
    }
    for (const [key, expiry] of this.replays) {
      if (count < 100 && expiry <= this.now) {
        this.replays.delete(key);
        count++;
      }
    }
    return Promise.resolve(count);
  }
}
export const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
