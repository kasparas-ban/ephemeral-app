import { describe, expect, it } from "vitest";

import { type Point, type Rect, type Size, SpatialIndex } from "./spatial";

const bounds: Rect = { x: 0, y: 0, width: 1200, height: 800 };
const itemSize: Size = { width: 120, height: 60 };

function overlaps(a: Point, b: Point, size: Size) {
  return (
    a.x < b.x + size.width &&
    b.x < a.x + size.width &&
    a.y < b.y + size.height &&
    b.y < a.y + size.height
  );
}

describe("SpatialIndex.getOrAssignPosition", () => {
  it("is deterministic for the same seed and user", () => {
    const a = new SpatialIndex({ seed: 42 }).getOrAssignPosition("u1");
    const b = new SpatialIndex({ seed: 42 }).getOrAssignPosition("u1");
    expect(a).toEqual(b);
  });

  it("is stable across calls on one index", () => {
    const index = new SpatialIndex({ seed: 1 });
    expect(index.getOrAssignPosition("u1")).toBe(
      index.getOrAssignPosition("u1"),
    );
  });

  it("keeps points inside the padded area", () => {
    const index = new SpatialIndex({
      seed: 7,
      width: 500,
      height: 300,
      padding: 50,
    });
    for (let i = 0; i < 50; i++) {
      const { x, y } = index.getOrAssignPosition(`user-${i}`);
      expect(x).toBeGreaterThanOrEqual(50);
      expect(x).toBeLessThanOrEqual(450);
      expect(y).toBeGreaterThanOrEqual(50);
      expect(y).toBeLessThanOrEqual(250);
    }
  });
});

describe("SpatialIndex.layoutUsers", () => {
  const userIds = ["a", "b", "c", "d", "e"];

  it("places every user within bounds without overlaps", () => {
    const placements = new SpatialIndex({ seed: 3 }).layoutUsers({
      userIds,
      bounds,
      itemSize,
    });

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

  it("keeps existing placements when new users join", () => {
    const index = new SpatialIndex({ seed: 5 });
    const first = index.layoutUsers({ userIds: ["a", "b"], bounds, itemSize });
    const second = index.layoutUsers({
      userIds: ["a", "b", "c"],
      bounds,
      itemSize,
    });

    expect(second.get("a")).toEqual(first.get("a"));
    expect(second.get("b")).toEqual(first.get("b"));
  });

  it("avoids reserved rects", () => {
    const reserved: Rect = { x: 400, y: 300, width: 400, height: 200 };
    const placements = new SpatialIndex({ seed: 9 }).layoutUsers({
      userIds,
      bounds,
      itemSize,
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
    const index = new SpatialIndex({ seed: 11 });
    index.layoutUsers({ userIds: ["a", "b"], bounds, itemSize });
    const placements = index.layoutUsers({ userIds: ["b"], bounds, itemSize });
    expect([...placements.keys()]).toEqual(["b"]);
  });
});
