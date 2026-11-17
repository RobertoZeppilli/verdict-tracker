import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolve = {
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "cli/**/*.test.ts", "eslint/**/*.test.ts", "catalog/**/*.test.ts"],
          // Linting the fixtures loads the whole ESLint config on first use.
          testTimeout: 30_000,
          // As the integration project below, and for the same reason: a server module imports
          // `server-only`, which throws outside React Server Components.
          alias: { "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 30_000,
          // Server modules run here outside React Server Components.
          alias: { "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
        },
      },
    ],
  },
});
