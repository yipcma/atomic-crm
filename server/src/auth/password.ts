import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import bcrypt from "bcryptjs";

// Hand-wrapped rather than promisify()'d: promisify resolves to scrypt's
// 3-argument overload and drops the options object we need for maxmem.
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

// scrypt over bcryptjs: bcryptjs is pure JS and therefore blocks the event
// loop, so raising its cost factor would turn every login into a denial of
// service on a single-threaded process. node:crypto's scrypt runs on the libuv
// threadpool instead, so the work is real but off the event loop.
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// N=2^15 needs ~128 * N * r bytes; the default 32 MB cap would throw.
const MAX_MEM = 128 * SCRYPT_N * SCRYPT_R * 2;

const PREFIX = "scrypt";

async function derive(
  password: string,
  salt: Buffer,
  n = SCRYPT_N,
  r = SCRYPT_R,
  p = SCRYPT_P,
  keyLength = KEY_LENGTH,
): Promise<Buffer> {
  return scryptAsync(password, salt, keyLength, {
    N: n,
    r,
    p,
    maxmem: MAX_MEM,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt);
  return [
    PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // Accounts created before the migration still carry bcrypt hashes.
  if (!hash.startsWith(`${PREFIX}$`)) {
    return bcrypt.compare(password, hash);
  }

  const parts = hash.split("$");
  if (parts.length !== 6) return false;
  const [, n, r, p, saltPart, keyPart] = parts;

  const salt = Buffer.from(saltPart, "base64");
  const expected = Buffer.from(keyPart, "base64");
  // Reject structurally invalid hashes outright. Without this, a truncated or
  // corrupted record with an empty key would derive an empty key too, and
  // timingSafeEqual(<empty>, <empty>) is true -- i.e. every password would be
  // accepted for that account.
  if (
    salt.length < SALT_LENGTH ||
    expected.length !== KEY_LENGTH ||
    !Number.isInteger(Number(n)) ||
    !Number.isInteger(Number(r)) ||
    !Number.isInteger(Number(p)) ||
    Number(n) < 2 ||
    Number(r) < 1 ||
    Number(p) < 1
  ) {
    return false;
  }

  let actual: Buffer;
  try {
    actual = await derive(
      password,
      salt,
      Number(n),
      Number(r),
      Number(p),
      expected.length,
    );
  } catch {
    // Absurd cost parameters in a corrupted record must not crash a login.
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// True for a hash stored under the old scheme, so callers can transparently
// upgrade it on the next successful login.
export function needsRehash(hash: string): boolean {
  return !hash.startsWith(`${PREFIX}$`);
}
