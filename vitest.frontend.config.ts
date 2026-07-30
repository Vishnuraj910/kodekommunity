import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    fileParallelism: false,
    include: ["src/**/*.test.{ts,tsx}"],
    pool: "forks",
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/frontend",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "server/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/test/**",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
