"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { useAtomValue } from "jotai";
import { Info, X } from "lucide-react";

import WorldCanvas from "@/components/canvas/WorldCanvas";
import LocalEphemeral from "@/components/ephemeral/local-ephemeral";
import RemoteEphemeral from "@/components/ephemeral/remote-ephemeral";
import useVisibleViewport from "@/hooks/useVisibleViewport";
import type { Point, Rect, Size } from "@/lib/spatial";
import { spatial } from "@/lib/spatial";
import { connectedUsersAtom } from "@/stores/stores";
import {
  isKeyboardOpenAtom,
  visibleViewportRectAtom,
} from "@/stores/viewport";

const CANVAS_PADDING = 24;
const EPHEMERAL_GAP = 36;
const EPHEMERAL_SLOT_MAX_SIZE: Size = { width: 240, height: 136 };
const EPHEMERAL_CARET_INSET_RIGHT = 40;
const KEYBOARD_INPUT_GAP = 20;
const KEYBOARD_INPUT_LEFT_OFFSET_INCREASE = 24;

export default function EphemeralApp() {
  useVisibleViewport();

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const viewportRect = useAtomValue(visibleViewportRectAtom);

  return (
    <div className="font-sans">
      <main
        className="fixed overflow-hidden"
        style={{
          left: viewportRect.x,
          top: viewportRect.y,
          width: viewportRect.width,
          height: viewportRect.height,
        }}
      >
        <div className="absolute inset-0">
          <WorldCanvas>
            <EphemeralLayer />
          </WorldCanvas>
        </div>

        {isInfoOpen && <InfoOverlay />}

        <button
          type="button"
          aria-label={
            isInfoOpen ? "Close app information" : "Show app information"
          }
          aria-expanded={isInfoOpen}
          onClick={() => setIsInfoOpen((open) => !open)}
          className="absolute right-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white/85 text-neutral-900 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-95"
        >
          {isInfoOpen ? (
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
          ) : (
            <Info aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
          )}
        </button>
      </main>
    </div>
  );
}

function InfoOverlay() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-info-title"
      className="absolute inset-0 z-30 grid place-items-center bg-white/45 px-6 text-neutral-950 backdrop-blur-md"
    >
      <section className="max-w-[min(34rem,calc(100vw-3rem))] text-center">
        <h1
          id="app-info-title"
          className="text-2xl font-semibold leading-tight sm:text-3xl"
        >
          Ephemeral is a shared typing canvas.
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-700 sm:text-base sm:leading-7">
          Type and your words appear live in the space for everyone connected.
          Other people&apos;s thoughts drift in as anonymous, temporary text, then
          fade away so the room stays light, present, and unrecorded.
        </p>
      </section>
    </div>
  );
}

function EphemeralLayer() {
  const connectedUsers = useAtomValue(connectedUsersAtom);
  const isKeyboardOpen = useAtomValue(isKeyboardOpenAtom);
  const viewportRect = useAtomValue(visibleViewportRectAtom);
  const viewportSize = useMemo(
    () => getRectSize(viewportRect),
    [viewportRect],
  );
  const canvasBounds = useMemo(
    () => createCanvasBounds(viewportSize),
    [viewportSize]
  );
  const slotSize = useMemo(
    () => createEphemeralSlotSize(viewportSize),
    [viewportSize]
  );
  const localRect = useMemo(
    () => createLocalRect(viewportSize, slotSize, isKeyboardOpen),
    [isKeyboardOpen, slotSize, viewportSize]
  );
  const placements = useMemo(
    () =>
      spatial.layoutUsers({
        userIds: connectedUsers.map((user) => user.id),
        bounds: canvasBounds,
        itemSize: slotSize,
        reservedRects: [localRect],
        gap: EPHEMERAL_GAP,
      }),
    [canvasBounds, connectedUsers, localRect, slotSize]
  );

  return (
    <>
      <EphemeralSlot
        point={localRect}
        size={slotSize}
        testId="local-composition-slot"
      >
        <LocalCompositionAnchor slotWidth={slotSize.width}>
          <LocalEphemeral />
        </LocalCompositionAnchor>
      </EphemeralSlot>

      {connectedUsers.map((user) => {
        const point = placements.get(user.id);
        if (!point) return null;

        return (
          <EphemeralSlot
            key={user.id}
            point={point}
            size={slotSize}
            testId="remote-composition-slot"
          >
            <CompositionAnchor slotWidth={slotSize.width}>
              <IncomingEphemeralItem userId={user.id} />
            </CompositionAnchor>
          </EphemeralSlot>
        );
      })}
    </>
  );
}

function IncomingEphemeralItem({ userId }: { userId: string }) {
  return <RemoteEphemeral userId={userId} />;
}

function EphemeralSlot({
  children,
  point,
  size,
  testId,
}: {
  children: ReactNode;
  point: Point;
  size: Size;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="absolute pointer-events-none"
      style={{
        width: size.width,
        height: size.height,
        transform: `translate3d(${point.x}px, ${point.y}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}

function CompositionAnchor({
  children,
  slotWidth,
}: {
  children: ReactNode;
  slotWidth: number;
}) {
  return (
    <div
      className="absolute pointer-events-auto top-1/2 -translate-y-1/2"
      style={{
        left: slotWidth - EPHEMERAL_CARET_INSET_RIGHT,
      }}
    >
      {children}
    </div>
  );
}

function LocalCompositionAnchor({
  children,
  slotWidth,
}: {
  children: ReactNode;
  slotWidth: number;
}) {
  const isKeyboardOpen = useAtomValue(isKeyboardOpenAtom);

  return (
    <div
      className={
        isKeyboardOpen
          ? "absolute pointer-events-auto bottom-0 flex"
          : "absolute pointer-events-auto top-1/2 -translate-y-1/2"
      }
      style={{
        left: slotWidth - EPHEMERAL_CARET_INSET_RIGHT,
      }}
    >
      {children}
    </div>
  );
}

function createCanvasBounds(size: Size): Rect {
  return {
    x: CANVAS_PADDING,
    y: CANVAS_PADDING,
    width: Math.max(0, size.width - CANVAS_PADDING * 2),
    height: Math.max(0, size.height - CANVAS_PADDING * 2),
  };
}

function createEphemeralSlotSize(size: Size): Size {
  return {
    width: Math.max(
      EPHEMERAL_CARET_INSET_RIGHT,
      Math.min(EPHEMERAL_SLOT_MAX_SIZE.width, size.width / 2)
    ),
    height: EPHEMERAL_SLOT_MAX_SIZE.height,
  };
}

function createLocalRect(
  size: Size,
  slotSize: Size,
  isKeyboardOpen: boolean
): Rect {
  const bottomInset = isKeyboardOpen ? KEYBOARD_INPUT_GAP : CANVAS_PADDING;
  const centeredX =
    size.width / 2 - slotSize.width + EPHEMERAL_CARET_INSET_RIGHT;
  const keyboardOpenX =
    size.width -
    slotSize.width -
    KEYBOARD_INPUT_GAP +
    EPHEMERAL_CARET_INSET_RIGHT -
    KEYBOARD_INPUT_LEFT_OFFSET_INCREASE;
  const x = isKeyboardOpen ? keyboardOpenX : centeredX;
  const maxX = isKeyboardOpen
    ? keyboardOpenX
    : size.width - slotSize.width - CANVAS_PADDING;

  return {
    x: clamp(
      x,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, maxX)
    ),
    y: clamp(
      isKeyboardOpen
        ? size.height - slotSize.height - KEYBOARD_INPUT_GAP
        : size.height / 2 - slotSize.height / 2,
      CANVAS_PADDING,
      Math.max(
        CANVAS_PADDING,
        size.height - slotSize.height - bottomInset
      )
    ),
    ...slotSize,
  };
}

function getRectSize(rect: Rect): Size {
  return {
    width: rect.width,
    height: rect.height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
