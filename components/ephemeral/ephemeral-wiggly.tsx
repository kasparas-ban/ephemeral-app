"use client";

import React, {
  FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./styles.module.css";

export type EphemeralWigglyProps = {
  width?: number;
  height?: number;
  points?: number; // number of control points along the path
  amplitude?: number; // vertical wiggle amplitude (px)
  speed?: number; // easing toward target
  padding?: number; // inner padding in the svg
  stroke?: string;
  strokeWidth?: number;
  className?: string; // applied to wrapping div
  svgClassName?: string; // applied to svg element
  textClassName?: string; // applied to <text> element
  baselineY?: number; // optional baseline override
  wiggles?: number; // number of big horizontal wiggles
  amplitudeEdgeExponent?: number; // taper on the right side
  placeholder?: string;
};

/**
 * Combined component: captures text input and renders it along an animated wiggly SVG path.
 * The text is anchored to the right end of the path so it follows the line as it animates.
 */
export default function EphemeralWiggly({
  width = 520,
  height = 180,
  points = 5,
  amplitude = 32,
  speed = 0.06,
  padding = 12,
  stroke = "#94a3b8", // slate-400
  strokeWidth = 2.5,
  className,
  svgClassName,
  textClassName,
  baselineY,
  wiggles = 3,
  amplitudeEdgeExponent = 1,
  placeholder = "Type here",
}: EphemeralWigglyProps) {
  // Invisible editable target
  const editableRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState("");

  const setFromEditable = () => {
    if (!editableRef.current) return;
    // Normalize to single-line text
    const txt = editableRef.current.innerText.replace(/\n+/g, " ");
    setValue(txt);
  };

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    setFromEditable();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
    if (editableRef.current) {
      editableRef.current.innerText += text;
      setFromEditable();
    }
  };

  useEffect(() => {
    editableRef.current?.focus();
  }, []);

  // Wiggly line internals (adapted from WiggleLine)
  const baseY = baselineY ?? height / 2;
  const xs = useMemo(() => {
    const usable = Math.max(0, width - 2 * padding);
    if (points <= 1) return [padding + usable / 2];
    return Array.from(
      { length: points },
      (_, i) => padding + (i * usable) / (points - 1)
    );
  }, [width, padding, points]);

  const currentYRef = useRef<number[]>([]);
  const targetYRef = useRef<number[]>([]);
  const pathRef = useRef<SVGPathElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const anchorOscRef = useRef<
    Array<{ omega: number; phi: number; amp: number }>
  >([]);

  useEffect(() => {
    currentYRef.current = Array.from({ length: points }, () => baseY);
    targetYRef.current = Array.from({ length: points }, () => baseY);
  }, [points, baseY]);

  const buildPath = (xsArr: number[], ysArr: number[]) => {
    const n = xsArr.length;
    if (n === 0) return "";
    if (n === 1) return `M ${xsArr[0]} ${ysArr[0]}`;

    const pts = xsArr.map((x, i) => ({ x, y: ysArr[i] }));
    const tension = 1;
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

  const makeNewTargets = () => {
    const waveCount = Math.max(1, Math.floor(wiggles));
    const anchors = Math.max(2, waveCount + 1);

    if (anchorOscRef.current.length !== anchors) {
      anchorOscRef.current = Array.from({ length: anchors }, () => ({
        omega: 0.35 + Math.random() * 0.5,
        phi: Math.random() * Math.PI * 2,
        amp: 0.85 + Math.random() * 0.3,
      }));
    }

    const t = tRef.current;
    const a = anchorOscRef.current.map(
      (o) => Math.sin(o.omega * t + o.phi) * o.amp
    );
    for (let i = 1; i < a.length - 1; i++)
      a[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4;

    const maxY = height - padding;
    const minY = padding;

    const next = Array.from({ length: points }, (_, i) => {
      if (points === 1) return Math.max(minY, Math.min(maxY, baseY));
      const tGlobal = (i / (points - 1)) * (anchors - 1);
      const j = Math.min(anchors - 2, Math.max(0, Math.floor(tGlobal)));
      const tt = tGlobal - j;
      const s = tt * tt * (3 - 2 * tt);
      const v = a[j] * (1 - s) + a[j + 1] * s;

      const tX = points <= 1 ? 1 : i / (points - 1);
      const ampScale = Math.pow(1 - tX, Math.max(0, amplitudeEdgeExponent));

      const y = baseY + v * amplitude * ampScale;
      return Math.max(minY, Math.min(maxY, y));
    });

    if (next.length > 0)
      next[next.length - 1] = Math.max(minY, Math.min(maxY, baseY));

    targetYRef.current = next;
  };

  useEffect(() => {
    const tick = () => {
      const now = performance.now() / 1000;
      if (lastTsRef.current == null) lastTsRef.current = now;
      const dt = now - (lastTsRef.current ?? now);
      lastTsRef.current = now;
      tRef.current += dt;

      makeNewTargets();

      const curr = currentYRef.current;
      const targ = targetYRef.current;
      for (let i = 0; i < curr.length; i++)
        curr[i] += (targ[i] - curr[i]) * speed;
      if (curr.length > 0) curr[curr.length - 1] = baseY;

      if (pathRef.current) {
        const d = buildPath(xs, curr);
        pathRef.current.setAttribute("d", d);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    tRef.current = 0;
    lastTsRef.current = performance.now() / 1000;
    makeNewTargets();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [
    speed,
    amplitude,
    amplitudeEdgeExponent,
    baseY,
    height,
    padding,
    points,
    wiggles,
    xs,
  ]);

  const [initialD] = useState(() =>
    buildPath(
      xs,
      Array.from({ length: points }, () => baseY)
    )
  );

  // Generate a stable path id for textPath
  const pathId = useId();

  const focusEditor = () => editableRef.current?.focus();

  return (
    <div
      className={
        className ? `relative select-none ${className}` : "relative select-none"
      }
      tabIndex={0}
      onFocus={focusEditor}
      onPointerDown={focusEditor}
      aria-label="Type to write along the wiggly line"
    >
      <svg
        className={svgClassName}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Ephemeral text along wiggly line"
      >
        <defs>
          <path id={pathId} ref={pathRef} d={initialD} />
        </defs>

        {/* Visible line */}
        <use
          href={`#${pathId}`}
          xlinkHref={`#${pathId}`}
          fill="none"
          stroke={stroke}
          //   strokeWidth={strokeWidth}
          strokeWidth={0}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Text following the path; anchored to the right end so it sticks to the stable endpoint */}
        <text
          className={textClassName}
          fill="currentColor"
          dominantBaseline="middle"
          style={{ fontFamily: "inherit" }}
        >
          <textPath
            href={`#${pathId}`}
            xlinkHref={`#${pathId}`}
            startOffset="100%"
            textAnchor="end"
          >
            {value}
            <tspan className={styles.caret}>|</tspan>
          </textPath>
        </text>
      </svg>

      {/* Invisible, focusable editable target to capture typing (overlay full SVG) */}
      <div
        ref={editableRef}
        contentEditable
        role="textbox"
        spellCheck={false}
        onBlur={focusEditor}
        onInput={handleInput}
        onCompositionEnd={handleInput}
        onPaste={handlePaste}
        // Cover the SVG so clicks focus it; keep text and caret invisible
        className="absolute inset-0 w-full h-full overflow-hidden outline-none text-transparent caret-transparent selection:bg-transparent"
        title={placeholder}
      />
    </div>
  );
}
