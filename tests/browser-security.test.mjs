import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("service worker excludes private and cross-origin data from its cache", async () => {
  const worker = await read("../public/sw.js");
  const sandbox = {
    URL,
    caches: {},
    self: {
      addEventListener() {},
      clients: { claim() {} },
      location: { origin: "https://kommunity.example" },
      skipWaiting() {},
    },
  };
  vm.runInNewContext(
    `${worker}\nglobalThis.workerApi = { isPublicAssetRequest };`,
    sandbox,
  );
  const request = (path, destination = "image") => ({
    destination,
    headers: { has: () => false },
    method: "GET",
    url: `https://kommunity.example${path}`,
  });

  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /request\.headers\.has\("authorization"\)/);
  assert.match(worker, /"\/api\/"/);
  assert.match(worker, /cacheControl\.includes\("private"\)/);
  assert.match(worker, /cacheControl\.includes\("no-store"\)/);
  assert.match(worker, /credentials: "omit"/);
  assert.match(worker, /if \(isPublicResponse\(response\)\)/);
  assert.match(worker, /isOwnedCache\(key\)/);
  assert.doesNotMatch(worker, /key !== CACHE_NAME\)\.map/);
  assert.equal(
    sandbox.workerApi.isPublicAssetRequest(request("/avatars/me")),
    false,
  );
  assert.equal(
    sandbox.workerApi.isPublicAssetRequest(
      request("/assets/avatar-abc123.png"),
    ),
    true,
  );
  assert.equal(
    sandbox.workerApi.isPublicAssetRequest(
      request("/assets/avatar-abc123.png?user=maya"),
    ),
    false,
  );
});

test("document and preview server declare core browser protections", async () => {
  const [html, viteConfig, staticHeaders] = await Promise.all([
    read("../index.html"),
    read("../vite.config.ts"),
    read("../public/_headers"),
  ]);

  const htmlPolicy = html.match(/content="(default-src 'self';[^"]+)"/)?.[1];
  const vitePolicy = viteConfig.match(
    /"(default-src 'self';[^"]+)"/,
  )?.[1];
  const staticPolicy = staticHeaders.match(
    /Content-Security-Policy: ([^\n]+)/,
  )?.[1];
  const commonDirectives = (policy) =>
    policy
      .split(";")
      .map((directive) => directive.trim())
      .filter(Boolean)
      .filter((directive) => !directive.startsWith("frame-ancestors"));

  assert.ok(htmlPolicy);
  assert.ok(vitePolicy);
  assert.ok(staticPolicy);
  assert.deepEqual(commonDirectives(vitePolicy), commonDirectives(htmlPolicy));
  assert.deepEqual(commonDirectives(staticPolicy), commonDirectives(htmlPolicy));
  assert.doesNotMatch(htmlPolicy, /\b(?:ws|wss):/);
  assert.match(viteConfig, /responseCsp.*frame-ancestors 'none'/);
  assert.match(viteConfig, /apply: "serve"/);
  assert.match(viteConfig, /script-src 'self' 'unsafe-inline'/);
  assert.match(
    viteConfig,
    /"\/api":\s*\{[\s\S]*?ws:\s*true/,
    "the local API proxy must forward authenticated WebSocket upgrades",
  );
  assert.match(staticPolicy, /frame-ancestors 'none'/);
  assert.match(viteConfig, /X-Content-Type-Options/);
});

test("stale generated Vite configs cannot override the TypeScript source", async () => {
  await assert.rejects(access(new URL("../vite.config.js", import.meta.url)));
  await assert.rejects(access(new URL("../vite.config.d.ts", import.meta.url)));
});
