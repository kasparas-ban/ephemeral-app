"use client";

import { motion, type Transition, useReducedMotion } from "motion/react";

export default function InfoOverlay({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const instant = (transition: Transition) =>
    reduceMotion ? { duration: 0 } : transition;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-info-title"
      className="absolute inset-0 z-30 grid place-items-center px-6 text-neutral-950"
      initial={{
        backgroundColor: "rgba(255, 255, 255, 0)",
        backdropFilter: "blur(0px)",
      }}
      animate={{
        backgroundColor: "rgba(255, 255, 255, 1)",
        backdropFilter: "blur(8px)",
      }}
      exit={{
        backgroundColor: "rgba(255, 255, 255, 0)",
        backdropFilter: "blur(0px)",
      }}
      transition={instant({ duration: 0.2, ease: "easeOut" })}
    >
      <motion.section
        className="max-w-[min(34rem,calc(100vw-3rem))] text-center"
        initial={{ filter: "blur(4px)", opacity: 0 }}
        animate={{
          filter: "blur(0px)",
          opacity: 1,
          transition: instant({ duration: 0.3, ease: "easeOut", delay: 0.1 }),
        }}
        exit={{
          filter: "blur(5px)",
          opacity: 0,
          transition: instant({ duration: 0.2, ease: "easeOut" }),
        }}
      >
        <h1
          id="app-info-title"
          className="text-2xl leading-tight font-semibold sm:text-3xl"
        >
          Ephemeral is a shared typing canvas.
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-700 sm:text-base sm:leading-7">
          Type and your words appear live in the space for everyone connected.
          Other people&apos;s thoughts drift in as anonymous, temporary text,
          then fade away so the room stays light, present, and unrecorded.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white/85 px-6 py-2.5 text-sm font-medium text-neutral-900 shadow-sm backdrop-blur transition hover:bg-white focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
        >
          Back
        </button>
      </motion.section>
    </motion.div>
  );
}
