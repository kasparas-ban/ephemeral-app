"use client";

import { useEffect, useState } from "react";

import { motion } from "motion/react";

const PHRASES = [
  "is anyone here?",
  "i miss the sea",
  "good night",
  "stay a little longer",
  "hello?",
  "don't forget to breathe",
  "can't sleep",
  "no one will remember",
  "who are you?",
  "i'm thinking of you",
  "let it go",
  "i'm still here",
  "say something",
  "this will pass",
];

const ZONES = [
  { x: [3, 32], y: [5, 18] },
  { x: [50, 72], y: [8, 22] },
  { x: [8, 58], y: [26, 33] },
  { x: [14, 60], y: [66, 73] },
  { x: [3, 32], y: [78, 88] },
  { x: [48, 72], y: [80, 90] },
];

const between = ([min, max]: number[]) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

type Phrase = {
  text: string;
  x: number;
  y: number;
  blur: number;
  opacity: number;
};

type ShownPhrases = Map<number, string>;

export default function StrangerPhrases() {
  const [shown] = useState<ShownPhrases>(() => new Map());

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {ZONES.map((_, i) => (
        <TypingPhrase key={i} zoneIndex={i} shown={shown} />
      ))}
    </div>
  );
}

function pickUnshownPhrase(zoneIndex: number, shown: ShownPhrases) {
  const taken = new Set(
    [...shown].filter(([i]) => i !== zoneIndex).map(([, text]) => text),
  );
  return pick(PHRASES.filter((p) => !taken.has(p)));
}

function createPhrase(zoneIndex: number, text: string): Phrase {
  const zone = ZONES[zoneIndex];
  return {
    text,
    x: between(zone.x),
    y: between(zone.y),
    blur: between([0.5, 3.5]),
    opacity: between([0.18, 0.45]),
  };
}

function TypingPhrase({
  zoneIndex,
  shown,
}: {
  zoneIndex: number;
  shown: ShownPhrases;
}) {
  // Fixed, not random: StrictMode runs initializers twice, which caused duplicates.
  const [phrase, setPhrase] = useState(() =>
    createPhrase(zoneIndex, PHRASES[zoneIndex * 2]),
  );
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<
    "waiting" | "typing" | "holding" | "fading"
  >("waiting");

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    if (phase === "waiting") {
      id = setTimeout(
        () => setPhase("typing"),
        between([300, 2500]) + zoneIndex * 250,
      );
    } else if (phase === "typing") {
      id =
        count < phrase.text.length
          ? setTimeout(() => setCount((c) => c + 1), between([60, 140]))
          : setTimeout(() => setPhase("holding"), 0);
    } else if (phase === "holding") {
      id = setTimeout(() => setPhase("fading"), between([1200, 3200]));
    }
    return () => clearTimeout(id);
  }, [count, phrase.text.length, phase, zoneIndex]);

  useEffect(() => {
    shown.set(zoneIndex, phrase.text);
  }, [phrase.text, shown, zoneIndex]);

  const restart = () => {
    setPhrase(createPhrase(zoneIndex, pickUnshownPhrase(zoneIndex, shown)));
    setCount(0);
    setPhase("waiting");
  };

  return (
    <motion.span
      className="absolute text-sm whitespace-nowrap sm:text-base"
      style={{ left: `${phrase.x}%`, top: `${phrase.y}%` }}
      initial={false}
      animate={
        phase === "fading"
          ? { opacity: 0, filter: `blur(${phrase.blur + 6}px)`, y: -6 }
          : {
              opacity: phase === "waiting" ? 0 : phrase.opacity,
              filter: `blur(${phrase.blur}px)`,
              y: 0,
            }
      }
      transition={{ duration: phase === "fading" ? 1.4 : 0.2, ease: "easeOut" }}
      onAnimationComplete={() => {
        if (phase === "fading") restart();
      }}
    >
      {phrase.text.slice(0, count)}
      {phase === "typing" && (
        <span className="ml-px inline-block h-[1em] w-px translate-y-[0.15em] bg-current" />
      )}
    </motion.span>
  );
}
