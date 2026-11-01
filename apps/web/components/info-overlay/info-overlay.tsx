"use client";

import { motion, type Transition, useReducedMotion } from "motion/react";

import useKeyboardStableHeight from "@/hooks/useKeyboardStableHeight";

import DepthTitle from "./depth-title";
import StrangerPhrases from "./stranger-phrases";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export default function InfoOverlay({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const contentHeight = useKeyboardStableHeight();
  const instant = (transition: Transition) =>
    reduceMotion ? { duration: 0 } : transition;
  const stagger = (delay: number, duration = 0.6) =>
    instant({ delay, duration, ease: EASE_OUT });

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-info-title"
      className="fixed inset-0 z-30 overflow-hidden text-neutral-950"
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
      <motion.div
        className="absolute inset-x-0 top-0 grid place-items-center px-6"
        style={{ height: contentHeight }}
        exit={{
          filter: "blur(5px)",
          opacity: 0,
          transition: instant({ duration: 0.2, ease: "easeOut" }),
        }}
      >
        {!reduceMotion && <StrangerPhrases />}
        <section className="relative flex flex-col items-center text-center">
          <motion.h1
            id="app-info-title"
            aria-label="Ephemeral"
            className="relative text-[clamp(3.25rem,15vw,9rem)] leading-none font-bold tracking-[-0.06em]"
            initial={{ opacity: 0, scale: 0.94, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={stagger(0.1, 1.4)}
          >
            <DepthTitle word="ephemeral" />
          </motion.h1>
          <motion.p
            className="mt-8 max-w-[20rem] text-sm leading-6 text-neutral-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={stagger(0.6)}
          >
            words drift in from strangers, then they&apos;re gone.
          </motion.p>
          <motion.div
            className="mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={stagger(0.85)}
          >
            <button
              type="button"
              onClick={onClose}
              className="group relative text-xs tracking-[0.25em] text-neutral-400 uppercase transition-colors hover:text-neutral-950 focus-visible:text-neutral-950 focus-visible:outline-none"
            >
              Back
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-current transition-[width] duration-300 ease-out group-hover:w-full group-focus-visible:w-full" />
            </button>
          </motion.div>
        </section>
      </motion.div>
    </motion.div>
  );
}
