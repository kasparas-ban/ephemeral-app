"use client";

import { motion, type Transition, useReducedMotion } from "motion/react";

export default function InfoOverlay() {
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
      </motion.section>
    </motion.div>
  );
}
