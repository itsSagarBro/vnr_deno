import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCHEME = "scrypt";

/// Hashes a password with scrypt and a random salt. Stored as
/// `scrypt$<salt hex>$<hash hex>`; plaintext is never persisted or logged.
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_BYTES);
  return `${SCHEME}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/// Constant-time verification against a stored hash. Malformed values fail
/// closed instead of throwing into the global error handler.
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== SCHEME || !saltHex || !hashHex) return false;

  try {
    const expected = Buffer.from(hashHex, "hex");
    const salt = Buffer.from(saltHex, "hex");
    if (expected.length !== KEY_BYTES || salt.length !== SALT_BYTES) return false;

    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
