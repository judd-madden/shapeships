import {
  createPasswordHasher,
  type PasswordHasher,
} from "../../../../src/supabase/functions/server/accounts/passwordHashing.ts";
import { PASSWORD_FORMAT } from "../../../../src/supabase/functions/server/accounts/passwordPolicy.ts";
import {
  type RandomBytes,
  secureRandomBytes,
} from "../../../../src/supabase/functions/server/accounts/tokens.ts";

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const passwordLength = 12;
const acceptanceLimit = 248; // 31 symbols * 8 equally likely byte values.
const phc =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;

interface ResetInput {
  accountId: string;
  securityVersion: string;
  note: string;
}

class ResetInputError extends Error {}

export function parseResetArgs(args: readonly string[]): ResetInput {
  if (args.length < 2 || args.length > 3) {
    throw new ResetInputError(
      'Usage: owner-password-reset.ts <uuid> <version> ["note"]',
    );
  }
  const [accountId, version, note = "Owner password reset"] = args;
  if (
    accountId.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(accountId)
  ) {
    throw new ResetInputError("Account ID must be a UUID in hyphenated form.");
  }
  if (version === "" || /[^0-9]/.test(version)) {
    throw new ResetInputError(
      "Security version must be a positive decimal integer.",
    );
  }
  const securityVersion = BigInt(version);
  if (securityVersion < 1n || securityVersion > 9223372036854775807n) {
    throw new ResetInputError(
      "Security version must be within positive bigint range.",
    );
  }
  if (
    note.trim() === "" || Array.from(note).length > 500 ||
    /[\p{Cc}\p{Zl}\p{Zp}\uD800-\uDFFF]/u.test(note)
  ) {
    throw new ResetInputError(
      "Note must contain 1-500 characters, with no controls, line breaks or malformed Unicode.",
    );
  }
  return {
    accountId: accountId.toLowerCase(),
    securityVersion: securityVersion.toString(),
    note,
  };
}

export function generateTemporaryPassword(
  random: RandomBytes = secureRandomBytes,
): string {
  let password = "";
  while (password.length < passwordLength) {
    const needed = passwordLength - password.length;
    const bytes = random(needed);
    if (bytes.length !== needed) throw new Error("Invalid random source.");
    for (const byte of bytes) {
      if (byte < acceptanceLimit) password += alphabet[byte % alphabet.length];
    }
  }
  return password;
}

// Standard PostgreSQL literals: standard_conforming_strings must remain on.
function quote(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'";
}

function resetSql(input: ResetInput, encoded: string): string {
  return [
    "SELECT public.account_owner_apply_password_reset(",
    `  p_account_id => ${quote(input.accountId)}::uuid,`,
    `  p_expected_security_version => ${input.securityVersion}::bigint,`,
    `  p_password_hash => ${quote(encoded)},`,
    `  p_password_format => ${quote(PASSWORD_FORMAT)},`,
    `  p_note => ${quote(input.note)}`,
    ") AS outcome;",
  ].join("\n");
}

export async function runOwnerPasswordReset(
  args: readonly string[],
  options: {
    stdout: (output: string) => void;
    stderr: (message: string) => void;
    random?: RandomBytes;
    hasher?: PasswordHasher;
  },
): Promise<number> {
  try {
    const input = parseResetArgs(args);
    const password = generateTemporaryPassword(options.random);
    const hasher = options.hasher ?? createPasswordHasher();
    const encoded = await hasher.hash(password);
    if (
      PASSWORD_FORMAT !== "nfc-argon2id-v1" || encoded.length !== 97 ||
      !phc.test(encoded)
    ) {
      throw new Error("Unexpected password encoding.");
    }
    // Production verification also rejects noncanonical base64 pad bits.
    const verified = await hasher.verify(password, encoded, PASSWORD_FORMAT);
    if (!verified.matches || verified.needsRehash) {
      throw new Error("Password verification failed.");
    }
    const grouped = [
      password.slice(0, 4),
      password.slice(4, 8),
      password.slice(8, 12),
    ].join(" ");
    const sql = resetSql(input, encoded);
    if (sql.includes(password) || sql.includes(grouped)) {
      throw new Error("Password must not appear in SQL.");
    }
    // This is intentional one-time private terminal delivery, after all checks.
    options.stdout([
      "Temporary password (shown once)",
      `Account UUID: ${input.accountId}`,
      grouped,
      "The player types these 12 characters without spaces.",
      "",
      "SQL to paste",
      sql,
    ].join("\n"));
    return 0;
  } catch (error) {
    // Do not print raw hashing/randomness errors: they may contain secrets.
    options.stderr(
      error instanceof ResetInputError
        ? error.message
        : "Password-reset generation failed its self-check; discard any output.",
    );
    return 1;
  }
}

if (import.meta.main) {
  Deno.exitCode = await runOwnerPasswordReset(Deno.args, {
    stdout: (output) => console.log(output),
    stderr: (message) => console.error(message),
  });
}
