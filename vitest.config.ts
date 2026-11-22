import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "server/**/*.test.ts",
      "eval/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    passWithNoTests: false,
  },
});
