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
