import { expect, test } from "@playwright/test";

test("dev simulator is not available in production", async ({ page }) => {
  const response = await page.goto("/dev");

  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("dev-simulator-panel")).toHaveCount(0);
});
