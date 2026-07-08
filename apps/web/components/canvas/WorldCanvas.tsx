"use client";

import { ReactNode, useRef } from "react";

export default function WorldCanvas({ children }: { children?: ReactNode }) {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="h-full w-full touch-none">
      <div ref={canvasRef} className="absolute">
        {children}
      </div>
    </div>
  );
}
