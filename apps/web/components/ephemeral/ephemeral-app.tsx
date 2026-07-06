"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import { useAtomValue } from "jotai";

import WorldCanvas from "@/components/canvas/WorldCanvas";
import LocalEphemeral from "@/components/ephemeral/local-ephemeral";
import RemoteEphemeral from "@/components/ephemeral/remote-ephemeral";
import useVisibleViewport from "@/hooks/useVisibleViewport";
import type { Point, Rect, Size } from "@/lib/spatial";
import { spatial } from "@/lib/spatial";
import { connectedUsersAtom } from "@/stores/stores";

const CANVAS_PADDING = 24;
const EPHEMERAL_GAP = 36;
const EPHEMERAL_SLOT_SIZE: Size = { width: 240, height: 136 };
const EPHEMERAL_CARET_INSET_RIGHT = 40;
const KEYBOARD_INPUT_GAP = 20;

export default function EphemeralApp() {
  const {
    rect: viewportRect,
    isKeyboardOpen,
    hasOnScreenKeyboard,
  } = useVisibleViewport();

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
            <EphemeralLayer
              hasOnScreenKeyboard={hasOnScreenKeyboard}
              isKeyboardOpen={isKeyboardOpen}
              viewportSize={viewportRect}
            />
          </WorldCanvas>
        </div>
      </main>
    </div>
  );
}

function EphemeralLayer({
  hasOnScreenKeyboard,
  isKeyboardOpen,
  viewportSize,
}: {
  hasOnScreenKeyboard: boolean;
  isKeyboardOpen: boolean;
  viewportSize: Size;
}) {
  const connectedUsers = useAtomValue(connectedUsersAtom);
  const canvasBounds = useMemo(
    () => createCanvasBounds(viewportSize),
    [viewportSize]
  );
  const localRect = useMemo(
    () => createLocalRect(viewportSize, isKeyboardOpen),
    [isKeyboardOpen, viewportSize]
  );
  const placements = useMemo(
    () =>
      spatial.layoutUsers({
        userIds: connectedUsers.map((user) => user.id),
        bounds: canvasBounds,
        itemSize: EPHEMERAL_SLOT_SIZE,
        reservedRects: [localRect],
        gap: EPHEMERAL_GAP,
      }),
    [canvasBounds, connectedUsers, localRect]
  );

  return (
    <>
      <EphemeralSlot point={localRect} testId="local-composition-slot">
        <LocalCompositionAnchor isKeyboardOpen={isKeyboardOpen}>
          <LocalEphemeral
            manualKeyboardActivation={hasOnScreenKeyboard}
            showStartTypingButton={hasOnScreenKeyboard && !isKeyboardOpen}
          />
        </LocalCompositionAnchor>
      </EphemeralSlot>

      {connectedUsers.map((user) => {
        const point = placements.get(user.id);
        if (!point) return null;

        return (
          <EphemeralSlot
            key={user.id}
            point={point}
            testId="remote-composition-slot"
          >
            <CompositionAnchor>
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
  testId,
}: {
  children: ReactNode;
  point: Point;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="absolute pointer-events-none"
      style={{
        width: EPHEMERAL_SLOT_SIZE.width,
        height: EPHEMERAL_SLOT_SIZE.height,
        transform: `translate3d(${point.x}px, ${point.y}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}

function CompositionAnchor({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute pointer-events-auto top-1/2 -translate-y-1/2"
      style={{
        left: EPHEMERAL_SLOT_SIZE.width - EPHEMERAL_CARET_INSET_RIGHT,
      }}
    >
      {children}
    </div>
  );
}

function LocalCompositionAnchor({
  children,
  isKeyboardOpen,
}: {
  children: ReactNode;
  isKeyboardOpen: boolean;
}) {
  return (
    <div
      className={
        isKeyboardOpen
          ? "absolute pointer-events-auto bottom-0"
          : "absolute pointer-events-auto top-1/2 -translate-y-1/2"
      }
      style={{
        left: EPHEMERAL_SLOT_SIZE.width - EPHEMERAL_CARET_INSET_RIGHT,
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

function createLocalRect(size: Size, isKeyboardOpen: boolean): Rect {
  const bottomInset = isKeyboardOpen ? KEYBOARD_INPUT_GAP : CANVAS_PADDING;

  return {
    x: clamp(
      size.width / 2 - EPHEMERAL_SLOT_SIZE.width + EPHEMERAL_CARET_INSET_RIGHT,
      CANVAS_PADDING,
      Math.max(
        CANVAS_PADDING,
        size.width - EPHEMERAL_SLOT_SIZE.width - CANVAS_PADDING
      )
    ),
    y: clamp(
      isKeyboardOpen
        ? size.height - EPHEMERAL_SLOT_SIZE.height - KEYBOARD_INPUT_GAP
        : size.height / 2 - EPHEMERAL_SLOT_SIZE.height / 2,
      CANVAS_PADDING,
      Math.max(
        CANVAS_PADDING,
        size.height - EPHEMERAL_SLOT_SIZE.height - bottomInset
      )
    ),
    ...EPHEMERAL_SLOT_SIZE,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
