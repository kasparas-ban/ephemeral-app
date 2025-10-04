"use client";

import { FormEvent, useEffect, useRef } from "react";
import { atom, useSetAtom } from "jotai";
import AnimatedText from "./animated-text";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";

const text = atom("");

const CHAR_WIDTH = 12.24; // px
const LINE_CHAR_LIMIT = 15;
const CARET_IDLE_DELAY = 100; // ms to wait after last input before blinking resumes

export default function Ephemeral() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<AnimatedText | null>(null);

  const caretRef = useRef<HTMLDivElement>(null);
  const caretAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setText = useSetAtom(text);

  const showCaretWhileTyping = () => {
    if (!caretRef.current) return;

    caretRef.current.classList.add(styles.caretTyping);

    if (caretAnimationTimeoutRef.current) {
      clearTimeout(caretAnimationTimeoutRef.current);
    }

    caretAnimationTimeoutRef.current = setTimeout(() => {
      if (!caretRef.current) return;
      caretRef.current.classList.remove(styles.caretTyping);
    }, CARET_IDLE_DELAY);
  };

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    if (!animatorRef.current) return;

    const inputEvent = e.nativeEvent as InputEvent;
    const char = inputEvent.data;

    if (inputEvent.inputType === "deleteContentBackward") {
      animatorRef.current.deleteChar();
      showCaretWhileTyping();
      return;
    }

    if (char === null) return;

    setText((prev) => prev + char);
    animatorRef.current.addChar(char);

    showCaretWhileTyping();
  };

  useEffect(() => {
    editableRef.current?.focus();

    if (!textContainerRef.current) return;

    animatorRef.current = new AnimatedText(textContainerRef.current, {
      charWidth: CHAR_WIDTH,
      lineCharLimit: LINE_CHAR_LIMIT,
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
          ref={caretRef}
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
