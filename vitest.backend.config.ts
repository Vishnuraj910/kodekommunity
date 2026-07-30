import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const environment = loadEnv("test", "server", "");

export default defineConfig({
  test: {
    environment: "node",
    env: environment,
    include: ["server/tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/backend",
      reporter: ["text", "json-summary", "html"],
      include: ["server/src/**/*.ts"],
      exclude: [
        "server/src/server.ts",
        "server/src/types/**/*.d.ts",
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
