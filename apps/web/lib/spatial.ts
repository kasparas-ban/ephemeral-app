export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;

export type Placements = Map<string, Point>;

export type LayoutUsersOptions = {
  userIds: string[];
  bounds: Rect;
  itemSize: Size;
  reservedRects?: Rect[];
  gap?: number;
  /** The last layout; users keep their spot while it still fits. */
  previous?: Placements;
  /** Same seed + id ⇒ same preferred spots. Defaults to one seed per session. */
  seed?: number;
};

const DEFAULT_GAP = 32;
const MAX_RANDOM_CANDIDATES = 160;
const GRID_STEP = 48;
const SESSION_SEED = crypto.getRandomValues(new Uint32Array(1))[0];

/**
 * Places each user in an open spot inside `bounds`. Returns `previous` itself
 * when nothing moved, so callers can tell a new layout apart by reference.
 */
export function layoutUsers({
  userIds,
  bounds,
  itemSize,
  reservedRects = [],
  gap = DEFAULT_GAP,
  previous = new Map(),
  seed = SESSION_SEED,
}: LayoutUsersOptions): Placements {
  const placements: Placements = new Map();
  const occupiedRects = [...reservedRects];

  // Users who already have a spot claim it before newcomers look for one.
  const sortedIds = [...new Set(userIds)].sort();
  const placementOrder = [
    ...sortedIds.filter((userId) => previous.has(userId)),
    ...sortedIds.filter((userId) => !previous.has(userId)),
  ];

  for (const userId of placementOrder) {
    let point = previous.get(userId);
    if (
      !point ||
      !isOpen(rectFromPoint(point, itemSize), bounds, occupiedRects, gap)
    ) {
      point = findOpenPoint(
        `${seed}:${userId}`,
        bounds,
        itemSize,
        occupiedRects,
        gap,
      );
    }

    placements.set(userId, point);
    occupiedRects.push(rectFromPoint(point, itemSize));
  }

  return samePlacements(placements, previous) ? previous : placements;
}

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
  return (h ^ (h >>> 16)) >>> 0;
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

function findOpenPoint(
  seedInput: string,
  bounds: Rect,
  itemSize: Size,
  occupiedRects: Rect[],
  gap: number,
): Point {
  const candidates = [
    ...randomCandidates(`${seedInput}:layout`, bounds, itemSize),
    ...gridCandidates(`${seedInput}:grid`, bounds, itemSize),
  ];

  return (
    mostCentralOpenCandidate(
      candidates,
      occupiedRects,
      itemSize,
      bounds,
      gap,
    ) ??
    leastOverlappingCandidate(candidates, occupiedRects, itemSize, bounds, gap)
  );
}

function isOpen(rect: Rect, bounds: Rect, occupiedRects: Rect[], gap: number) {
  return fits(rect, bounds) && !overlapsAny(rect, occupiedRects, gap);
}

function samePlacements(a: Placements, b: Placements) {
  if (a.size !== b.size) return false;
  for (const [userId, point] of a) {
    const other = b.get(userId);
    if (other?.x !== point.x || other?.y !== point.y) return false;
  }
  return true;
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
    intersects(inflate(rect, gap), occupied),
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
  itemSize: Size,
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
  itemSize: Size,
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

function mostCentralOpenCandidate(
  candidates: Point[],
  occupiedRects: Rect[],
  itemSize: Size,
  bounds: Rect,
  gap: number,
): Point | null {
  let best: Point | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateRect = rectFromPoint(candidate, itemSize);
    if (
      !fits(candidateRect, bounds) ||
      overlapsAny(candidateRect, occupiedRects, gap)
    ) {
      continue;
    }

    const score = centerDistanceScore(candidateRect, bounds);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function leastOverlappingCandidate(
  candidates: Point[],
  occupiedRects: Rect[],
  itemSize: Size,
  bounds: Rect,
  gap: number,
): Point {
  let best = candidates[0] ?? { x: bounds.x, y: bounds.y };
  let bestOverlapScore = Number.POSITIVE_INFINITY;
  let bestCenterScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateRect = rectFromPoint(candidate, itemSize);
    if (!fits(candidateRect, bounds)) continue;

    const overlapScore = occupiedRects.reduce(
      (total, occupied) =>
        total + intersectionArea(inflate(candidateRect, gap), occupied),
      0,
    );
    const centerScore = centerDistanceScore(candidateRect, bounds);

    if (
      overlapScore < bestOverlapScore ||
      (overlapScore === bestOverlapScore && centerScore < bestCenterScore)
    ) {
      best = candidate;
      bestOverlapScore = overlapScore;
      bestCenterScore = centerScore;
    }
  }

  return best;
}

function centerDistanceScore(rect: Rect, bounds: Rect): number {
  const rectCenterX = rect.x + rect.width / 2;
  const rectCenterY = rect.y + rect.height / 2;
  const boundsCenterX = bounds.x + bounds.width / 2;
  const boundsCenterY = bounds.y + bounds.height / 2;

  return (
    Math.pow(rectCenterX - boundsCenterX, 2) +
    Math.pow(rectCenterY - boundsCenterY, 2)
  );
}

function intersectionArea(a: Rect, b: Rect): number {
  const width = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const height = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return width * height;
}
