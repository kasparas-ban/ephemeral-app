"use client";

import { FormEvent, useEffect, useRef } from "react";
import { atom, useSetAtom } from "jotai";
import AnimatedText from "./animated-text-new";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";

const text = atom("");

const CHAR_WIDTH = 12.24; // px
const LINE_CHAR_LIMIT = 15;

export default function EphemeralClass() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<AnimatedText | null>(null);

  const caretRef = useRef<HTMLDivElement>(null);
  const caretAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setText = useSetAtom(text);

  const pauseCaretAnimation = () => {
    if (!caretRef.current) return;

    caretRef.current.style.animationPlayState = "paused";
    caretRef.current.style.opacity = "1";

    if (caretAnimationTimeoutRef.current) {
      clearTimeout(caretAnimationTimeoutRef.current);
    }

    caretAnimationTimeoutRef.current = setTimeout(() => {
      if (caretRef.current) {
        caretRef.current.style.animationPlayState = "running";
      }
    }, 100);
  };

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    if (!animatorRef.current) return;

    const inputEvent = e.nativeEvent as InputEvent;
    const char = inputEvent.data;

    if (inputEvent.inputType === "deleteContentBackward") {
      animatorRef.current.deleteChar();

      pauseCaretAnimation();
      return;
    }

    if (char === null) return;

    setText((prev) => prev + char);
    animatorRef.current.addChar(char);

    pauseCaretAnimation();
  };

  useEffect(() => {
    editableRef.current?.focus();

    if (!textContainerRef.current) return;

    animatorRef.current = new AnimatedText(textContainerRef.current, {
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
      animatorRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex text-xl h-[1lh]">
      <div
        ref={textContainerRef}
        className="absolute pointer-events-none right-[3px] whitespace-nowrap"
      />

      {/* Custom caret */}
      <div className="pointer-events-none h-auto">
        <div
          className={cn(
            "w-0.5 border-r-2 bg-gray-600 h-full border-none",
            styles["caret"]
          )}
        />
        <div className="absolute inset-0 w-8 bg-white left-0.5" />
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
