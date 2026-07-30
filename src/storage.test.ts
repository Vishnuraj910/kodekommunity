import { describe, expect, it, vi } from "vitest";
import {
  clearKommunityBrowserData,
  clearStoredNamespace,
  isBoolean,
  isString,
  isStringArray,
  readStoredState,
  writeStoredState,
} from "./storage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("bounded browser storage", () => {
  it("round trips valid versioned state with and without expiry", () => {
    const storage = new MemoryStorage();
    writeStoredState(storage, "state", ["one"], 1_000, 100);
    expect(readStoredState(storage, "state", [], isStringArray, 500)).toEqual(["one"]);
    writeStoredState(storage, "forever", true);
    expect(readStoredState(storage, "forever", false, isBoolean)).toBe(true);
    expect(readStoredState(storage, "missing", "fallback", isString)).toBe("fallback");
  });

  it("removes malformed, expired, oversized, and invalid values", () => {
    const storage = new MemoryStorage();
    const fallback: string[] = [];
    for (const [key, raw] of [
      ["json", "{"],
      ["version", JSON.stringify({ version: 2, expiresAt: null, value: ["x"] })],
      ["expiry", JSON.stringify({ version: 1, expiresAt: 99, value: ["x"] })],
      ["invalid", JSON.stringify({ version: 1, expiresAt: null, value: [1] })],
      ["bad-expiry", JSON.stringify({ version: 1, expiresAt: "never", value: ["x"] })],
      ["huge", "x".repeat(1_000_001)],
    ]) {
      storage.setItem(key, raw);
      expect(readStoredState(storage, key, fallback, isStringArray, 100)).toBe(fallback);
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it("tolerates unavailable storage", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("full");
      }),
    };
    expect(readStoredState(storage, "state", true, isBoolean)).toBe(true);
    expect(() => writeStoredState(storage, "state", true)).not.toThrow();
  });

  it("validates bounded primitive helpers", () => {
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean("false")).toBe(false);
    expect(isString("hello")).toBe(true);
    expect(isString("x".repeat(257))).toBe(false);
    expect(isStringArray(["a", "b"])).toBe(true);
    expect(isStringArray("a")).toBe(false);
    expect(isStringArray(Array.from({ length: 1_001 }, () => "x"))).toBe(false);
    expect(isStringArray([1])).toBe(false);
  });

  it("clears only application namespaces and caches", async () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    localStorage.setItem("kommunity-theme", "dark");
    localStorage.setItem("other", "keep");
    sessionStorage.setItem("kommunity-draft", "hello");
    expect(clearStoredNamespace(localStorage)).toBe(1);
    expect(localStorage.getItem("other")).toBe("keep");

    const deleteCache = vi.fn().mockResolvedValue(true);
    await clearKommunityBrowserData({
      localStorage,
      sessionStorage,
      caches: {
        keys: vi.fn().mockResolvedValue(["kommunity-shell-v2", "other-cache"]),
        delete: deleteCache,
      },
    });
    expect(sessionStorage.getItem("kommunity-draft")).toBeNull();
    expect(deleteCache).toHaveBeenCalledWith("kommunity-shell-v2");

    await expect(
      clearKommunityBrowserData({
        localStorage,
        sessionStorage,
        caches: {
          keys: vi.fn().mockRejectedValue(new Error("cache blocked")),
          delete: deleteCache,
        },
      }),
    ).rejects.toThrow("cache blocked");
  });
});
