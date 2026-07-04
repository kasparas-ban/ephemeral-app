import { expect, test, type Page } from "@playwright/test";
import {
  closeUser,
  openTwoUsers,
  openUser,
  remoteCompositions,
  type TestUser,
} from "../fixtures/app";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

test("connected user slots do not overlap the local slot", async ({ browser }) => {
  const users: TestUser[] = [];

  try {
    for (let i = 0; i < 4; i++) {
      users.push(await openUser(browser));
    }

    for (const user of users) {
      await expect(remoteCompositions(user.page)).toHaveCount(3);
      await expect(user.page.getByTestId("remote-composition-slot")).toHaveCount(
        3
      );
      await expectSlotsToNotOverlap(user.page);
    }
  } finally {
    for (const user of users.reverse()) {
      await closeUser(user);
    }
  }
});

async function expectSlotsToNotOverlap(page: Page) {
  await expect
    .poll(
      async () => {
        const rects = await readSlotRects(page);
        return rects.length === 4 && !hasIntersectingRects(rects);
      },
      { message: "local and remote composition slots should not overlap" }
    )
    .toBe(true);
}

async function readSlotRects(page: Page): Promise<Rect[]> {
  return page
    .locator(
      [
        '[data-testid="local-composition-slot"]',
        '[data-testid="remote-composition-slot"]',
      ].join(", ")
    )
    .evaluateAll((slots) =>
      slots.map((slot) => {
        const rect = slot.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      })
    );
}

function hasIntersectingRects(rects: Rect[]) {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsIntersect(rects[i], rects[j])) return true;
    }
  }

  return false;
}

function rectsIntersect(a: Rect, b: Rect) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}
