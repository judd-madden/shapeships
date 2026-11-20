import assert from "node:assert/strict";
import { accountServiceLoader } from "../../accounts/accountServiceLoader.ts";
import type { AccountService } from "../../accounts/accountService.ts";

Deno.test("lazy account service shares concurrent loads, clears rejection and retains success", async () => {
  let calls = 0;
  const service = {
    handle: () => Promise.resolve(new Response()),
    optionalIdentity: () => Promise.resolve(null),
  } satisfies AccountService;
  const load = accountServiceLoader(() => {
    calls++;
    return calls === 1
      ? Promise.reject(new Error("import failed"))
      : Promise.resolve(service);
  });
  const first = load();
  assert.equal(first, load());
  await assert.rejects(first, /import failed/);
  assert.equal(await load(), service);
  assert.equal(await load(), service);
  assert.equal(calls, 2);
});
