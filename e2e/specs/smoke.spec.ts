import { expect, type Locator, test } from "@playwright/test";
import { localInput, localText } from "../fixtures/app";

test("home page boots without browser errors", async ({ isMobile, page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    );
  });

  await page.goto("/");

  await expect(page.getByTestId("local-composition")).toBeVisible();
  if (isMobile) {
    await expect(localInput(page)).not.toBeFocused();
  } else {
    await expect(localInput(page)).toBeFocused();
  }
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("unknown pages route to the home page", async ({ page }) => {
  await page.goto("/this/page/does-not-exist");

  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByTestId("local-composition")).toBeVisible();
});

test("mobile shows Start typing while the virtual keyboard is closed", async ({
  isMobile,
  page,
}) => {
  await page.goto("/");

  const startTyping = page.getByRole("button", { name: "Start typing" });

  if (!isMobile) {
    await expect(startTyping).toHaveCount(0);
    return;
  }

  await expect(startTyping).toBeVisible();
  await expect(localInput(page)).not.toBeFocused();

  await startTyping.click();
  await expect(localInput(page)).toBeFocused();
});

test("mobile centers the local input with a half-width slot", async ({
  isMobile,
  page,
}) => {
  test.skip(!isMobile, "mobile-only slot geometry");

  await page.goto("/");

  const metrics = await page.evaluate(() => {
    const slot = document.querySelector<HTMLElement>(
      '[data-testid="local-composition-slot"]'
    );
    const composition = document.querySelector<HTMLElement>(
      '[data-testid="local-composition"]'
    );

    if (!slot || !composition) {
      throw new Error("Local composition elements were not found");
    }

    const slotRect = slot.getBoundingClientRect();
    const compositionRect = composition.getBoundingClientRect();

    return {
      compositionLeft: compositionRect.left,
      slotWidth: slotRect.width,
      viewportCenter: window.innerWidth / 2,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.slotWidth).toBeCloseTo(metrics.viewportWidth / 2, 0);
  expect(metrics.compositionLeft).toBeCloseTo(metrics.viewportCenter, 0);
});

test("mobile prevents consecutive spaces and double-space punctuation", async ({
  isMobile,
  page,
}) => {
  test.skip(!isMobile, "mobile-only keyboard behavior");

  await page.goto("/");
  await page.getByRole("button", { name: "Start typing" }).click();

  const input = localInput(page);
  const chars = localText(page).locator('span[data-kind="char"]');

  await dispatchBeforeInput(input, " ");
  await expect(chars).toHaveCount(1);

  await dispatchBeforeInput(input, " ");
  await expect(chars).toHaveCount(1);

  await dispatchBeforeInput(input, ".");
  await expect(chars).toHaveCount(1);

  await dispatchBeforeInput(input, "a");
  await expect(chars).toHaveCount(2);
  await expect
    .poll(async () => localText(page).textContent())
    .toBe(" a");
});

test("api health endpoint is reachable from the E2E environment", async ({
  request,
}) => {
  const apiPort = process.env.E2E_API_PORT ?? "18080";
  const response = await request.get(`http://127.0.0.1:${apiPort}/health`);

  await expect(response).toBeOK();
  expect(response.headers()["content-type"]).toMatch(/application\/json/);
  expect(await response.json()).toEqual({ status: "ok" });
});

async function dispatchBeforeInput(locator: Locator, data: string) {
  await locator.evaluate((element, value) => {
    element.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, data);
}
