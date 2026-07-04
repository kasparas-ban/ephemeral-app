import { expect, test } from "@playwright/test";
import {
  closeUser,
  expectCompositionText,
  localInput,
  localText,
  openTwoUsers,
  remoteText,
} from "../fixtures/app";

test("typing in one browser renders in another browser", async ({ browser }) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("hello");

  await expectCompositionText(second.page, "hello");
  await expect(remoteText(first.page)).toHaveText("");

  await closeUser(second);
  await closeUser(first);
});

test("backspace and enter relay as delete and clear actions", async ({ browser }) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("hey");
  await expectCompositionText(second.page, "hey");

  await localInput(first.page).press("Backspace");
  await expectCompositionText(second.page, "he");

  await localInput(first.page).press("Enter");
  await expect(remoteText(second.page)).toHaveText("");

  await closeUser(second);
  await closeUser(first);
});

test("remote typing does not mutate the local user's own composition", async ({ browser }) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("abc");
  await expect(localText(second.page)).toHaveText("");
  await expectCompositionText(second.page, "abc");

  await closeUser(second);
  await closeUser(first);
});

test("remote spaces do not shift the local user's visible characters", async ({ browser }) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(second.page).pressSequentially("x");
  const beforeTransform = await second.page
    .getByTestId("local-composition-text")
    .locator('span[data-kind="char"]')
    .first()
    .evaluate((el) => (el as HTMLElement).dataset.tx);

  await localInput(first.page).pressSequentially("a b");
  await expectCompositionText(second.page, "a b");

  await expect
    .poll(async () =>
      second.page
        .getByTestId("local-composition-text")
        .locator('span[data-kind="char"]')
        .first()
        .evaluate((el) => (el as HTMLElement).dataset.tx)
    )
    .toBe(beforeTransform);

  await closeUser(second);
  await closeUser(first);
});
