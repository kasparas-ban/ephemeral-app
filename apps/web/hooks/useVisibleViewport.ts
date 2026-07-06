import { useEffect } from "react";

import { useSetAtom } from "jotai";

import type { Rect } from "@/lib/spatial";
import { visibleViewportAtom } from "@/stores/viewport";

const EMPTY_KEYBOARD_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };
const KEYBOARD_VIEWPORT_THRESHOLD = 80;

interface VirtualKeyboard extends EventTarget {
  readonly boundingRect: DOMRectReadOnly;
  overlaysContent: boolean;
}

type NavigatorWithVirtualKeyboard = Navigator & {
  virtualKeyboard?: VirtualKeyboard;
};

export default function useVisibleViewport() {
  const setVisibleViewport = useSetAtom(visibleViewportAtom);

  useEffect(() => {
    const keyboard = getVirtualKeyboard();
    const visualViewport = window.visualViewport;

    if (keyboard) keyboard.overlaysContent = true;

    const syncViewport = () => {
      const visualViewportRect = getVisualViewportRect();
      const keyboardRect = getKeyboardRect(keyboard);
      const usableRect = createUsableViewportRect(
        visualViewportRect,
        keyboardRect,
      );
      const hasOnScreenKeyboard = canShowOnScreenKeyboard();
      const isKeyboardOpen = isOnScreenKeyboardOpen(
        keyboardRect,
        hasOnScreenKeyboard,
      );

      setVisibleViewport({
        rect: usableRect,
        hasOnScreenKeyboard,
        isKeyboardOpen,
      });
    };

    document.addEventListener("focusin", syncViewport);
    document.addEventListener("focusout", syncViewport);
    window.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);
    keyboard?.addEventListener("geometrychange", syncViewport);
    syncViewport();

    return () => {
      document.removeEventListener("focusin", syncViewport);
      document.removeEventListener("focusout", syncViewport);
      window.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("scroll", syncViewport);
      keyboard?.removeEventListener("geometrychange", syncViewport);
    };
  }, [setVisibleViewport]);
}

export function createUsableViewportRect(
  viewportRect: Rect,
  keyboardRect: Rect,
): Rect {
  if (!rectsIntersect(viewportRect, keyboardRect)) return viewportRect;

  return {
    ...viewportRect,
    height: Math.max(
      0,
      Math.min(viewportRect.y + viewportRect.height, keyboardRect.y) -
        viewportRect.y,
    ),
  };
}

const getVirtualKeyboard = () =>
  (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;

const getVisualViewportRect = (): Rect => {
  const viewport = window.visualViewport;

  return {
    x: viewport?.offsetLeft ?? 0,
    y: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
};

const getKeyboardRect = (keyboard?: VirtualKeyboard): Rect => {
  const rect = keyboard?.boundingRect;

  if (!rect) return EMPTY_KEYBOARD_RECT;

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
};

const isOnScreenKeyboardOpen = (
  keyboardRect: Rect,
  hasOnScreenKeyboard: boolean,
) => {
  if (!hasOnScreenKeyboard) return false;
  if (keyboardRect.height > 0) return true;

  const viewport = window.visualViewport;
  const activeElement = document.activeElement;
  const isEditing =
    activeElement instanceof HTMLElement && isKeyboardInput(activeElement);
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportReduction = window.innerHeight - viewportHeight;

  return isEditing && viewportReduction > KEYBOARD_VIEWPORT_THRESHOLD;
};

const canShowOnScreenKeyboard = () =>
  window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
  /Android|iPad|iPhone|iPod/.test(navigator.userAgent);

const isKeyboardInput = (elem: HTMLElement) =>
  (elem.tagName === "INPUT" &&
    !["button", "submit", "checkbox", "file", "image"].includes(
      (elem as HTMLInputElement).type,
    )) ||
  elem.hasAttribute("contenteditable");

const rectsIntersect = (a: Rect, b: Rect) =>
  a.width > 0 &&
  a.height > 0 &&
  b.width > 0 &&
  b.height > 0 &&
  b.x < a.x + a.width &&
  b.x + b.width > a.x &&
  b.y < a.y + a.height &&
  b.y + b.height > a.y;
