import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // The stub companion app binds the fixed Olorin port 9696, so specs must
  // not run in parallel
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: "list",
});
