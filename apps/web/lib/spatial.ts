export type Point = { x: number; y: number };

export type SpatialOptions = {
  /** Stable seed for the session. Same seed + id ⇒ same point. */
  seed?: number;
  /** Placement area in canvas px; points fall within the padded interior. */
  width?: number;
  height?: number;
  /** Inset kept clear of the edges so notes don't hug the border. */
  padding?: number;
};

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 720;
const DEFAULT_PADDING = 80;

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

  release(userId: string): void {
    this.positions.delete(userId);
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
