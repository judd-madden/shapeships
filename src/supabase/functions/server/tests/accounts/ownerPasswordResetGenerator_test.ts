import assert from "node:assert/strict";
import {
  generateTemporaryPassword,
  parseResetArgs,
  runOwnerPasswordReset,
} from "../../../../../../supabase/manual/account/tools/owner-password-reset.ts";
import {
  createPasswordHasher,
  type PasswordHasher,
} from "../../accounts/passwordHashing.ts";
import {
  normalizePassword,
  PASSWORD_FORMAT,
} from "../../accounts/passwordPolicy.ts";
import type { RandomBytes } from "../../accounts/tokens.ts";

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const accountId = "11111111-1111-4111-8111-111111111111";
const args = [accountId, "9007199254740993"];
const syntheticHash = "$argon2id$v=19$m=19456,t=2,p=1$" +
  "A".repeat(22) + "$" + "A".repeat(43);
const stubHasher: PasswordHasher = {
  hash: () => Promise.resolve(syntheticHash),
  verify: () => Promise.resolve({ matches: true, needsRehash: false }),
};

async function capture(
  input: readonly string[] = args,
  dependencies: { random?: RandomBytes; hasher?: PasswordHasher } = {},
) {
  const stdout: string[] = [], stderr: string[] = [];
  const status = await runOwnerPasswordReset(input, {
    stdout: (output) => stdout.push(output),
    stderr: (message) => stderr.push(message),
    random: (length) => new Uint8Array(length).fill(1),
    hasher: stubHasher,
    ...dependencies,
  });
  return { status, stdout, stderr };
}

Deno.test({
  name:
    "owner reset: all 248 accepted bytes map equally to twelve policy-valid characters",
  permissions: "none",
  fn() {
    const counts = new Map<string, number>();
    assert.equal(alphabet.length, 31);
    for (let byte = 0; byte < 248; byte++) {
      const password = generateTemporaryPassword((n) =>
        new Uint8Array(n).fill(byte)
      );
      assert.equal(password, alphabet[byte % 31].repeat(12));
      assert.equal(normalizePassword(password), password);
      counts.set(password[0], (counts.get(password[0]) ?? 0) + 1);
    }
    assert.equal(counts.size, 31);
    assert.ok([...counts.values()].every((count) => count === 8));
  },
});

Deno.test({
  name:
    "owner reset: rejection sampling discards every byte from 248 through 255",
  permissions: "none",
  fn() {
    const stream = [
      248,
      249,
      250,
      251,
      252,
      253,
      254,
      255,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
    ];
    let consumed = 0;
    const password = generateTemporaryPassword((n) => {
      assert.ok(consumed + n <= stream.length);
      return Uint8Array.from(stream.slice(consumed, consumed += n));
    });
    assert.equal(password, alphabet.slice(0, 12));
    assert.equal(consumed, 20);
    assert.match(password, /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/);
    assert.throws(() => generateTemporaryPassword(() => new Uint8Array(0)));
  },
});

Deno.test({
  name:
    "owner reset: real production hashing and verification run with zero permissions",
  permissions: "none",
  async fn() {
    const result = await capture(args, { hasher: createPasswordHasher() });
    assert.equal(result.status, 0);
    assert.deepEqual(result.stderr, []);
    assert.equal(result.stdout.length, 1);
    const [passwordBlock, sql] = result.stdout[0].split("\n\nSQL to paste\n");
    const lines = passwordBlock.split("\n");
    assert.equal(lines[0], "Temporary password (shown once)");
    assert.equal(lines[1], `Account UUID: ${accountId}`);
    assert.match(lines[2], /^[a-z2-9]{4} [a-z2-9]{4} [a-z2-9]{4}$/);
    assert.equal(lines[2], "bbbb bbbb bbbb");
    assert.equal(
      lines[3],
      "The player types these 12 characters without spaces.",
    );
    const password = lines[2].replaceAll(" ", "");
    const encoded = /p_password_hash => '([^']+)'/.exec(sql)![1];
    assert.equal(encoded.length, 97);
    assert.match(
      encoded,
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
    assert.deepEqual(
      await createPasswordHasher().verify(password, encoded, PASSWORD_FORMAT),
      {
        matches: true,
        needsRehash: false,
      },
    );
    assert.equal(
      (await createPasswordHasher().verify(
        "cccccccccccc",
        encoded,
        PASSWORD_FORMAT,
      )).matches,
      false,
    );
    assert.equal(result.stdout[0].split(lines[2]).length, 2);
    assert.ok(!sql.includes(password));
  },
});

Deno.test({
  name:
    "owner reset: hashes and verifies the unseparated twelve-character password before output",
  permissions: "none",
  async fn() {
    const calls: string[] = [];
    let emitted = false;
    const status = await runOwnerPasswordReset(args, {
      random: (n) => new Uint8Array(n).fill(2),
      hasher: {
        hash(password) {
          assert.equal(password, "cccccccccccc");
          calls.push("hash");
          return Promise.resolve(syntheticHash);
        },
        verify(password, encoded, format) {
          assert.equal(password, "cccccccccccc");
          assert.equal(encoded, syntheticHash);
          assert.equal(format, "nfc-argon2id-v1");
          assert.equal(emitted, false);
          calls.push("verify");
          return Promise.resolve({ matches: true, needsRehash: false });
        },
      },
      stdout() {
        emitted = true;
        calls.push("output");
      },
      stderr() {
        assert.fail("Unexpected generator failure");
      },
    });
    assert.equal(status, 0);
    assert.deepEqual(calls, ["hash", "verify", "output"]);
  },
});

Deno.test({
  name:
    "owner reset: plain SQL literals safely contain apostrophes, backslashes and SQL-like notes",
  permissions: "none",
  async fn() {
    const note = "Owner's C:\\reset; SELECT 'quoted' -- remains a note";
    const result = await capture([...args, note]);
    assert.equal(result.status, 0);
    const sql = result.stdout[0].split("\n\nSQL to paste\n")[1];
    assert.equal(
      sql,
      [
        "SELECT public.account_owner_apply_password_reset(",
        `  p_account_id => '${accountId}'::uuid,`,
        "  p_expected_security_version => 9007199254740993::bigint,",
        `  p_password_hash => '${syntheticHash}',`,
        "  p_password_format => 'nfc-argon2id-v1',",
        "  p_note => 'Owner''s C:\\reset; SELECT ''quoted'' -- remains a note'",
        ") AS outcome;",
      ].join("\n"),
    );
    const outsideLiterals = sql.replace(/'(?:[^']|'')*'/g, "''");
    assert.equal(outsideLiterals.match(/;/g)?.length, 1);
    assert.equal(outsideLiterals.match(/\bSELECT\b/g)?.length, 1);
    assert.ok(!/\bE'/.test(sql));
    assert.ok(!sql.includes("bbbbbbbbbbbb"));
    assert.ok(!sql.includes("bbbb bbbb bbbb"));
  },
});

Deno.test({
  name:
    "owner reset: UUID, bigint and Unicode note boundaries preserve valid input",
  permissions: "none",
  async fn() {
    for (const version of ["1", "9007199254740993", "9223372036854775807"]) {
      assert.equal(
        parseResetArgs([accountId, version]).securityVersion,
        version,
      );
    }
    const uppercaseId = "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF";
    assert.equal(
      parseResetArgs([uppercaseId, "0001"]).accountId,
      uppercaseId.toLowerCase(),
    );
    assert.equal(parseResetArgs([accountId, "0001"]).securityVersion, "1");
    assert.equal(parseResetArgs(args).note, "Owner password reset");
    for (const note of ["x", " x ", "x".repeat(500), "\u{1f600}".repeat(500)]) {
      assert.equal(parseResetArgs([...args, note]).note, note);
    }
    const result = await capture([accountId, "9223372036854775807"]);
    assert.equal(result.status, 0);
    assert.ok(
      result.stdout[0].includes(
        "p_expected_security_version => 9223372036854775807::bigint",
      ),
    );
    assert.ok(result.stdout[0].includes("p_note => 'Owner password reset'"));
  },
});

Deno.test({
  name:
    "owner reset: invalid arguments and every control character fail before randomness or hashing",
  permissions: "none",
  async fn() {
    const invalid: string[][] = [[], [accountId], [...args, "note", "extra"]];
    for (
      const uuid of [
        "",
        "bad",
        accountId.replaceAll("-", ""),
        accountId + "\n",
        accountId + "'; SELECT 1;",
      ]
    ) {
      invalid.push([uuid, "1"]);
    }
    for (
      const version of [
        "",
        "0",
        "000",
        "-1",
        "+1",
        "1.0",
        "1e3",
        "NaN",
        " 1",
        "1 ",
        "1\n",
        "1\r\n",
        "\u0661",
        "9223372036854775808",
      ]
    ) {
      invalid.push([accountId, version]);
    }
    for (
      const note of [
        "",
        "   ",
        "x".repeat(501),
        "\u{1f600}".repeat(501),
        "x\ud800",
        "\udc00x",
        "x\u2028y",
        "x\u2029y",
      ]
    ) {
      invalid.push([...args, note]);
    }
    for (let code = 0; code <= 159; code++) {
      if (code <= 31 || code >= 127) {
        invalid.push([...args, "x" + String.fromCharCode(code) + "y"]);
      }
    }
    for (const input of invalid) {
      const result = await capture(input, {
        random() {
          assert.fail("Invalid input reached randomness");
        },
        hasher: {
          hash() {
            assert.fail("Invalid input reached hashing");
          },
          verify() {
            assert.fail("Invalid input reached verification");
          },
        },
      });
      assert.equal(result.status, 1);
      assert.deepEqual(result.stdout, []);
      assert.equal(result.stderr.length, 1);
      assert.match(result.stderr[0], /Usage:|UUID|Security version|Note must/);
    }
  },
});

Deno.test({
  name:
    "owner reset: malformed and noncanonical PHC strings never produce secret output",
  permissions: "none",
  async fn() {
    const production = createPasswordHasher();
    const encoded = await production.hash("bbbbbbbbbbbb");
    const parts = encoded.split("$");
    const saltPadBits = [...parts];
    saltPadBits[4] = parts[4].slice(0, -1) + "B";
    const hashPadBits = [...parts];
    hashPadBits[5] = parts[5].slice(0, -1) + "B";
    const malformed = [
      "malformed",
      encoded + "=",
      encoded + "\n",
      ...["v=19", "m=19456", "t=2", "p=1", "argon2id"].map((part) =>
        encoded.replace(part, part + "0")
      ),
      saltPadBits.join("$"),
      hashPadBits.join("$"),
    ];
    for (const bad of malformed) {
      const result = await capture(args, {
        hasher: { hash: () => Promise.resolve(bad), verify: production.verify },
      });
      assert.equal(result.status, 1);
      assert.deepEqual(result.stdout, []);
      assert.equal(result.stderr.length, 1);
      assert.ok(!result.stderr[0].includes(bad));
      assert.ok(!result.stderr[0].includes("bbbbbbbbbbbb"));
    }
  },
});

Deno.test({
  name:
    "owner reset: failed self-checks and raw dependency errors are safely contained",
  permissions: "none",
  async fn() {
    const leak = "bbbbbbbbbbbb " + syntheticHash;
    const failures: PasswordHasher[] = [
      {
        ...stubHasher,
        hash() {
          throw new Error(leak);
        },
      },
      {
        ...stubHasher,
        verify() {
          throw new Error(leak);
        },
      },
      {
        ...stubHasher,
        verify: () => Promise.resolve({ matches: false, needsRehash: false }),
      },
      {
        ...stubHasher,
        verify: () => Promise.resolve({ matches: true, needsRehash: true }),
      },
    ];
    const results = await Promise.all(
      failures.map((hasher) => capture(args, { hasher })),
    );
    results.push(
      await capture(args, {
        random() {
          throw new Error(leak);
        },
      }),
    );
    results.push(await capture(args, { random: () => new Uint8Array(0) }));
    results.push(await capture([...args, "bbbbbbbbbbbb"]));
    results.push(await capture([...args, "bbbb bbbb bbbb"]));
    for (const result of results) {
      assert.equal(result.status, 1);
      assert.deepEqual(result.stdout, []);
      assert.deepEqual(result.stderr, [
        "Password-reset generation failed its self-check; discard any output.",
      ]);
    }
  },
});

Deno.test("owner reset: tool imports only production password/policy/token helpers and has no privileged APIs", async () => {
  // This URL is within the existing --allow-read=supabase/manual/account grant.
  const source = await Deno.readTextFile(
    new URL(
      "../../../../../../supabase/manual/account/tools/owner-password-reset.ts",
      import.meta.url,
    ),
  );
  assert.deepEqual(
    [...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map((match) => match[1]).sort(),
    [
      "../../../../src/supabase/functions/server/accounts/passwordHashing.ts",
      "../../../../src/supabase/functions/server/accounts/passwordPolicy.ts",
      "../../../../src/supabase/functions/server/accounts/tokens.ts",
    ],
  );
  assert.ok(
    !/\bimport\s*\(|supabase-js|index\.tsx|\bfetch\s*\(|\bWebSocket\b|\brequire\s*\(|\bprocess\b/
      .test(source),
  );
  assert.deepEqual(
    [...source.matchAll(/\bDeno\.(\w+)/g)].map((match) => match[1]).sort(),
    ["args", "exitCode"],
  );
});
