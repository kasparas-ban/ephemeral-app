"use client";

import { FormEvent, RefObject, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { atom, useAtom } from "jotai";
import styles from "./styles.module.css";
import { useAnimate } from "motion/react";
import { randomInt } from "crypto";

const isCaretPlaying = atom(true);
const shownText = atom<{ char: string | null }>({ char: null });

export default function EphemeralBlock() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, setIsPlaying] = useAtom(isCaretPlaying);

  const [, setText] = useAtom(shownText);

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    // Skip if deletion
    if ((e.nativeEvent as InputEvent).data === null) return;
    if (!textRef.current || !editableRef.current) return;

    setText({ char: editableRef.current.innerText.at(-1) ?? null });

    setIsPlaying(false);
    timeoutRef.current && clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsPlaying(true), 100);
  };

  useEffect(() => {
    editableRef.current?.focus();
  }, []);

  return (
    <div className="relative flex text-xl h-[1lh]">
      <FloatingText textRef={textRef} />

      {/* Custom caret */}
      <div className="pointer-events-none h-auto">
        <Caret />
      </div>

      {/* Real editable target: present, focusable, but visually transparent */}
      <div
        ref={editableRef}
        contentEditable
        role="textbox"
        aria-label="Ephemeral input"
        spellCheck={false}
        onBlur={() => editableRef.current?.focus()}
        onInput={handleInput}
        onCompositionEnd={handleInput}
        className="relative w-0 h-full outline-none overflow-hidden
                   text-transparent caret-transparent selection:bg-transparent"
      />
    </div>
  );
}

function Caret() {
  const [isPlaying] = useAtom(isCaretPlaying);

  return (
    <div
      className={cn(
        "w-0.5 border-r-2 bg-gray-600 h-full",
        isPlaying && styles["caret"]
      )}
    />
  );
}

const CHAR_WIDTH = 12.24; // px

function FloatingText({
  textRef,
}: {
  textRef: RefObject<HTMLDivElement | null>;
}) {
  const [text] = useAtom(shownText);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (!text.char) return;

    // Create a new span for the new character
    const textSpan = document.createElement("span");
    textSpan.className = "inline-block absolute";
    textSpan.textContent = text.char ?? "";

    // Check if any chars in the DOM
    const spans = textRef.current?.querySelectorAll("span");

    spans?.forEach((span, idx) => {
      animate(
        span,
        { x: -CHAR_WIDTH * (spans.length - idx + 1) },
        { duration: 0.1, ease: "easeOut" }
      );
    });

    // Append the new character
    textRef.current?.append(textSpan);

    // Animate the new character
    animate(
      textSpan,
      { x: ["-50%", "-100%"], opacity: [0, 1] },
      { duration: 0.1, ease: "easeOut" }
    );

    const y = [randomFloat(-2, 2), randomFloat(-2, 2)];
    const rotate = [randomFloat(-2, 2), randomFloat(-2, 2)];

    // Animate the to the initial floating position
    animate(
      textSpan,
      { y: [0, y[0]], rotate: [0, rotate[0]] },
      { duration: 2, ease: "easeInOut" }
    ).then(() => {
      // Animate the floating
      animate(
        textSpan,
        { y, rotate },
        {
          duration: 2,
          ease: "easeIn",
          repeat: Infinity,
          repeatType: "mirror",
        }
      );
    });

    // Remove the new character after the animation
    // setTimeout(() => textSpan.remove(), 5000);
  }, [text]);

  return (
    <div
      ref={(node) => {
        textRef.current = node;
        // @ts-ignore
        scope.current = node;
      }}
      className="absolute pointer-events-none right-[3px] whitespace-nowrap"
    />
  );
}

const randomFloat = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};
