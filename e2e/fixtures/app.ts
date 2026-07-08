import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export type TestUser = {
  context: BrowserContext;
  page: Page;
};

export async function openUser(browser: Browser): Promise<TestUser> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.getByTestId("local-composition")).toBeVisible();

  return { context, page };
}

export async function closeUser(user: TestUser) {
  await user.context.close();
}

export async function openTwoUsers(browser: Browser) {
  const first = await openUser(browser);
  const second = await openUser(browser);

  await expect(remoteCompositions(first.page)).toHaveCount(1);
  await expect(remoteCompositions(second.page)).toHaveCount(1);

  return { first, second };
}

export function localInput(page: Page) {
  return page
    .getByTestId("local-composition")
    .getByRole("textbox", { name: "Invisible input" });
}

export function remoteCompositions(page: Page) {
  return page.getByTestId("remote-composition");
}

export function localText(page: Page) {
  return page.getByTestId("local-composition-text");
}

export function remoteText(page: Page) {
  return page.getByTestId("remote-composition-text").first();
}

export async function expectCompositionText(page: Page, expected: string) {
  await expect
    .poll(async () => normalizedText(await remoteText(page).textContent()), {
      message: `remote composition should show ${JSON.stringify(expected)}`,
    })
    .toBe(expected);
}

export function normalizedText(value: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
