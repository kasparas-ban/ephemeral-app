import { expect, test } from "@playwright/test";
import { closeUser, openTwoUsers, openUser, remoteCompositions } from "../fixtures/app";

test("connected users appear and disappear from presence", async ({ browser }) => {
  const first = await openUser(browser);
  await expect(remoteCompositions(first.page)).toHaveCount(0);

  const second = await openUser(browser);
  await expect(remoteCompositions(first.page)).toHaveCount(1);
  await expect(remoteCompositions(second.page)).toHaveCount(1);

  await closeUser(second);
  await expect(remoteCompositions(first.page)).toHaveCount(0);

  await closeUser(first);
});

test("three users each see all other connected users", async ({ browser }) => {
  const { first, second } = await openTwoUsers(browser);
  const third = await openUser(browser);

  await expect(remoteCompositions(first.page)).toHaveCount(2);
  await expect(remoteCompositions(second.page)).toHaveCount(2);
  await expect(remoteCompositions(third.page)).toHaveCount(2);

  await closeUser(third);
  await closeUser(second);
  await closeUser(first);
});
