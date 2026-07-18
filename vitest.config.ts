/**
 * What this file does: Configures Vitest to run the validation-focused unit tests in `src/test`.
 * What calls it: The `npm test` and `npm run test:run` scripts in `package.json`.
 * What it calls: Vitest's node runtime plus the test setup file under `src/test`.
 * Junior gotcha: Forgetting the alias or setup path makes tests pass locally by accident and fail in CI.
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
});
