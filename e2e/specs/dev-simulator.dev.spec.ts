import { expect, test } from "@playwright/test";
import { remoteCompositions } from "../fixtures/app";

test("dev simulator spawns real websocket bots", async ({ page }) => {
  await page.goto("/dev");

  await expect(page.getByTestId("dev-simulator-panel")).toBeVisible();
  await page.getByTestId("dev-simulator-start").click();

  await expect(remoteCompositions(page)).toHaveCount(3);
  await expect
    .poll(
      async () =>
        (
          await page.getByTestId("remote-composition-text").allTextContents()
        ).some((value) => value.trim().length > 0),
      { message: "at least one bot should type into a remote composition" },
    )
    .toBe(true);

  await page.getByTestId("dev-simulator-stop").click();
  await expect(remoteCompositions(page)).toHaveCount(0);
});
