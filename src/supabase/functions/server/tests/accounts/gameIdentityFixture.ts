import { createGameRequestIdentity } from "../../accounts/gameRequestIdentity.ts";
import type { AccountsMode } from "../../accounts/accountsMode.ts";
import { nameKeys } from "../../accounts/nameKeys.ts";
import { issueToken } from "../../accounts/tokens.ts";
import { FakeAccountRepository, FakeHasher } from "./fakeAccountRepository.ts";
import { gameIdentityFixture } from "../routes/game_identity_fixture.ts";
import { FakeStreakRepository } from "./fakeStreakRepository.ts";
import { StreakTestStore } from "./streakTestStore.ts";
import type { StreakRepository } from "../../accounts/streakRepository.ts";

export function enabledGameFixture(
  mode: AccountsMode = "on",
  bindName?: Parameters<typeof createGameRequestIdentity>[0]["bindName"],
) {
  const repository = new FakeAccountRepository(), hasher = new FakeHasher();
  repository.rules.push(
    ...["system", "computer"].map((key) => ({
      kind: "reserved" as const,
      match: "exact" as const,
      key,
    })),
  );
  const calls = {
    names: [] as string[],
    identities: 0,
    get rules() {
      return repository.ruleReads;
    },
    resumes: 0,
    acquisitions: 0,
    binds: 0,
  };
  let seed = 0;
  const wrapped = {
    nameStatus(name: string) {
      calls.names.push(name);
      return repository.nameStatus(name);
    },
    tokenSnapshot: (...args: Parameters<typeof repository.tokenSnapshot>) => {
      calls.identities++;
      return repository.tokenSnapshot(...args);
    },
    resume: (...args: Parameters<typeof repository.resume>) => {
      calls.resumes++;
      return repository.resume(...args);
    },
  };
  const resolver = createGameRequestIdentity({
    mode: mode === "off" ? "on" : mode,
    getRepository: () => {
      calls.acquisitions++;
      return wrapped;
    },
    now: () => repository.now,
    bindName: async (token, session, name) => {
      calls.binds++;
      if (bindName) return await bindName(token, session, name);
      const stored = f.sessions.get(token) ??
        f.persistence.store.get(`session_token_${token}`);
      if (!stored) throw new Error("Unknown fixture session");
      stored.displayName ||= name;
      return stored.displayName.trim();
    },
  });
  const streaks = new FakeStreakRepository(repository);
  const streakCalls: string[] = [], streakLogs: string[] = [];
  let streakLoads = 0;
  const streakRepository: StreakRepository = {
    reconcile: (input) => { streakCalls.push('reconcile'); return streaks.reconcile(input); },
    reset: (input) => { streakCalls.push('reset'); return streaks.reset(input); },
    importGuest: (input) => { streakCalls.push('importGuest'); return streaks.importGuest(input); },
    commitGame: (input) => { streakCalls.push('commitGame'); return streaks.commitGame(input); },
  };
  const f = gameIdentityFixture({ mode, getResolver: () => resolver }, undefined, {
    getRepository: () => { streakLoads++; return Promise.resolve(streakRepository); },
    log: (category, code) => { streakLogs.push(category + ':' + code); },
  }, new StreakTestStore(streaks));
  const preferences = {
    soundEnabled: true,
    healthFlashEnabled: true,
    chatMinimized: false,
    battleLogPreferred: false,
    musicEnabled: true,
  };
  async function claim(name = "Pilot1", sessionId = "p1") {
    const token = await issueToken((n) => new Uint8Array(n).fill(++seed));
    const entry = await repository.claim({
      ...nameKeys(name),
      passwordHash: hasher.credential("abcdefghij"),
      passwordFormat: "nfc-argon2id-v1",
      tokenHash: token.hash,
      sessionId,
      preferences,
    });
    return { ...token, entry, headers: { "X-Account-Token": token.raw } };
  }
  function resetCalls() {
    calls.names.length = 0;
    repository.ruleReads = 0;
    calls.identities =
      calls.resumes =
      calls.acquisitions =
      calls.binds =
        0;
  }
  return {
    ...f,
    repository,
    streaks,
    streakCalls,
    streakLogs,
    streakRepository,
    get streakLoads() { return streakLoads; },
    resolver,
    calls,
    claim,
    resetCalls,
    ban(name: string) {
      repository.rules.push({
        kind: "banned",
        match: "contains",
        key: nameKeys(name).moderationKey,
      });
    },
  };
}
