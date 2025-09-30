"use client";

import { FormEvent, RefObject, useEffect, useRef } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import AnimatedText from "./animated-text";
import styles from "./styles.module.css";

const isCaretPlayingAtom = atom(true);
const lastCharAtom = atom<{ val: string | null }>({ val: null });

export default function EphemeralClass() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const carretAnimTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setIsPlaying = useSetAtom(isCaretPlayingAtom);

  const setText = useSetAtom(lastCharAtom);

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    // Skip if deletion
    if ((e.nativeEvent as InputEvent).data === null) return;
    if (!textRef.current || !editableRef.current) return;

    setText({ val: editableRef.current.innerText.at(-1) ?? null });

    setIsPlaying(false);
    carretAnimTimeoutRef.current && clearTimeout(carretAnimTimeoutRef.current);
    carretAnimTimeoutRef.current = setTimeout(() => setIsPlaying(true), 100);
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
        aria-label="Invisible input"
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
const LINE_CHAR_LIMIT = 15;

function FloatingText({
  textRef,
}: {
  textRef: RefObject<HTMLDivElement | null>;
}) {
  const lastChar = useAtomValue(lastCharAtom);
  const animatorRef = useRef<AnimatedText | null>(null);

  // Initialize AnimatedText on mount and when ref node changes
  useEffect(() => {
    if (!textRef.current) return;
    animatorRef.current = new AnimatedText(textRef.current, {
      charWidth: CHAR_WIDTH,
      lineCharLimit: LINE_CHAR_LIMIT,
      lineStepY: 30,
      charShiftDuration: 100,
      lineMoveDuration: 250,
      charIntroDuration: 100,
      floatInitDuration: 2000,
      floatLoopDuration: 3000,
    });

    return () => {
      animatorRef.current?.clear();
      animatorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textRef.current]);

  // Send the new character to the animator
  useEffect(() => {
    if (!lastChar) return;
    animatorRef.current?.addChar(lastChar.val);
  }, [lastChar]);

  return (
    <div
      ref={(node) => {
        textRef.current = node;
      }}
      className="absolute pointer-events-none right-[3px] whitespace-nowrap"
    />
  );
}
