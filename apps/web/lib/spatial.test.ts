import { describe, expect, it } from "vitest";

import { layoutUsers, type Point, type Rect, type Size } from "./spatial";

const bounds: Rect = { x: 0, y: 0, width: 1200, height: 800 };
const itemSize: Size = { width: 120, height: 60 };
const userIds = ["a", "b", "c", "d", "e"];

function overlaps(a: Point, b: Point, size: Size) {
  return (
    a.x < b.x + size.width &&
    b.x < a.x + size.width &&
    a.y < b.y + size.height &&
    b.y < a.y + size.height
  );
}

describe("layoutUsers", () => {
  it("places every user within bounds without overlaps", () => {
    const placements = layoutUsers({ userIds, bounds, itemSize, seed: 3 });

    expect([...placements.keys()].sort()).toEqual(userIds);
    const points = [...placements.values()];
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(bounds.x);
      expect(p.y).toBeGreaterThanOrEqual(bounds.y);
      expect(p.x + itemSize.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(p.y + itemSize.height).toBeLessThanOrEqual(
        bounds.y + bounds.height,
      );
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        expect(overlaps(points[i], points[j], itemSize)).toBe(false);
      }
    }
  });

  it("is the same for the same seed", () => {
    const first = layoutUsers({ userIds, bounds, itemSize, seed: 42 });
    const second = layoutUsers({ userIds, bounds, itemSize, seed: 42 });

    expect(second).toEqual(first);
  });

  it("keeps existing placements when new users join", () => {
    const first = layoutUsers({
      userIds: ["a", "b"],
      bounds,
      itemSize,
      seed: 5,
    });
    const second = layoutUsers({
      userIds: ["a", "b", "c"],
      bounds,
      itemSize,
      seed: 5,
      previous: first,
    });

    expect(second.get("a")).toEqual(first.get("a"));
    expect(second.get("b")).toEqual(first.get("b"));
    expect(second.has("c")).toBe(true);
  });

  it("never gives a newcomer an existing user's spot", () => {
    for (let seed = 0; seed < 50; seed++) {
      const first = layoutUsers({ userIds: ["m"], bounds, itemSize, seed });
      const second = layoutUsers({
        userIds: ["a", "m"],
        bounds,
        itemSize,
        seed,
        previous: first,
      });

      expect(second.get("m")).toEqual(first.get("m"));
    }
  });

  it("returns the previous layout itself when nothing moved", () => {
    const first = layoutUsers({ userIds, bounds, itemSize, seed: 7 });
    const again = layoutUsers({
      userIds,
      bounds,
      itemSize,
      seed: 7,
      previous: first,
    });

    expect(again).toBe(first);
  });

  it("moves a user whose spot no longer fits", () => {
    const wide = layoutUsers({ userIds: ["a"], bounds, itemSize, seed: 9 });
    const narrow: Rect = { ...bounds, width: 300 };
    const moved = layoutUsers({
      userIds: ["a"],
      bounds: narrow,
      itemSize,
      seed: 9,
      previous: wide,
    });

    const point = moved.get("a")!;
    expect(point.x + itemSize.width).toBeLessThanOrEqual(narrow.width);
  });

  it("avoids reserved rects", () => {
    const reserved: Rect = { x: 400, y: 300, width: 400, height: 200 };
    const placements = layoutUsers({
      userIds,
      bounds,
      itemSize,
      seed: 9,
      reservedRects: [reserved],
    });

    for (const p of placements.values()) {
      const hitsReserved =
        p.x < reserved.x + reserved.width &&
        reserved.x < p.x + itemSize.width &&
        p.y < reserved.y + reserved.height &&
        reserved.y < p.y + itemSize.height;
      expect(hitsReserved).toBe(false);
    }
  });

  it("forgets users who leave", () => {
    const first = layoutUsers({
      userIds: ["a", "b"],
      bounds,
      itemSize,
      seed: 11,
    });
    const placements = layoutUsers({
      userIds: ["b"],
      bounds,
      itemSize,
      seed: 11,
      previous: first,
    });

    expect([...placements.keys()]).toEqual(["b"]);
  });
});
