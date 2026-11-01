import { expect, type Page, test } from "@playwright/test";
import {
  closeUser,
  expectCompositionText,
  localInput,
  localText,
  openTwoUsers,
  remoteText,
} from "../fixtures/app";

test("typing in one browser renders in another browser", async ({
  browser,
}) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("hello");

  await expectCompositionText(second.page, "hello");
  await expect(remoteText(first.page)).toHaveText("");

  await closeUser(second);
  await closeUser(first);
});

test("typing input accepts only printable keyboard characters", async ({
  browser,
}) => {
  const { first, second } = await openTwoUsers(browser);
  const mixedText = "A\u{1F642}z\u00e90\u20149\u201c ~!@\u4e2d";

  await localInput(first.page).evaluate((element) => {
    element.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertFromPaste",
        data: "paste",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(remoteText(second.page)).toHaveText("");

  await localInput(first.page).evaluate((element, text) => {
    for (const char of Array.from(text)) {
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: char,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }, mixedText);

  await expectCompositionText(second.page, "Az09 ~!@");

  await closeUser(second);
  await closeUser(first);
});

test("backspace and enter relay as delete and clear actions", async ({
  browser,
}) => {
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

test("typing right after enter starts the next composition", async ({
  browser,
}) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("abc");
  await expectCompositionText(second.page, "abc");

  // Faster than the old text takes to blur away.
  await localInput(first.page).press("Enter");
  await localInput(first.page).pressSequentially("xyz", { delay: 20 });

  await expect(localText(first.page)).toHaveText("xyz");
  await expectCompositionText(second.page, "xyz");

  await localInput(first.page).press("Backspace");
  await expect(localText(first.page)).toHaveText("xy");
  await expectCompositionText(second.page, "xy");

  await closeUser(second);
  await closeUser(first);
});

test("typing while the info screen is open is not relayed", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "desktop keyboard focus");
  const { first, second } = await openTwoUsers(browser);

  await first.page
    .getByRole("button", { name: "Show app information" })
    .click();
  const dialog = first.page.getByRole("dialog", { name: "Ephemeral" });
  await expect(dialog).toBeVisible();
  await first.page.keyboard.type("secret");

  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog).toHaveCount(0);
  await first.page.keyboard.type("ok!");

  await expect(localText(first.page)).toHaveText("ok!");
  await expectCompositionText(second.page, "ok!");

  await closeUser(second);
  await closeUser(first);
});

test("beforeinput delete relays as a back action", async ({ browser }) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("hey");
  await expectCompositionText(second.page, "hey");

  await localInput(first.page).evaluate((element) => {
    element.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "deleteContentBackward",
        data: null,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expectCompositionText(second.page, "he");

  await closeUser(second);
  await closeUser(first);
});

test("remote typing does not mutate the local user's own composition", async ({
  browser,
}) => {
  const { first, second } = await openTwoUsers(browser);

  await localInput(first.page).pressSequentially("abc");
  await expect(localText(second.page)).toHaveText("");
  await expectCompositionText(second.page, "abc");

  await closeUser(second);
  await closeUser(first);
});

test("remote spaces do not shift the local user's visible characters", async ({
  browser,
}) => {
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
        .evaluate((el) => (el as HTMLElement).dataset.tx),
    )
    .toBe(beforeTransform);

  await closeUser(second);
  await closeUser(first);
});

test.describe("IME composition", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "IME input is driven through the Chrome DevTools Protocol",
  );

  // Each test ends with a typed "!" so the assertions wait for every earlier
  // message instead of passing on a transient state.
  test("a committed composition is typed once", async ({ browser }) => {
    const { first, second } = await openTwoUsers(browser);

    await compose(first.page, ["a"], "a");
    await localInput(first.page).press("!");

    await expect(localText(first.page)).toHaveText("a!");
    await expectCompositionText(second.page, "a!");

    await closeUser(second);
    await closeUser(first);
  });

  test("composition updates relay letter by letter, including deletions", async ({
    browser,
  }) => {
    const { first, second } = await openTwoUsers(browser);

    await compose(first.page, ["h", "he", "hel", "he", "hey"], "hey");
    await localInput(first.page).press("!");

    await expect(localText(first.page)).toHaveText("hey!");
    await expectCompositionText(second.page, "hey!");

    await closeUser(second);
    await closeUser(first);
  });

  test("text converted to non-ASCII is removed and typing continues", async ({
    browser,
  }) => {
    const { first, second } = await openTwoUsers(browser);

    await compose(first.page, ["k", "ka", "か"], "か");
    await localInput(first.page).pressSequentially("ok!");

    await expect(localText(first.page)).toHaveText("ok!");
    await expectCompositionText(second.page, "ok!");

    await closeUser(second);
    await closeUser(first);
  });
});

async function compose(page: Page, updates: string[], commit: string) {
  await localInput(page).focus();
  const cdp = await page.context().newCDPSession(page);

  for (const text of updates) {
    await cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  }
  await cdp.send("Input.insertText", { text: commit });
}
