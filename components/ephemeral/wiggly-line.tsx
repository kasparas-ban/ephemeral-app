"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type WiggleLineProps = {
  width?: number;
  height?: number;
  /**
   * Number of points used to construct the line.
   * More points = more detail (and a little more CPU).
   */
  points?: number;
  /**
   * Maximum vertical offset from the baseline (in px).
   */
  amplitude?: number;
  /**
   * How fast the line eases toward the next random shape.
   * 0.01 = very slow, 0.2 = faster.
   */
  speed?: number;
  /**
   * How often to choose new random target positions (in ms).
   * (Note: continuous motion ignores this; kept for backward-compat.)
   */
  targetIntervalMs?: number;
  stroke?: string;
  strokeWidth?: number;
  /**
   * Padding around the path to keep it inside the viewport.
   */
  padding?: number;
  className?: string;
  /**
   * Optional: supply your own baseline (default: height / 2).
   */
  baselineY?: number;
  /**
   * Number of big horizontal wiggles across the width (lower = larger waves).
   */
  wiggles?: number;
  /**
   * Exponent controlling how amplitude tapers toward the right edge.
   * 1 = linear falloff, >1 = steeper (less motion on the right).
   */
  amplitudeEdgeExponent?: number;
};

/**
 * React component that renders an animated, smoothly wiggling SVG line.
 * The wiggle is random but eased over time so it looks organic and slow.
 *
 * Now uses continuous, low-frequency target evolution so it never "stops".
 */
export function WiggleLine({
  width = 400,
  height = 180,
  points = 24,
  amplitude = 40,
  speed = 0.05,
  targetIntervalMs = 2400,
  stroke = "#4A90E2",
  strokeWidth = 3,
  padding = 12,
  className,
  baselineY,
  wiggles = 3, // fewer means larger waves
  amplitudeEdgeExponent = 1.2, // stronger taper so right side barely moves
}: WiggleLineProps) {
  const baseY = baselineY ?? height / 2;

  // X positions are fixed and evenly spaced across the width.
  const xs = useMemo(() => {
    const usable = Math.max(0, width - 2 * padding);
    if (points <= 1) return [padding + usable / 2];
    return Array.from(
      { length: points },
      (_, i) => padding + (i * usable) / (points - 1)
    );
  }, [width, padding, points]);

  // Refs for animation state
  const currentYRef = useRef<number[]>([]);
  const targetYRef = useRef<number[]>([]);
  const pathRef = useRef<SVGPathElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0); // time in seconds
  const lastTsRef = useRef<number | null>(null);
  const anchorOscRef = useRef<
    Array<{ omega: number; phi: number; amp: number }>
  >([]);

  // Force a one-time init of arrays on mount or whenever points/baseY change.
  useEffect(() => {
    currentYRef.current = Array.from({ length: points }, () => baseY);
    targetYRef.current = Array.from({ length: points }, () => baseY);
  }, [points, baseY]);

  // Build a smooth path from points using Catmull–Rom to cubic Bezier conversion.
  const buildPath = (xsArr: number[], ysArr: number[]) => {
    const n = xsArr.length;
    if (n === 0) return "";
    if (n === 1) return `M ${xsArr[0]} ${ysArr[0]}`;

    const pts = xsArr.map((x, i) => ({ x, y: ysArr[i] }));

    const tension = 1; // 1 == classic Catmull–Rom
    const toStr = (p: { x: number; y: number }) =>
      `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;

    let d = `M ${toStr(pts[0])}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = i === 0 ? pts[0] : pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i + 2 < n ? pts[i + 2] : pts[n - 1];

      const c1 = {
        x: p1.x + ((p2.x - p0.x) / 6) * tension,
        y: p1.y + ((p2.y - p0.y) / 6) * tension,
      };
      const c2 = {
        x: p2.x - ((p3.x - p1.x) / 6) * tension,
        y: p2.y - ((p3.y - p1.y) / 6) * tension,
      };
      d += ` C ${toStr(c1)} ${toStr(c2)} ${toStr(p2)}`;
    }
    return d;
  };

  // Compute a new set of targets based on smoothly evolving anchor values over time.
  const makeNewTargets = () => {
    // Number of large-scale wiggles across the width (lower = larger waves)
    const waveCount = Math.max(1, Math.floor(wiggles));
    const anchors = Math.max(2, waveCount + 1);

    // Ensure we have oscillator params for each anchor
    if (anchorOscRef.current.length !== anchors) {
      // slow, slightly different frequencies/phases per anchor
      anchorOscRef.current = Array.from({ length: anchors }, () => ({
        omega: 0.35 + Math.random() * 0.5, // rad/s ~ periods 7-18s
        phi: Math.random() * Math.PI * 2,
        amp: 0.85 + Math.random() * 0.3, // slight variation in amplitude
      }));
    }

    const t = tRef.current;

    // Anchor values in [-1,1] evolving continuously with time
    const a = anchorOscRef.current.map(
      (o) => Math.sin(o.omega * t + o.phi) * o.amp
    );

    // Light spatial smoothing so neighboring anchors relate a bit
    for (let i = 1; i < a.length - 1; i++) {
      a[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4;
    }

    const maxY = height - padding;
    const minY = padding;

    // Smoothstep interpolation across anchors to get low-frequency values along X
    const next = Array.from({ length: points }, (_, i) => {
      if (points === 1) return Math.max(minY, Math.min(maxY, baseY));
      const tGlobal = (i / (points - 1)) * (anchors - 1);
      const j = Math.min(anchors - 2, Math.max(0, Math.floor(tGlobal)));
      const tt = tGlobal - j; // local [0,1]
      const s = tt * tt * (3 - 2 * tt); // smoothstep
      const v = a[j] * (1 - s) + a[j + 1] * s;

      // Amplitude taper: minimal on the right, increasing to the left
      const tX = points <= 1 ? 1 : i / (points - 1); // 0 at left, 1 at right
      const ampScale = Math.pow(1 - tX, Math.max(0, amplitudeEdgeExponent));

      const y = baseY + v * amplitude * ampScale;
      return Math.max(minY, Math.min(maxY, y));
    });

    // Keep the right end fixed at baseY
    if (next.length > 0) {
      next[next.length - 1] = Math.max(minY, Math.min(maxY, baseY));
    }

    targetYRef.current = next;
  };

  // Animation loop: advance time, update targets, ease currentY toward targetY, and update path.
  useEffect(() => {
    const tick = () => {
      const now = performance.now() / 1000; // seconds
      if (lastTsRef.current == null) lastTsRef.current = now;
      const dt = now - lastTsRef.current;
      lastTsRef.current = now;

      // advance time (natural seconds)
      tRef.current += dt;

      // update continuously evolving targets
      makeNewTargets();

      const curr = currentYRef.current;
      const targ = targetYRef.current;

      // Ease toward targets
      for (let i = 0; i < curr.length; i++) {
        curr[i] += (targ[i] - curr[i]) * speed;
      }
      // Hard-anchor the rightmost point so it never moves
      if (curr.length > 0) {
        curr[curr.length - 1] = baseY;
      }

      // Update the path without causing a React re-render every frame
      if (pathRef.current) {
        const d = buildPath(xs, curr);
        pathRef.current.setAttribute("d", d);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    // Initialize time and first targets, then start animation
    tRef.current = 0;
    lastTsRef.current = performance.now() / 1000;
    makeNewTargets();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // Re-init when core parameters change
  }, [
    speed,
    amplitude,
    amplitudeEdgeExponent,
    baseY,
    height,
    padding,
    points,
    wiggles,
  ]);

  // Provide a stable initial path to avoid empty render before the first RAF.
  const [initialD] = useState(() =>
    buildPath(
      xs,
      Array.from({ length: points }, () => baseY)
    )
  );

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Animated wiggling line"
    >
      <path
        ref={pathRef}
        d={initialD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default WiggleLine;
