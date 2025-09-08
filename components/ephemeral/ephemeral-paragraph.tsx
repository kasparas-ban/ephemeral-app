"use client";

import { FormEvent, RefObject, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useAnimate } from "motion/react";
import styles from "./styles.module.css";

const isCaretPlayingAtom = atom(true);
const textAtom = atom<string | null>(null);

export default function EphemeralParagraph() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setIsPlaying = useSetAtom(isCaretPlayingAtom);

  const setText = useSetAtom(textAtom);

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    // Skip if deletion
    if ((e.nativeEvent as InputEvent).data === null) return;
    if (!textRef.current || !editableRef.current) return;

    setText(editableRef.current.innerText ?? null);

    setIsPlaying(false);
    timeoutRef.current && clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsPlaying(true), 100);
  };

  useEffect(() => {
    editableRef.current?.focus();
  }, []);

  return (
    <div className="relative flex text-xl h-[1lh] items-end">
      <FloatingText textRef={textRef} />

      {/* Custom caret */}
      <div className="pointer-events-none h-[26px]">
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
  const isPlaying = useAtomValue(isCaretPlayingAtom);

  return (
    <div
      className={cn(
        "w-0.5 border-r-2 bg-gray-600 h-full border-none",
        isPlaying && styles["caret"]
      )}
    />
  );
}

const CHAR_WIDTH = 12.24; // px
const SENTENCE_CHAR_COUNT = 15;

function FloatingText({
  textRef,
}: {
  textRef: RefObject<HTMLDivElement | null>;
}) {
  const text = useAtomValue(textAtom);

  return (
    <div
      ref={(node) => {
        textRef.current = node;
      }}
      className="absolute pointer-events-none right-[3px] flex justify-end flex-wrap"
      style={{ width: SENTENCE_CHAR_COUNT * CHAR_WIDTH }}
    >
      {text?.split("").map((char, idx) => (
        <span
          key={idx}
          className="inline-block shrink-0"
          style={{ width: CHAR_WIDTH }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

const randomFloat = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};
