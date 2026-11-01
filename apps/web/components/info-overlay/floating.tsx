"use client";

import { motion } from "motion/react";

const seeded = (i: number, salt: number) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const seededOffset = (i: number, salt: number, max: number, minAbs: number) =>
  (seeded(i, salt) < 0.5 ? -1 : 1) *
  (minAbs + seeded(i, salt + 10) * (max - minAbs));

export function letterFloat(i: number) {
  return {
    y0: seededOffset(i, 1, 4, 1.5),
    y1: seededOffset(i, 2, 4, 1.5),
    r0: seededOffset(i, 3, 2, 0.5),
    r1: seededOffset(i, 4, 2, 0.5),
    duration: 3 + seeded(i, 7) * 2,
  };
}

export function FloatingLetter({
  char,
  index,
  still,
}: {
  char: string;
  index: number;
  still: boolean;
}) {
  if (still) {
    return (
      <span aria-hidden="true" className="inline-block">
        {char}
      </span>
    );
  }

  const { y0, y1, r0, r1, duration } = letterFloat(index);
  return (
    <motion.span
      aria-hidden="true"
      className="inline-block"
      initial={{ y: y0, rotate: r0 }}
      animate={{ y: y1, rotate: r1 }}
      transition={{
        duration,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror",
      }}
    >
      {char}
    </motion.span>
  );
}

const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * p);

// Matches motion's mirrored keyframes so the canvas floats like the DOM fallback.
export function sampleMirrored(
  keyframes: readonly number[],
  duration: number,
  seconds: number,
) {
  let p = (seconds / duration) % 2;
  if (p > 1) p = 2 - p;
  const segments = keyframes.length - 1;
  const s = p * segments;
  const i = Math.min(Math.floor(s), segments - 1);
  return keyframes[i] + (keyframes[i + 1] - keyframes[i]) * easeInOut(s - i);
}
