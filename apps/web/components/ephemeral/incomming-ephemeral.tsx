"use client";

import { FormEvent, useCallback, useEffect, useRef } from "react";
import { PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import { wsClientAtom } from "@/stores/stores";
import { TypingBack, TypingClear, TypingUpdate } from "@/lib/types";
import AnimatedText from "./animated-text";
import styles from "./styles.module.css";

const CHAR_WIDTH = 12.24; // px
const LINE_CHAR_LIMIT = 15;
const CARET_IDLE_DELAY = 100; // ms to wait after last input before blinking resumes

export default function IncommingEphemeral({
  textAtom,
  userId,
}: {
  textAtom: PrimitiveAtom<string>;
  userId: string;
}) {
  const editableRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<AnimatedText | null>(null);

  const caretRef = useRef<HTMLDivElement>(null);
  const caretAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const wsClient = useAtomValue(wsClientAtom);
  const setText = useSetAtom(textAtom);

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

  // Single place to apply actions so both local inputs and WS messages use the same logic
  const applyTypingUpdate = useCallback(
    ({ char }: TypingUpdate) => {
      if (!animatorRef.current || char == null) return;
      setText((prev: string) => prev + char);
      animatorRef.current.addChar(char);
      showCaretWhileTyping();
    },
    [setText]
  );

  const applyTypingClear = useCallback(
    (_: TypingClear) => {
      if (!animatorRef.current) return;
      animatorRef.current.blurAll();
      setText("");
      showCaretWhileTyping();
    },
    [setText]
  );

  const applyTypingBack = useCallback((_: TypingBack) => {
    if (!animatorRef.current) return;
    animatorRef.current.deleteChar();
    showCaretWhileTyping();
  }, []);

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    if (!animatorRef.current) return;

    const inputEvent = e.nativeEvent as InputEvent;
    const char = inputEvent.data;

    // Handle Enter (paragraph insertion)
    if (inputEvent.inputType === "insertParagraph") {
      applyTypingClear({ userId: "" });
      return;
    }

    if (inputEvent.inputType === "deleteContentBackward") {
      applyTypingBack({ userId: "" });
      return;
    }

    if (char === null) return;

    applyTypingUpdate({ userId: "", char });
  };

  useEffect(() => {
    // editableRef.current?.focus();

    if (!textContainerRef.current) return;

    animatorRef.current = new AnimatedText(textContainerRef.current, {
      charWidth: CHAR_WIDTH,
      lineCharLimit: LINE_CHAR_LIMIT,
    });

    return () => {
      animatorRef.current = null;
    };
  }, []);

  // Subscribe to WS messages and map them to the same actions
  useEffect(() => {
    if (!wsClient) return;
    const filteredUpdate = (t: TypingUpdate) => {
      if (t.userId !== userId) return;
      applyTypingUpdate(t);
    };
    const filteredClear = (t: TypingClear) => {
      if (t.userId !== userId) return;
      applyTypingClear(t);
    };
    const filteredBack = (t: TypingBack) => {
      if (t.userId !== userId) return;
      applyTypingBack(t);
    };
    const unsubscribe = wsClient.setHandlers(
      filteredUpdate,
      filteredClear,
      filteredBack
    );
    return unsubscribe;
  }, [wsClient, userId, applyTypingUpdate, applyTypingClear, applyTypingBack]);

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
        // onBlur={() => editableRef.current?.focus()}
        onInput={handleInput}
        onCompositionEnd={handleInput}
        className="relative w-0 h-full outline-none overflow-hidden
                   text-transparent caret-transparent selection:bg-transparent"
      />
    </div>
  );
}
