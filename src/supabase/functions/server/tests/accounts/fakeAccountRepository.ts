import {
  type AccountEntry,
  AccountFault,
  type AccountIdentity,
  type AccountLink,
  type AccountPreferences,
  type AccountMissionProgress,
  isMissionProgressId,
  MISSION_PROGRESS_MAX_BYTES,
  MISSION_PROGRESS_MAX_ENTRIES,
  type AccountRepository,
  type ClaimInput,
  type CredentialSnapshot,
  type GameIdentitySnapshot,
  type PreferencePatch,
  type PreferenceUpdateResult,
} from "../../accounts/accountRepository.ts";
import { nameKeys } from "../../accounts/nameKeys.ts";
import { matchingBans, type NameRule } from "../../accounts/nameRules.ts";
import { PASSWORD_FORMAT } from "../../accounts/passwordPolicy.ts";
import type { PasswordHasher } from "../../accounts/passwordHashing.ts";

export const DAY = 86400000;
interface FakeAccount {
  id: string;
  displayName: string;
  nameKey: string;
  status: "active" | "blocked";
  version: string;
}
interface FakeCredential {
  hash: string;
  format: string;
  mustChange: boolean;
}
export interface FakeToken {
  id: string;
  accountId: string;
  hash: string;
  version: string;
  lastUsed: number;
  expires: number;
  revoked: number | null;
}
interface FakeLink {
  sessionId: string;
  accountId: string;
  tokenId: string;
  detached: number | null;
}
interface Rule {
  kind: "banned" | "reserved" | "exception";
  match: "exact" | "contains";
  key: string;
  safe_substrings?: string[];
}
const digest = (value: Uint8Array) =>
  Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("");

// Per-key queues model DB serialization; staged writes prevent failed transactions
// from exposing or undoing another transaction's committed rows.
class Journal {
  #writes = new Map<Map<unknown, unknown>, Map<unknown, unknown>>();
  get<K, V>(map: Map<K, V>, key: K): V | undefined {
    const pending = this.#writes.get(map as Map<unknown, unknown>);
    return structuredClone(
      pending?.has(key) ? pending.get(key) as V : map.get(key),
    );
  }
  set<K, V>(map: Map<K, V>, key: K, value: V) {
    const table = map as Map<unknown, unknown>;
    let pending = this.#writes.get(table);
    if (!pending) {
      pending = new Map();
      this.#writes.set(table, pending);
    }
    pending.set(key, structuredClone(value));
  }
  values<K, V>(map: Map<K, V>): V[] {
    return [
      ...new Map(
        [
          ...map,
          ...this.#writes.get(map as Map<unknown, unknown>) ?? [],
        ] as Array<[K, V]>,
      ).values(),
    ].map((v) => structuredClone(v));
  }
  commit() {
    for (const [map, writes] of this.#writes) {
      for (const [key, value] of writes) {
        map.set(key, value);
      }
    }
  }
}

export class FakeHasher implements PasswordHasher {
  #values = new Map<string, string>();
  #next = 0;
  hashCalls = 0;
  verifyCalls = 0;
  needsRehash = false;
  credential(password: string): string {
    const encoded = "synthetic-hash-" + ++this.#next;
    this.#values.set(encoded, password);
    return encoded;
  }
  hash(password: string): Promise<string> {
    this.hashCalls++;
    return Promise.resolve(this.credential(password));
  }
  verify(password: string, encoded: string, format: string) {
    this.verifyCalls++;
    if (format !== PASSWORD_FORMAT || !this.#values.has(encoded)) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
    return Promise.resolve({
      matches: this.#values.get(encoded) === password,
      needsRehash: this.needsRehash,
    });
  }
}

export class FakeAccountRepository implements AccountRepository {
  accounts = new Map<string, FakeAccount>();
  credentials = new Map<string, FakeCredential>();
  preferences = new Map<string, AccountPreferences>();
  missionProgress = new Map<string, AccountMissionProgress>();
  tokens = new Map<string, FakeToken>();
  links = new Map<string, FakeLink>();
  rules: Rule[] = [];
  ruleReads = 0;
  now = Date.parse("2026-11-20T00:00:00Z");
  failAt?: string;
  beforeCommit?: (category: string) => Promise<void>;
  #next = 0;
  #locks = new Map<string, Promise<void>>();
  #id() {
    return "00000000-0000-4000-8000-" +
      (++this.#next).toString().padStart(12, "0");
  }
  #step(label: string) {
    if (this.failAt === label) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
  }
  async #transaction<T>(
    category: string,
    keys: string[],
    work: (tx: Journal) => T,
  ): Promise<T> {
    const release: Array<() => void> = [];
    try {
      for (const key of [...new Set(keys)]) {
        const previous = this.#locks.get(key) ?? Promise.resolve();
        const gate = Promise.withResolvers<void>();
        this.#locks.set(key, gate.promise);
        await previous;
        release.push(gate.resolve);
      }
      const tx = new Journal();
      const result = work(tx);
      await this.beforeCommit?.(category);
      this.#step(category + ".commit");
      tx.commit();
      return structuredClone(result);
    } finally {
      for (const unlock of release.reverse()) unlock();
    }
  }
  #name(account: FakeAccount, reserved = false) {
    if (matchingBans(account.nameKey, this.#rules()).length) {
      throw new AccountFault("NAME_BANNED");
    }
    if (
      reserved &&
      this.rules.some((r) => r.kind === "reserved" && r.key === account.nameKey)
    ) throw new AccountFault("NAME_RESERVED");
  }
  #rules(): NameRule[] {
    this.ruleReads++;
    return this.rules.map((r) => ({
      kind: r.kind,
      match_kind: r.match,
      match_key: r.key,
      safe_substrings: r.safe_substrings,
    }));
  }
  nameStatus(displayName: string) {
    this.#step("nameStatus");
    const keys = nameKeys(displayName);
    const account = [...this.accounts.values()].find((a) =>
      a.nameKey === keys.nameKey
    );
    const outcome = matchingBans(keys.nameKey, this.#rules()).length
      ? "banned"
      : account
      ? "claimed"
      : this.rules.some((r) => r.kind === "reserved" && r.key === keys.nameKey)
      ? "reserved"
      : "available";
    return Promise.resolve({
      nameKey: keys.nameKey,
      displayName: outcome === "claimed" ? account!.displayName : displayName,
      outcome: outcome as "banned" | "claimed" | "reserved" | "available",
    });
  }
  #token(hash: Uint8Array) {
    return [...this.tokens.values()].find((t) => t.hash === digest(hash));
  }
  #authorize(
    tx: Journal,
    accountId: string,
    tokenId: string,
  ): { a: FakeAccount; t: FakeToken } {
    const a = tx.get(this.accounts, accountId),
      t = tx.get(this.tokens, tokenId);
    if (!a || !t || t.accountId !== accountId || t.version !== a.version) {
      throw new AccountFault("ACCOUNT_TOKEN_INVALID");
    }
    if (t.revoked !== null) throw new AccountFault("ACCOUNT_TOKEN_INVALID");
    if (t.expires <= this.now) throw new AccountFault("ACCOUNT_TOKEN_EXPIRED");
    if (a.status !== "active") throw new AccountFault("ACCOUNT_BLOCKED");
    this.#name(a);
    return { a, t };
  }
  #link(
    tx: Journal,
    sessionId: string,
    accountId: string,
    tokenId: string,
  ): AccountLink {
    const { a } = this.#authorize(tx, accountId, tokenId);
    const prior = tx.get(this.links, sessionId);
    if (prior && prior.detached === null && prior.accountId !== a.id) {
      const oldAccount = tx.get(this.accounts, prior.accountId),
        oldToken = tx.get(this.tokens, prior.tokenId);
      if (
        oldAccount && oldToken && oldToken.accountId === oldAccount.id &&
        oldAccount.status === "active" &&
        oldToken.version === oldAccount.version && oldToken.revoked === null &&
        oldToken.expires > this.now
      ) {
        throw new AccountFault("SESSION_LINK_CONFLICT");
      }
    }
    tx.set(this.links, sessionId, {
      sessionId,
      accountId,
      tokenId,
      detached: null,
    });
    return { sessionId, accountId, displayName: a.displayName };
  }
  // Direct helper calls exercise ID authorization independently of parent methods.
  linkDirect(sessionId: string, accountId: string, tokenId: string) {
    return this.#transaction("link", [
      "account:" + accountId,
      "session:" + sessionId,
    ], (tx) => this.#link(tx, sessionId, accountId, tokenId));
  }
  #issue(
    tx: Journal,
    a: FakeAccount,
    hash: Uint8Array,
    sessionId: string,
  ): FakeToken {
    if ([...tx.values(this.tokens)].some((t) => t.hash === digest(hash))) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
    const t = {
      id: this.#id(),
      accountId: a.id,
      hash: digest(hash),
      version: a.version,
      lastUsed: this.now,
      expires: this.now + 90 * DAY,
      revoked: null,
    };
    tx.set(this.tokens, t.id, t);
    this.#step("claim.token");
    this.#link(tx, sessionId, a.id, t.id);
    this.#step("claim.link");
    return t;
  }
  #entry(
    tx: Journal,
    a: FakeAccount,
    t: FakeToken,
    sessionId?: string,
  ): AccountEntry {
    const result: AccountEntry = {
      account: { id: a.id, displayName: a.displayName, badge: "claimed-name" },
      preferences: tx.get(this.preferences, a.id)!,
      expiresAt: new Date(t.expires).toISOString(),
    };
    if (sessionId) {
      result.link = { sessionId, accountId: a.id, displayName: a.displayName };
    }
    return result;
  }
  claim(input: ClaimInput) {
    return this.#transaction("claim", [
      "name:" + input.nameKey,
      "session:" + input.sessionId,
    ], (tx) => {
      if (
        [...this.accounts.values()].some((a) => a.nameKey === input.nameKey)
      ) throw new AccountFault("NAME_TAKEN");
      const a: FakeAccount = {
        id: this.#id(),
        displayName: input.displayName,
        nameKey: input.nameKey,
        status: "active",
        version: "1",
      };
      this.#name(a, true);
      tx.set(this.accounts, a.id, a);
      this.#step("claim.account");
      tx.set(this.credentials, a.id, {
        hash: input.passwordHash,
        format: input.passwordFormat,
        mustChange: false,
      });
      this.#step("claim.credential");
      tx.set(this.preferences, a.id, {
        values: input.preferences,
        revision: "1",
        updatedAt: new Date(this.now).toISOString(),
      });
      this.#step("claim.preferences");
      tx.set(this.missionProgress, a.id, { missions: [], findings: [] });
      return this.#entry(
        tx,
        a,
        this.#issue(tx, a, input.tokenHash, input.sessionId),
        input.sessionId,
      );
    });
  }
  readCredential(nameKey: string): Promise<CredentialSnapshot | null> {
    const a = [...this.accounts.values()].find((a) => a.nameKey === nameKey);
    if (!a) return Promise.resolve(null);
    const c = this.credentials.get(a.id)!;
    return Promise.resolve({
      accountId: a.id,
      displayName: a.displayName,
      securityVersion: a.version,
      passwordHash: c.hash,
      passwordFormat: c.format,
      mustChangePassword: c.mustChange,
    });
  }
  #snapshot(tx: Journal, s: CredentialSnapshot) {
    const a = tx.get(this.accounts, s.accountId),
      c = tx.get(this.credentials, s.accountId);
    if (
      !a || !c || a.version !== s.securityVersion ||
      c.hash !== s.passwordHash || c.format !== s.passwordFormat
    ) throw new AccountFault("INVALID_CREDENTIALS");
    if (a.status !== "active") throw new AccountFault("ACCOUNT_BLOCKED");
    this.#name(a);
    return { a, c };
  }
  finishSignin(s: CredentialSnapshot, hash: Uint8Array, sessionId: string) {
    return this.#transaction("signin", [
      "account:" + s.accountId,
      "session:" + sessionId,
    ], (tx) => {
      const { a, c } = this.#snapshot(tx, s);
      if (c.mustChange) throw new AccountFault("PASSWORD_CHANGE_REQUIRED");
      return this.#entry(tx, a, this.#issue(tx, a, hash, sessionId), sessionId);
    });
  }
  resume(hash: Uint8Array, sessionId?: string) {
    const found = this.#token(hash);
    if (!found) {
      return Promise.reject(new AccountFault("ACCOUNT_TOKEN_INVALID"));
    }
    return this.#transaction("resume", [
      "account:" + found.accountId,
      ...sessionId ? ["session:" + sessionId] : [],
    ], (tx) => {
      const { a, t } = this.#authorize(tx, found.accountId, found.id);
      if (this.now - t.lastUsed > 3600000) {
        t.lastUsed = this.now;
        t.expires = this.now + 90 * DAY;
        tx.set(this.tokens, t.id, t);
      }
      if (sessionId) this.#link(tx, sessionId, a.id, t.id);
      return this.#entry(tx, a, t, sessionId);
    });
  }
  async logout(hash: Uint8Array) {
    const found = this.#token(hash);
    if (!found) return;
    await this.#transaction("logout", [
      "account:" + found.accountId,
      ...this.#linkKeys(found.accountId),
    ], (tx) => {
      const t = tx.get(this.tokens, found.id)!;
      t.revoked ??= this.now;
      tx.set(this.tokens, t.id, t);
      for (const l of tx.values(this.links)) {
        if (l.tokenId === t.id) {
          l.detached ??= this.now;
          tx.set(this.links, l.sessionId, l);
        }
      }
    });
  }
  async getPreferences(hash: Uint8Array): Promise<AccountPreferences> {
    const found = this.#token(hash);
    if (!found) throw new AccountFault("ACCOUNT_TOKEN_INVALID");
    const { a } = this.#authorize(new Journal(), found.accountId, found.id);
    return structuredClone(this.preferences.get(a.id)!);
  }
  async getMissionProgress(hash: Uint8Array): Promise<AccountMissionProgress> {
    const found = this.#token(hash);
    if (!found) throw new AccountFault("ACCOUNT_TOKEN_INVALID");
    const { a } = this.#authorize(new Journal(), found.accountId, found.id);
    return structuredClone(this.missionProgress.get(a.id)!);
  }
  addMissionProgress(
    hash: Uint8Array, missions: string[], findings: string[],
  ): Promise<AccountMissionProgress> {
    for (const list of [missions, findings]) {
      if (
        !Array.isArray(list) || list.length > MISSION_PROGRESS_MAX_ENTRIES ||
        !list.every(isMissionProgressId)
      ) return Promise.reject(new AccountFault("INVALID_REQUEST"));
    }
    const found = this.#token(hash);
    if (!found) return Promise.reject(new AccountFault("ACCOUNT_TOKEN_INVALID"));
    return this.#transaction("missions.add", ["account:" + found.accountId], (tx) => {
      const { a } = this.#authorize(tx, found.accountId, found.id);
      const current = tx.get(this.missionProgress, a.id)!;
      const next = {
        missions: [...new Set([...current.missions, ...missions])],
        findings: [...new Set([...current.findings, ...findings])],
      };
      // PostgreSQL jsonb::text includes a space after each comma and colon.
      // IDs are ASCII without escapes, so this matches the column's byte cap.
      const jsonbText = JSON.stringify(next).replaceAll(",", ", ").replaceAll(
        ":", ": ",
      );
      if (
        next.missions.length > MISSION_PROGRESS_MAX_ENTRIES ||
        next.findings.length > MISSION_PROGRESS_MAX_ENTRIES ||
        jsonbText.length > MISSION_PROGRESS_MAX_BYTES
      ) throw new AccountFault("INVALID_REQUEST");
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        tx.set(this.missionProgress, a.id, next);
      }
      return next;
    });
  }
  resetMissionProgress(hash: Uint8Array): Promise<AccountMissionProgress> {
    const found = this.#token(hash);
    if (!found) return Promise.reject(new AccountFault("ACCOUNT_TOKEN_INVALID"));
    return this.#transaction("missions.reset", ["account:" + found.accountId], (tx) => {
      const { a } = this.#authorize(tx, found.accountId, found.id);
      const next = { missions: [], findings: [] };
      tx.set(this.missionProgress, a.id, next);
      return next;
    });
  }
  updatePreferences(
    hash: Uint8Array,
    patch: PreferencePatch,
    expectedRevision: string,
  ): Promise<PreferenceUpdateResult> {
    const found = this.#token(hash);
    if (!found) {
      return Promise.reject(new AccountFault("ACCOUNT_TOKEN_INVALID"));
    }
    return this.#transaction(
      "preferences",
      ["account:" + found.accountId],
      (tx): PreferenceUpdateResult => {
        const { a } = this.#authorize(tx, found.accountId, found.id);
        const current = tx.get(this.preferences, a.id)!;
        if (current.revision !== expectedRevision) {
          return {
            status: "conflict",
            preferences: current,
          };
        }
        const next = {
          values: { ...current.values, ...patch },
          revision: (BigInt(current.revision) + 1n).toString(),
          updatedAt: new Date(this.now).toISOString(),
        };
        tx.set(this.preferences, a.id, next);
        return { status: "updated", preferences: next };
      },
    );
  }
  #revokeAll(tx: Journal, id: string) {
    for (const t of tx.values(this.tokens)) {
      if (t.accountId === id) {
        t.revoked ??= this.now;
        tx.set(this.tokens, t.id, t);
      }
    }
    for (const l of tx.values(this.links)) {
      if (l.accountId === id) {
        l.detached ??= this.now;
        tx.set(this.links, l.sessionId, l);
      }
    }
  }
  #linkKeys(id: string) {
    return [...this.links.values()].filter((l) => l.accountId === id).map((l) =>
      "session:" + l.sessionId
    ).sort();
  }
  changePassword(
    s: CredentialSnapshot,
    hash: string,
    format: string,
    tokenHash: Uint8Array,
    sessionId: string,
  ) {
    return this.#transaction("password", [
      "account:" + s.accountId,
      ...new Set(
        [...this.#linkKeys(s.accountId), "session:" + sessionId].sort(),
      ),
    ], (tx) => {
      const { a } = this.#snapshot(tx, s);
      a.version = (BigInt(a.version) + 1n).toString();
      tx.set(this.accounts, a.id, a);
      tx.set(this.credentials, a.id, { hash, format, mustChange: false });
      this.#revokeAll(tx, a.id);
      return this.#entry(
        tx,
        a,
        this.#issue(tx, a, tokenHash, sessionId),
        sessionId,
      );
    });
  }
  rehash(s: CredentialSnapshot, hash: string, format: string) {
    return this.#transaction("rehash", ["account:" + s.accountId], (tx) => {
      const a = tx.get(this.accounts, s.accountId),
        c = tx.get(this.credentials, s.accountId);
      if (
        !a || !c || a.status !== "active" || a.version !== s.securityVersion ||
        c.hash !== s.passwordHash || c.format !== s.passwordFormat
      ) return false;
      tx.set(this.credentials, a.id, { ...c, hash, format });
      return true;
    });
  }
  identity(
    hash: Uint8Array,
    sessionId: string,
  ): Promise<AccountIdentity | null> {
    const t = this.#token(hash), l = this.links.get(sessionId);
    if (
      !t || !l || l.tokenId !== t.id || l.detached !== null ||
      l.accountId !== t.accountId
    ) return Promise.resolve(null);
    try {
      const { a } = this.#authorize(new Journal(), t.accountId, t.id);
      return Promise.resolve({
        id: a.id,
        displayName: a.displayName,
        badge: "claimed-name",
      });
    } catch {
      return Promise.resolve(null);
    }
  }
  tokenSnapshot(
    hash: Uint8Array,
    sessionId?: string,
  ): Promise<GameIdentitySnapshot | null> {
    this.#step("tokenSnapshot");
    const t = this.#token(hash);
    if (!t) return Promise.resolve(null);
    const a = this.accounts.get(t.accountId)!;
    const l = sessionId === undefined ? undefined : this.links.get(sessionId);
    return Promise.resolve(structuredClone({
      account: {
        id: a.id,
        displayName: a.displayName,
        badge: "claimed-name" as const,
      },
      accountStatus: a.status,
      accountVersion: a.version,
      tokenVersion: t.version,
      tokenId: t.id,
      revokedAt: t.revoked === null ? null : new Date(t.revoked).toISOString(),
      expiresAt: new Date(t.expires).toISOString(),
      lastUsedAt: new Date(t.lastUsed).toISOString(),
      link: l
        ? {
          sessionId: l.sessionId,
          accountId: l.accountId,
          tokenId: l.tokenId,
          detachedAt: l.detached === null
            ? null
            : new Date(l.detached).toISOString(),
        }
        : null,
    }));
  }
  // Test-only simulation of set 04 reset/block; no production owner API.
  ownerTransition(
    accountId: string,
    options: { hash?: string; blocked?: boolean },
  ) {
    return this.#transaction("owner", [
      "account:" + accountId,
      ...this.#linkKeys(accountId),
    ], (tx) => {
      const a = tx.get(this.accounts, accountId)!;
      a.version = (BigInt(a.version) + 1n).toString();
      if (options.blocked !== undefined) {
        a.status = options.blocked ? "blocked" : "active";
      }
      tx.set(this.accounts, a.id, a);
      if (options.hash) {
        tx.set(this.credentials, a.id, {
          hash: options.hash,
          format: PASSWORD_FORMAT,
          mustChange: true,
        });
      }
      this.#revokeAll(tx, a.id);
    });
  }
}
