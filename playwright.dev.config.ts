import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.E2E_DEV_WEB_PORT ?? 13010);
const apiPort = Number(process.env.E2E_DEV_API_PORT ?? 18090);
const host = process.env.E2E_HOST ?? "127.0.0.1";

const webUrl = `http://${host}:${webPort}`;
const apiUrl = `http://${host}:${apiPort}`;
const webServerOutput =
  process.env.E2E_WEB_SERVER_LOGS === "1" ? "pipe" : "ignore";

export default defineConfig({
  testDir: "./e2e/specs",
  testMatch: "**/*.dev.spec.ts",
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "go run .",
      cwd: "apps/api",
      env: {
        PORT: String(apiPort),
        ALLOWED_ORIGINS: webUrl,
      },
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      stdout: webServerOutput,
      stderr: webServerOutput,
      timeout: 30_000,
    },
    {
      command: `pnpm exec next dev --hostname ${host} --port ${webPort}`,
      cwd: "apps/web",
      env: {
        NEXT_PUBLIC_API_URL: apiUrl,
      },
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      stdout: webServerOutput,
      stderr: webServerOutput,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
