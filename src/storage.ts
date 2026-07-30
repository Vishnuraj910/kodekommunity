import { isRecord } from "./validation.ts";

export type StorageAdapter = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export type ClearableStorageAdapter = StorageAdapter &
  Pick<Storage, "key" | "length">;

export type CacheStorageAdapter = Pick<CacheStorage, "delete" | "keys">;

export type StateValidator<T> = (value: unknown) => value is T;

type StoredState<T> = {
  version: 1;
  expiresAt: number | null;
  value: T;
};

const STORAGE_VERSION = 1;
const MAX_STORED_BYTES = 1_000_000;
const APP_STORAGE_PREFIX = "kommunity-";
const APP_CACHE_PREFIX = "kommunity-shell-";

const isStoredState = (
  value: unknown,
): value is StoredState<unknown> =>
  isRecord(value) &&
  value.version === STORAGE_VERSION &&
  (value.expiresAt === null ||
    (typeof value.expiresAt === "number" &&
      Number.isFinite(value.expiresAt))) &&
  "value" in value;

export const readStoredState = <T>(
  storage: StorageAdapter,
  key: string,
  initial: T,
  validate: StateValidator<T>,
  now = Date.now(),
): T => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return initial;
    if (raw.length > MAX_STORED_BYTES) {
      storage.removeItem(key);
      return initial;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      !isStoredState(parsed) ||
      (parsed.expiresAt !== null && parsed.expiresAt <= now) ||
      !validate(parsed.value)
    ) {
      storage.removeItem(key);
      return initial;
    }
    return parsed.value;
  } catch {
    storage.removeItem(key);
    return initial;
  }
};

export const writeStoredState = <T>(
  storage: StorageAdapter,
  key: string,
  value: T,
  ttlMs?: number,
  now = Date.now(),
): void => {
  const stored: StoredState<T> = {
    version: STORAGE_VERSION,
    expiresAt: ttlMs ? now + ttlMs : null,
    value,
  };

  try {
    storage.setItem(key, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable or full. State remains valid in memory.
  }
};

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

export const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 256;

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 1_000 &&
  value.every((item) => typeof item === "string" && item.length <= 256);

export const clearStoredNamespace = (
  storage: ClearableStorageAdapter,
  prefix = APP_STORAGE_PREFIX,
): number => {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
  return keys.length;
};

export type BrowserDataStores = {
  localStorage: ClearableStorageAdapter;
  sessionStorage: ClearableStorageAdapter;
  caches?: CacheStorageAdapter;
};

export const clearKommunityBrowserData = async (
  stores: BrowserDataStores = {
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    caches: "caches" in window ? window.caches : undefined,
  },
): Promise<void> => {
  clearStoredNamespace(stores.localStorage);
  clearStoredNamespace(stores.sessionStorage);

  const cacheStorage = stores.caches;
  if (cacheStorage) {
    const keys = await cacheStorage.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(APP_CACHE_PREFIX))
        .map((key) => cacheStorage.delete(key)),
    );
  }
};
