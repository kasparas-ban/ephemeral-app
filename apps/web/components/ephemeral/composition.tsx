"use client";

import type { KeyboardEvent, Ref, SyntheticEvent } from "react";
import { useCallback, useEffect, useImperativeHandle, useRef } from "react";

import { PrimitiveAtom, useSetAtom } from "jotai";

import { TypingAction } from "@/lib/types";
import { cn } from "@/lib/utils";

import AnimatedText from "./animated-text";

import styles from "./styles.module.css";

const CHAR_WIDTH = 12.24; // px
const LINE_CHAR_LIMIT = 15;
const CARET_IDLE_DELAY = 100; // ms to wait after last input before blinking resumes

export type CompositionHandle = {
  apply: (action: TypingAction) => void;
  blur: () => void;
  focus: () => void;
};

export type CompositionProps = {
  ref?: Ref<CompositionHandle>;
  textAtom: PrimitiveAtom<string>;
  editable?: boolean;
  autoFocus?: boolean;
  keepFocus?: boolean;
  onBeforeInput?: (e: InputEvent) => void;
  onInput?: (e: SyntheticEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  testId?: string;
  textClassName?: string;
  caretClassName?: string;
};

export default function Composition({
  ref,
  textAtom,
  editable = false,
  autoFocus = editable,
  keepFocus = editable,
  onBeforeInput,
  onInput,
  onKeyDown,
  testId,
  textClassName,
  caretClassName,
}: CompositionProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<AnimatedText | null>(null);

  const caretRef = useRef<HTMLDivElement>(null);
  const caretAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setText = useSetAtom(textAtom);

  const showCaretWhileTyping = useCallback(() => {
    if (!caretRef.current) return;

    caretRef.current.classList.add(styles.caretTyping);

    if (caretAnimationTimeoutRef.current) {
      clearTimeout(caretAnimationTimeoutRef.current);
    }

    caretAnimationTimeoutRef.current = setTimeout(() => {
      if (!caretRef.current) return;
      caretRef.current.classList.remove(styles.caretTyping);
    }, CARET_IDLE_DELAY);
  }, []);

  const focusEditable = useCallback(() => {
    const editableEl = editableRef.current;
    if (!editable || !editableEl) return;
    if (document.activeElement === editableEl) return;

    editableEl.focus({ preventScroll: true });
  }, [editable]);

  // The single place an action becomes a visible effect.
  useImperativeHandle(
    ref,
    () => ({
      apply(action: TypingAction) {
        const animator = animatorRef.current;
        if (!animator) return;

        switch (action.kind) {
          case "char":
            setText((prev) => prev + action.char);
            animator.addChar(action.char);
            break;
          case "back":
            animator.deleteChar();
            break;
          case "clear":
            animator.blurAll();
            setText("");
            break;
        }

        showCaretWhileTyping();
      },
      blur() {
        editableRef.current?.blur();
      },
      focus: focusEditable,
    }),
    [focusEditable, setText, showCaretWhileTyping],
  );

  useEffect(() => {
    if (autoFocus) focusEditable();
  }, [autoFocus, focusEditable]);

  useEffect(() => {
    if (!textContainerRef.current) return;

    animatorRef.current = new AnimatedText(textContainerRef.current, {
      charWidth: CHAR_WIDTH,
      lineCharLimit: LINE_CHAR_LIMIT,
    });

    return () => {
      animatorRef.current = null;
    };
  }, []);

  // Required to make char deletion work on mobile
  useEffect(() => {
    const editableEl = editableRef.current;
    if (!editable || !editableEl || !onBeforeInput) return;

    const handleBeforeInput = (event: Event) => {
      onBeforeInput(event as InputEvent);
    };

    editableEl.addEventListener("beforeinput", handleBeforeInput);
    return () => {
      editableEl.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [editable, onBeforeInput]);

  return (
    <div className="relative flex h-lh text-xl" data-testid={testId}>
      <div
        ref={textContainerRef}
        data-testid={testId ? `${testId}-text` : "composition-text"}
        className={cn(
          "pointer-events-none absolute right-[3px] whitespace-nowrap",
          textClassName,
        )}
      />

      {/* Custom caret */}
      <div className="pointer-events-none h-auto">
        <div
          ref={caretRef}
          className={cn(
            "h-full w-0.5 border-r-2 border-none bg-gray-600",
            caretClassName,
            styles["caret"],
          )}
        />
        <div className="absolute inset-0 left-0.5 w-8 bg-white" />
      </div>

      {/* Real editable target: present, focusable, but visually transparent */}
      <div
        ref={editableRef}
        contentEditable={editable}
        role={editable ? "textbox" : undefined}
        aria-label={editable ? "Invisible input" : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="done"
        inputMode="text"
        spellCheck={false}
        onBlur={editable && keepFocus ? focusEditable : undefined}
        onInput={editable ? onInput : undefined}
        onCompositionEnd={editable ? onInput : undefined}
        onKeyDown={editable ? onKeyDown : undefined}
        className="relative h-full w-0 overflow-hidden text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  );
}
