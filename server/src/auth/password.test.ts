import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashPassword, needsRehash, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("accepts the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(
      await verifyPassword("correct horse battery staple", hash),
      true,
    );
    assert.equal(await verifyPassword("wrong", hash), false);
  });

  it("stores scrypt hashes in the documented format", async () => {
    const hash = await hashPassword("pw");
    const [scheme, n, r, p, salt, key] = hash.split("$");

    assert.equal(scheme, "scrypt");
    assert.equal(Number(n), 2 ** 15);
    assert.equal(Number(r), 8);
    assert.equal(Number(p), 1);
    assert.ok(Buffer.from(salt, "base64").length >= 16);
    assert.equal(Buffer.from(key, "base64").length, 32);
  });

  it("produces a different hash each time (salted)", async () => {
    assert.notEqual(await hashPassword("same"), await hashPassword("same"));
  });

  it("still verifies legacy bcrypt hashes", async () => {
    // Accounts that predate the scrypt migration must keep working.
    const legacy = await bcrypt.hash("legacy-pw", 10);

    assert.equal(await verifyPassword("legacy-pw", legacy), true);
    assert.equal(await verifyPassword("nope", legacy), false);
  });

  it("flags legacy hashes for rehash but not current ones", async () => {
    const legacy = await bcrypt.hash("legacy-pw", 10);
    const current = await hashPassword("legacy-pw");

    assert.equal(needsRehash(legacy), true);
    assert.equal(needsRehash(current), false);
  });

  // A malformed record must never authenticate. The empty-key case is the
  // dangerous one: an empty expected key derives an empty actual key, and
  // timingSafeEqual(<empty>, <empty>) is true, so every password would pass.
  it("rejects malformed scrypt hashes instead of accepting any password", async () => {
    const malformed = [
      "scrypt$32768$8$1$abc$", // empty key
      "scrypt$32768$8$1$$", // empty salt and key
      "scrypt$32768$8$1", // too few fields
      "scrypt$32768$8$1$abc$def$ghi", // too many fields
      "scrypt$notanumber$8$1$YWJjZGVmZ2hpamtsbW5vcA==$" + "A".repeat(43) + "=",
      "scrypt$0$0$0$YWJjZGVmZ2hpamtsbW5vcA==$" + "A".repeat(43) + "=",
      "scrypt$", // prefix only
    ];

    for (const hash of malformed) {
      assert.equal(
        await verifyPassword("any password at all", hash),
        false,
        `malformed hash must not authenticate: ${JSON.stringify(hash)}`,
      );
    }
  });

  it("rejects a hash whose key is the wrong length", async () => {
    const valid = await hashPassword("pw");
    const [scheme, n, r, p, salt] = valid.split("$");
    const shortKey = Buffer.alloc(16).toString("base64");

    assert.equal(
      await verifyPassword("pw", [scheme, n, r, p, salt, shortKey].join("$")),
      false,
    );
  });
});
