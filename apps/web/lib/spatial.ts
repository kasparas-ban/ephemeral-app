const SESSION_SEED_KEY = "ephemeral-session-seed";

function getSessionSeed(): string {
  if (typeof window === "undefined") return "server";
  let seed = sessionStorage.getItem(SESSION_SEED_KEY);
  if (!seed) {
    seed = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    sessionStorage.setItem(SESSION_SEED_KEY, seed);
  }
  return seed;
}

function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getOrAssignPosition(userId: string, radius = 5000) {
  const seed = getSessionSeed();
  const h = hash32(seed + ":" + userId);
  const rng = mulberry32(h);
  const angle = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * radius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Camera = { x: number; y: number; zoom: number };

export function worldToScreen(x: number, y: number, cam: Camera, dpr = 1) {
  return { sx: (x - cam.x) * cam.zoom * dpr, sy: (y - cam.y) * cam.zoom * dpr };
}

export function screenToWorld(sx: number, sy: number, cam: Camera, dpr = 1) {
  return { x: sx / (cam.zoom * dpr) + cam.x, y: sy / (cam.zoom * dpr) + cam.y };
}
