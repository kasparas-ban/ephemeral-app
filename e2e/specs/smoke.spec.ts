import { expect, test } from "@playwright/test";
import { localInput } from "../fixtures/app";

test("home page boots without browser errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
  });

  await page.goto("/");

  await expect(page.getByTestId("local-composition")).toBeVisible();
  await expect(localInput(page)).toBeFocused();
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("api health endpoint is reachable from the E2E environment", async ({ request }) => {
  const apiPort = process.env.E2E_API_PORT ?? "18080";
  const response = await request.get(`http://127.0.0.1:${apiPort}/health`);

  await expect(response).toBeOK();
  expect(response.headers()["content-type"]).toMatch(/application\/json/);
  expect(await response.json()).toEqual({ status: "ok" });
});
