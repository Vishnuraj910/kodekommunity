import assert from "node:assert/strict";
import { test } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "../src/services/passwords.js";

test("passwords are salted, verifiable, and reject incorrect plaintext", async () => {
  const plaintext = "Correct horse battery staple! 2026";

  const firstHash = await hashPassword(plaintext);
  const secondHash = await hashPassword(plaintext);

  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(plaintext, firstHash), true);
  assert.equal(await verifyPassword("incorrect password", firstHash), false);
  assert.equal(await verifyPassword(plaintext, "not-a-password-hash"), false);
  assert.equal(
    await verifyPassword(plaintext, "scrypt$1$8$1$c2FsdA$a2V5"),
    false,
  );
  assert.equal(
    await verifyPassword(plaintext, "scrypt$131072$8$1$c2FsdA$a2V5"),
    false,
  );
});
