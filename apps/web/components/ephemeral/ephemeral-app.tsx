"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { useAtomValue } from "jotai";

import WorldCanvas from "@/components/canvas/WorldCanvas";
import LocalEphemeral from "@/components/ephemeral/local-ephemeral";
import RemoteEphemeral from "@/components/ephemeral/remote-ephemeral";
import type { Point, Rect, Size } from "@/lib/spatial";
import { spatial } from "@/lib/spatial";
import { connectedUsersAtom } from "@/stores/stores";

const CANVAS_PADDING = 24;
const EPHEMERAL_GAP = 36;
const EPHEMERAL_SLOT_SIZE: Size = { width: 240, height: 136 };
const EPHEMERAL_CARET_INSET_RIGHT = 40;
const DEFAULT_VIEWPORT_SIZE: Size = { width: 1200, height: 720 };

export default function EphemeralApp() {
  return (
    <div className="font-sans">
      <main className="relative h-screen overflow-hidden">
        <div className="absolute inset-0">
          <WorldCanvas>
            <EphemeralLayer />
          </WorldCanvas>
        </div>
      </main>
    </div>
  );
}

function EphemeralLayer() {
  const connectedUsers = useAtomValue(connectedUsersAtom);
  const viewportSize = useViewportSize();
  const canvasBounds = useMemo(
    () => createCanvasBounds(viewportSize),
    [viewportSize]
  );
  const localRect = useMemo(
    () => createLocalRect(viewportSize),
    [viewportSize]
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
        <UserEphemeral />
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
            <IncomingEphemeralItem userId={user.id} />
          </EphemeralSlot>
        );
      })}
    </>
  );
}

function IncomingEphemeralItem({ userId }: { userId: string }) {
  return <RemoteEphemeral userId={userId} />;
}

function UserEphemeral() {
  return <LocalEphemeral />;
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
      <div
        className="absolute pointer-events-auto top-1/2 -translate-y-1/2"
        style={{
          left: EPHEMERAL_SLOT_SIZE.width - EPHEMERAL_CARET_INSET_RIGHT,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function useViewportSize(): Size {
  const [size, setSize] = useState<Size>(DEFAULT_VIEWPORT_SIZE);

  useEffect(() => {
    const update = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

function createCanvasBounds(size: Size): Rect {
  return {
    x: CANVAS_PADDING,
    y: CANVAS_PADDING,
    width: Math.max(0, size.width - CANVAS_PADDING * 2),
    height: Math.max(0, size.height - CANVAS_PADDING * 2),
  };
}

function createLocalRect(size: Size): Rect {
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
      size.height / 2 - EPHEMERAL_SLOT_SIZE.height / 2,
      CANVAS_PADDING,
      Math.max(
        CANVAS_PADDING,
        size.height - EPHEMERAL_SLOT_SIZE.height - CANVAS_PADDING
      )
    ),
    ...EPHEMERAL_SLOT_SIZE,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
