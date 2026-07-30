import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("service worker excludes private and cross-origin data from its cache", async () => {
  const worker = await read("../public/sw.js");

  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /request\.headers\.has\("authorization"\)/);
  assert.match(worker, /"\/api\/"/);
  assert.match(worker, /cacheControl\.includes\("private"\)/);
  assert.match(worker, /cacheControl\.includes\("no-store"\)/);
  assert.match(worker, /isOwnedCache\(key\)/);
  assert.doesNotMatch(worker, /key !== CACHE_NAME\)\.map/);
});

test("document and preview server declare core browser protections", async () => {
  const [html, viteConfig, staticHeaders] = await Promise.all([
    read("../index.html"),
    read("../vite.config.ts"),
    read("../public/_headers"),
  ]);

  for (const source of [html, viteConfig, staticHeaders]) {
    assert.match(source, /default-src 'self'/);
    assert.match(source, /object-src 'none'/);
    assert.match(source, /base-uri 'none'/);
  }
  assert.match(viteConfig, /X-Content-Type-Options/);
  assert.match(staticHeaders, /frame-ancestors 'none'/);
});

test("stale generated Vite configs cannot override the TypeScript source", async () => {
  await assert.rejects(access(new URL("../vite.config.js", import.meta.url)));
  await assert.rejects(access(new URL("../vite.config.d.ts", import.meta.url)));
});
