"use client";

import { ReactNode, useRef } from "react";
import { useDrag } from "@use-gesture/react";

export default function WorldCanvas({ children }: { children?: ReactNode }) {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const bind = useDrag((state) => {
    if (canvasRef.current) {
      const {
        offset: [x, y],
      } = state;
      canvasRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, {});

  return (
    <div className="w-full h-full touch-none" {...bind()}>
      <div ref={canvasRef} className="absolute">
        {children}
      </div>
    </div>
  );
}
