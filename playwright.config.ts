import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.E2E_WEB_PORT ?? 13000);
const apiPort = Number(process.env.E2E_API_PORT ?? 18080);
const host = process.env.E2E_HOST ?? "127.0.0.1";

const webUrl = `http://${host}:${webPort}`;
const apiUrl = `http://${host}:${apiPort}`;

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 20_000,
  expect: {
    timeout: 10_000,
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
      command: `cd apps/api && PORT=${apiPort} ALLOWED_ORIGINS=${webUrl} go run .`,
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `NEXT_PUBLIC_API_URL=${apiUrl} pnpm --dir apps/web exec next build && NEXT_PUBLIC_API_URL=${apiUrl} pnpm --dir apps/web exec next start --hostname ${host} --port ${webPort}`,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
