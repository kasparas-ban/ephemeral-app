"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, worldToScreen } from "@/lib/spatial";
import { TypingEnd, TypingState } from "@/lib/types";

type CompositionKey = string; // `${userId}:${compositionId}`

type ActiveComp = {
  userId: string;
  compositionId: string;
  seq: number;
  text: string;
  ts: number;
  ended?: { ts: number; ttlMs: number };
};

export default function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const compsRef = useRef<Map<CompositionKey, ActiveComp>>(new Map());
  const draggingRef = useRef<{ x: number; y: number } | null>(null);

  // external API for event handlers
  (globalThis as any).__worldCanvas = {
    applyTypingState: (m: TypingState) => {
      const key = `${m.fromUserId}:${m.compositionId}`;
      const existing = compsRef.current.get(key);
      if (!existing || m.seq >= existing.seq) {
        compsRef.current.set(key, {
          userId: m.fromUserId,
          compositionId: m.compositionId,
          seq: m.seq,
          text: m.text,
          ts: m.ts,
          ended: existing?.ended,
        });
      }
    },
    applyTypingEnd: (m: TypingEnd) => {
      const key = `${m.fromUserId}:${m.compositionId}`;
      const existing = compsRef.current.get(key);
      const ttl = m.ttlMs ?? 12000;
      if (existing) {
        existing.ended = { ts: m.ts, ttlMs: ttl };
      } else {
        compsRef.current.set(key, {
          userId: m.fromUserId,
          compositionId: m.compositionId,
          seq: 0,
          text: m.finalText ?? "",
          ts: m.ts,
          ended: { ts: m.ts, ttlMs: ttl },
        });
      }
    },
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    function resize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    function draw() {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(-cam.x * cam.zoom, -cam.y * cam.zoom);
      ctx.scale(cam.zoom, cam.zoom);

      const now = performance.now();
      const removeKeys: string[] = [];
      ctx.font = "16px ui-sans-serif, system-ui, -apple-system";
      ctx.textBaseline = "top";
      for (const [key, c] of compsRef.current) {
        const age = now - c.ts;
        let alpha = 1;
        if (c.ended) {
          const t = (now - c.ended.ts) / c.ended.ttlMs;
          alpha = Math.max(0, 1 - t);
          if (t >= 1) {
            removeKeys.push(key);
            continue;
          }
        }
        const posSeed = hash32(key);
        const x = Math.cos(posSeed) * 2000 + (posSeed % 200);
        const y = Math.sin(posSeed) * 2000 + ((posSeed >>> 8) % 200);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#e5e7eb"; // tailwind gray-200
        const drift = Math.sin(now / 1200 + posSeed) * 6;
        ctx.fillText(c.text || "", x + drift, y);
        // caret for active
        if (!c.ended) {
          const w = ctx.measureText(c.text || "").width;
          const blink = ((now / 500) | 0) % 2 === 0;
          if (blink) {
            ctx.fillRect(x + w + 2, y, 2, 16);
          }
        }
      }
      for (const k of removeKeys) compsRef.current.delete(k);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [cam]);

  // Pan & zoom
  useEffect(() => {
    const el = canvasRef.current!;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const scale = Math.exp(-e.deltaY * 0.001);
      setCam((c) => ({
        ...c,
        zoom: Math.max(0.2, Math.min(3, c.zoom * scale)),
      }));
    }
    function onDown(e: MouseEvent) {
      draggingRef.current = { x: e.clientX, y: e.clientY };
    }
    function onMove(e: MouseEvent) {
      const d = draggingRef.current;
      if (!d) return;
      const dx = (e.clientX - d.x) / cam.zoom;
      const dy = (e.clientY - d.y) / cam.zoom;
      setCam((c) => ({ ...c, x: c.x - dx, y: c.y - dy }));
      draggingRef.current = { x: e.clientX, y: e.clientY };
    }
    function onUp() {
      draggingRef.current = null;
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel as any);
      el.removeEventListener("mousedown", onDown as any);
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp as any);
    };
  }, [cam.zoom]);

  return (
    <canvas ref={canvasRef} className="w-full h-[80vh] rounded-lg bg-black" />
  );
}

function hash32(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}
