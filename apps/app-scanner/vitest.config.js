import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.js", "tests/integration/**/*.spec.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/jobs/**/*.js"],
      exclude: ["src/__tests__/**", "node_modules/**"],
    },
  },
});

