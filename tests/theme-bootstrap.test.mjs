import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("the pre-paint theme bootstrap applies saved and device preferences", async () => {
  const source = await readFile(
    new URL("../public/theme-init.js", import.meta.url),
    "utf8",
  );
  const themeColor = {
    content: "",
    setAttribute(name, value) {
      if (name === "content") this.content = value;
    },
  };
  const document = {
    documentElement: { dataset: {} },
    querySelector: () => themeColor,
  };

  vm.runInNewContext(source, {
    document,
    localStorage: { getItem: () => null },
    window: { matchMedia: () => ({ matches: true }) },
  });

  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(themeColor.content, "#090909");

  vm.runInNewContext(source, {
    document,
    localStorage: { getItem: () => "light" },
    window: { matchMedia: () => ({ matches: true }) },
  });
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(themeColor.content, "#ffffff");
});
