import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    environment: "jsdom",
    setupFiles: ["tests/helpers/setup.mjs"],
  },
});
