import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://subtrack:subtrack@localhost:5432/subtrack?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `PORT=${PORT} npm run dev`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      E2E_TEST_AUTH: "1",
      DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-please-change-32chars",
      AUTH_URL: BASE,
      NEXTAUTH_URL: BASE,
      AUTH_TRUST_HOST: "true",
      ADMIN_EMAILS: "admin@example.com",
      APP_TZ: "Europe/Kyiv",
    },
  },
});
