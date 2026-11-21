import assert from "node:assert/strict";
import { createGameSessionRenewer } from "../../accounts/gameRequestIdentity.ts";

export const HOUR = 3_600_000;
export function sessionKvFixture() {
  const rows = new Map<string, any>();
  const calls: Array<{ operation: string; key: string }> = [];
  let failAt = 0;
  let beforeWrite: ((key: string) => void) | undefined;
  const client = {
    from(table: string) {
      assert.equal(table, "kv_store_825e19ab");
      let key = "", expected: string | undefined, patch: any;
      const query = {
        select(column: string): any {
          if (!patch) {
            assert.equal(column, "value");
            return query;
          }
          assert.equal(column, "key");
          return run("cas");
        },
        eq(column: string, value: string) {
          if (column === "key") key = value;
          else {
            assert.equal(column, "value");
            expected = value;
          }
          return query;
        },
        update(value: any) {
          patch = value.value;
          return query;
        },
        maybeSingle() {
          return run("read");
        },
      };
      async function run(operation: string) {
        calls.push({ operation, key });
        if (calls.length === failAt) {
          throw new Error("synthetic transport failure");
        }
        if (operation === "read") {
          return {
            data: rows.has(key)
              ? { value: structuredClone(rows.get(key)) }
              : null,
            error: null,
          };
        }
        beforeWrite?.(key);
        if (JSON.stringify(rows.get(key)) !== expected) {
          return { data: [], error: null };
        }
        rows.set(key, structuredClone(patch));
        return { data: [{ key }], error: null };
      }
      return query;
    },
  };
  const session = {
    sessionId: "p1",
    createdAt: "2026-11-21T00:00:00.000Z",
    displayName: null,
  };
  const start = Date.parse(session.createdAt);
  const clock = { now: start + 2 * HOUR };
  const renew = createGameSessionRenewer(client, () => clock.now);
  rows.set("session_token_p1", { ...session, sessionToken: "p1" });
  rows.set("session_id_p1", { ...session, sessionToken: "p1" });
  return {
    rows,
    calls,
    client,
    session,
    start,
    clock,
    renew,
    fail(at: number) {
      failAt = at;
    },
    beforeWrite(callback: (key: string) => void) {
      beforeWrite = callback;
    },
  };
}
