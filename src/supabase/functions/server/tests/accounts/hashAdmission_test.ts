import assert from "node:assert/strict";
import { HashAdmission } from "../../accounts/hashAdmission.ts";

Deno.test("four hash admissions, no queue, and finally releases after failure", async () => {
  const admission = new HashAdmission();
  const gates = Array.from({ length: 4 }, () => Promise.withResolvers<void>());
  const jobs = gates.map((gate) => admission.run(() => gate.promise));
  let fifthStarted = false;
  await assert.rejects(() =>
    admission.run(async () => {
      fifthStarted = true;
    }), { code: "AUTH_BUSY", retryAfterSeconds: 2 });
  assert.equal(fifthStarted, false);
  gates[0].reject(new Error("synthetic"));
  await assert.rejects(() => jobs[0]);
  assert.equal(
    await admission.run(() => Promise.resolve("replacement")),
    "replacement",
  );
  for (const gate of gates.slice(1)) gate.resolve();
  await Promise.all(jobs.slice(1));
  await assert.rejects(() =>
    admission.run(() => {
      throw new Error("sync failure");
    })
  );
  assert.equal(await admission.run(() => Promise.resolve(1)), 1);
});
