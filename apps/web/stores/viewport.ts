import { atom } from "jotai";

import type { Rect } from "@/lib/spatial";

export type VisibleViewport = {
  rect: Rect;
  hasOnScreenKeyboard: boolean;
  isKeyboardOpen: boolean;
};

const DEFAULT_VISIBLE_VIEWPORT: VisibleViewport = {
  rect: { x: 0, y: 0, width: 1200, height: 720 },
  hasOnScreenKeyboard: false,
  isKeyboardOpen: false,
};

export const visibleViewportAtom = atom<VisibleViewport>(
  DEFAULT_VISIBLE_VIEWPORT,
);

export const visibleViewportRectAtom = atom(
  (get) => get(visibleViewportAtom).rect,
);

export const hasOnScreenKeyboardAtom = atom(
  (get) => get(visibleViewportAtom).hasOnScreenKeyboard,
);

export const isKeyboardOpenAtom = atom(
  (get) => get(visibleViewportAtom).isKeyboardOpen,
);
