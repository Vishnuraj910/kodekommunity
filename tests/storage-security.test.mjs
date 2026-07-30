import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isRoleDirectory } from "../src/roles.ts";
import {
  clearKommunityBrowserData,
  clearStoredNamespace,
  isStringArray,
  readStoredState,
  writeStoredState,
} from "../src/storage.ts";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
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

test("device-data purge removes only Kommunity-owned values", () => {
  const storage = new MemoryStorage();
  storage.setItem("kommunity-theme", "dark");
  storage.setItem("kommunity-messages", "private");
  storage.setItem("another-app-session", "preserve");

  assert.equal(clearStoredNamespace(storage), 2);
  assert.equal(storage.getItem("kommunity-theme"), null);
  assert.equal(storage.getItem("kommunity-messages"), null);
  assert.equal(storage.getItem("another-app-session"), "preserve");
});

test("browser-data purge covers local state, session messages, and owned caches", async () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const deletedCaches = [];
  localStorage.setItem("kommunity-theme", "light");
  localStorage.setItem("another-app-theme", "dark");
  sessionStorage.setItem("kommunity-messages", "private");
  sessionStorage.setItem("another-app-session", "preserve");

  await clearKommunityBrowserData({
    localStorage,
    sessionStorage,
    caches: {
      keys: async () => ["kommunity-shell-v2", "another-app-cache"],
      delete: async (key) => {
        deletedCaches.push(key);
        return true;
      },
    },
  });

  assert.equal(localStorage.getItem("kommunity-theme"), null);
  assert.equal(localStorage.getItem("another-app-theme"), "dark");
  assert.equal(sessionStorage.getItem("kommunity-messages"), null);
  assert.equal(sessionStorage.getItem("another-app-session"), "preserve");
  assert.deepEqual(deletedCaches, ["kommunity-shell-v2"]);
});

test("browser-data purge reports cache cleanup failures", async () => {
  await assert.rejects(
    clearKommunityBrowserData({
      localStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      caches: {
        keys: async () => {
          throw new Error("cache unavailable");
        },
        delete: async () => true,
      },
    }),
    /cache unavailable/,
  );
});

test("rehydration does not extend stored-state expiry", async () => {
  const app = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(app, /if \(!storage \|\| !shouldPersist\.current\) return/);
  assert.match(app, /shouldPersist\.current = true/);
});

test("live UI authorization preserves identity lifecycle status", async () => {
  const app = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(app, /const viewerStatus = identityStatuses\.maya \?\? "revoked"/);
  assert.match(app, /status: viewerStatus/);
  assert.doesNotMatch(app, /activeSubject/);
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
