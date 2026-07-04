export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;

export type SpatialOptions = {
  /** Stable seed for the session. Same seed + id ⇒ same point. */
  seed?: number;
  /** Placement area in canvas px; points fall within the padded interior. */
  width?: number;
  height?: number;
  /** Inset kept clear of the edges so notes don't hug the border. */
  padding?: number;
};

export type LayoutUsersOptions = {
  userIds: string[];
  bounds: Rect;
  itemSize: Size;
  reservedRects?: Rect[];
  gap?: number;
};

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 720;
const DEFAULT_PADDING = 80;
const DEFAULT_GAP = 32;
const MAX_RANDOM_CANDIDATES = 160;
const GRID_STEP = 48;

export class SpatialIndex {
  private readonly seed: number;
  private readonly width: number;
  private readonly height: number;
  private readonly padding: number;
  private readonly positions = new Map<string, Point>();

  constructor(options: SpatialOptions = {}) {
    this.seed = options.seed ?? randomSeed();
    this.width = options.width ?? DEFAULT_WIDTH;
    this.height = options.height ?? DEFAULT_HEIGHT;
    this.padding = options.padding ?? DEFAULT_PADDING;
  }

  getOrAssignPosition(userId: string): Point {
    const existing = this.positions.get(userId);
    if (existing) return existing;

    const rand = mulberry32(hashString(`${this.seed}:${userId}`));
    const usableW = Math.max(0, this.width - this.padding * 2);
    const usableH = Math.max(0, this.height - this.padding * 2);
    const point: Point = {
      x: this.padding + rand() * usableW,
      y: this.padding + rand() * usableH,
    };

    this.positions.set(userId, point);
    return point;
  }

  layoutUsers({
    userIds,
    bounds,
    itemSize,
    reservedRects = [],
    gap = DEFAULT_GAP,
  }: LayoutUsersOptions): Map<string, Point> {
    const activeUserIds = new Set(userIds);
    for (const userId of this.positions.keys()) {
      if (!activeUserIds.has(userId)) this.release(userId);
    }

    const placements = new Map<string, Point>();
    const occupiedRects = [...reservedRects];
    const uniqueUserIds = [...new Set(userIds)].sort();

    for (const userId of uniqueUserIds) {
      const existing = this.positions.get(userId);
      if (existing) {
        const existingRect = rectFromPoint(existing, itemSize);
        if (
          fits(existingRect, bounds) &&
          !overlapsAny(existingRect, occupiedRects, gap)
        ) {
          placements.set(userId, existing);
          occupiedRects.push(existingRect);
          continue;
        }
      }

      const point = this.findOpenPoint(
        userId,
        bounds,
        itemSize,
        occupiedRects,
        gap
      );
      this.positions.set(userId, point);
      placements.set(userId, point);
      occupiedRects.push(rectFromPoint(point, itemSize));
    }

    return placements;
  }

  release(userId: string): void {
    this.positions.delete(userId);
  }

  private findOpenPoint(
    userId: string,
    bounds: Rect,
    itemSize: Size,
    occupiedRects: Rect[],
    gap: number
  ): Point {
    const candidates = [
      ...randomCandidates(`${this.seed}:${userId}:layout`, bounds, itemSize),
      ...gridCandidates(`${this.seed}:${userId}:grid`, bounds, itemSize),
    ];

    for (const candidate of candidates) {
      const candidateRect = rectFromPoint(candidate, itemSize);
      if (
        fits(candidateRect, bounds) &&
        !overlapsAny(candidateRect, occupiedRects, gap)
      ) {
        return candidate;
      }
    }

    return leastOverlappingCandidate(
      candidates,
      occupiedRects,
      itemSize,
      bounds,
      gap
    );
  }
}

export function createSpatialIndex(options?: SpatialOptions): SpatialIndex {
  return new SpatialIndex(options);
}

export const spatial = createSpatialIndex();

// --- internals -------------------------------------------------------------

/** xmur3-style string hash → unsigned 32-bit int, used to seed the PRNG. */
function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32: tiny, fast, deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh per-session seed. Prefers `crypto`; falls back where it's absent. */
function randomSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function rectFromPoint(point: Point, size: Size): Rect {
  return { x: point.x, y: point.y, width: size.width, height: size.height };
}

function fits(rect: Rect, bounds: Rect): boolean {
  return (
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height
  );
}

function overlapsAny(rect: Rect, occupiedRects: Rect[], gap: number): boolean {
  return occupiedRects.some((occupied) =>
    intersects(inflate(rect, gap), occupied)
  );
}

function intersects(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function inflate(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function* randomCandidates(
  seedInput: string,
  bounds: Rect,
  itemSize: Size
): Generator<Point> {
  const rand = mulberry32(hashString(seedInput));
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - itemSize.width);
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - itemSize.height);
  const usableW = Math.max(0, maxX - bounds.x);
  const usableH = Math.max(0, maxY - bounds.y);

  for (let i = 0; i < MAX_RANDOM_CANDIDATES; i++) {
    yield {
      x: bounds.x + rand() * usableW,
      y: bounds.y + rand() * usableH,
    };
  }
}

function gridCandidates(
  seedInput: string,
  bounds: Rect,
  itemSize: Size
): Point[] {
  const points: Point[] = [];
  const maxX = bounds.x + bounds.width - itemSize.width;
  const maxY = bounds.y + bounds.height - itemSize.height;

  for (let y = bounds.y; y <= maxY; y += GRID_STEP) {
    for (let x = bounds.x; x <= maxX; x += GRID_STEP) {
      points.push({ x, y });
    }
  }

  const rand = mulberry32(hashString(seedInput));
  return points
    .map((point) => ({ point, sort: rand() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ point }) => point);
}

function leastOverlappingCandidate(
  candidates: Point[],
  occupiedRects: Rect[],
  itemSize: Size,
  bounds: Rect,
  gap: number
): Point {
  let best = candidates[0] ?? { x: bounds.x, y: bounds.y };
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateRect = rectFromPoint(candidate, itemSize);
    if (!fits(candidateRect, bounds)) continue;

    const score = occupiedRects.reduce(
      (total, occupied) =>
        total + intersectionArea(inflate(candidateRect, gap), occupied),
      0
    );

    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function intersectionArea(a: Rect, b: Rect): number {
  const width = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const height = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return width * height;
}
