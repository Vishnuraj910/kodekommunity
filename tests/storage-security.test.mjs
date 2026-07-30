import assert from "node:assert/strict";
import test from "node:test";

import { isRoleDirectory } from "../src/roles.ts";
import {
  isStringArray,
  readStoredState,
  writeStoredState,
} from "../src/storage.ts";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  removeItem(key) {
    this.values.delete(key);
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

test("malformed or expired browser state is removed", () => {
  const storage = new MemoryStorage();
  storage.setItem("broken", "{");
  assert.deepEqual(
    readStoredState(storage, "broken", ["safe"], isStringArray),
    ["safe"],
  );
  assert.equal(storage.getItem("broken"), null);

  writeStoredState(storage, "expired", ["old"], 100, 1_000);
  assert.deepEqual(
    readStoredState(storage, "expired", ["safe"], isStringArray, 1_101),
    ["safe"],
  );
  assert.equal(storage.getItem("expired"), null);
});

test("tampered role directories fail validation", () => {
  const validDirectory = {
    maya: [
      { role: "root", scope: "platform" },
      { role: "user", scope: "platform" },
    ],
  };
  const crossScopeRole = {
    maya: [
      { role: "admin", scope: "platform" },
      { role: "user", scope: "platform" },
    ],
  };
  const missingBaseline = {
    maya: [{ role: "root", scope: "platform" }],
  };

  assert.equal(isRoleDirectory(validDirectory), true);
  assert.equal(isRoleDirectory(crossScopeRole), false);
  assert.equal(isRoleDirectory(missingBaseline), false);
});
