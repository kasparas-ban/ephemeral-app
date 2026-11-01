"use client";

import { motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";

// The whole screen opens the keyboard; only a breathing hint shows where.
export default function StartTypingHint({ onStart }: { onStart: () => void }) {
  const reduceMotion = useReducedMotion();

  return createPortal(
    <button
      type="button"
      data-testid="local-composition-start-typing"
      aria-label="Start typing"
      onClick={onStart}
      className="fixed inset-0 z-20 flex items-end justify-center pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <motion.span
        aria-hidden="true"
        className="text-xs tracking-[0.2em] text-neutral-500"
        initial={{ opacity: 0 }}
        animate={
          reduceMotion ? { opacity: 0.6 } : { opacity: [0.25, 0.8, 0.25] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        tap anywhere to write
      </motion.span>
    </button>,
    // Inside <main>, not <body>, so the info button stays on top of it.
    document.querySelector("main") ?? document.body,
  );
}
