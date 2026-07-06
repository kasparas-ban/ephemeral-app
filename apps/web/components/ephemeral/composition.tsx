"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { Ref, SyntheticEvent } from "react";
import { PrimitiveAtom, useSetAtom } from "jotai";
import AnimatedText from "./animated-text";
import { cn } from "@/lib/utils";
import { TypingAction } from "@/lib/types";
import styles from "./styles.module.css";

const CHAR_WIDTH = 12.24; // px
const LINE_CHAR_LIMIT = 15;
const CARET_IDLE_DELAY = 100; // ms to wait after last input before blinking resumes

export type CompositionHandle = {
  apply: (action: TypingAction) => void;
};

export type CompositionProps = {
  ref?: Ref<CompositionHandle>;
  textAtom: PrimitiveAtom<string>;
  editable?: boolean;
  onInput?: (e: SyntheticEvent<HTMLDivElement>) => void;
  testId?: string;
  textClassName?: string;
  caretClassName?: string;
};

export default function Composition({
  ref,
  textAtom,
  editable = false,
  onInput,
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
    }),
    [setText]
  );

  useEffect(() => {
    if (editable) editableRef.current?.focus();

    if (!textContainerRef.current) return;

    animatorRef.current = new AnimatedText(textContainerRef.current, {
      charWidth: CHAR_WIDTH,
      lineCharLimit: LINE_CHAR_LIMIT,
    });

    return () => {
      animatorRef.current = null;
    };
  }, [editable]);

  return (
    <div className="relative flex text-xl h-lh" data-testid={testId}>
      <div
        ref={textContainerRef}
        data-testid={testId ? `${testId}-text` : "composition-text"}
        className={cn(
          "absolute pointer-events-none right-[3px] whitespace-nowrap",
          textClassName
        )}
      />

      {/* Custom caret */}
      <div className="pointer-events-none h-auto">
        <div
          ref={caretRef}
          className={cn(
            "w-0.5 border-r-2 bg-gray-600 h-full border-none",
            caretClassName,
            styles["caret"]
          )}
        />
        <div className="absolute inset-0 w-8 bg-white left-0.5" />
      </div>

      {/* Real editable target: present, focusable, but visually transparent */}
      <div
        ref={editableRef}
        contentEditable={editable}
        role={editable ? "textbox" : undefined}
        aria-label={editable ? "Invisible input" : undefined}
        spellCheck={false}
        onBlur={editable ? () => editableRef.current?.focus() : undefined}
        onInput={editable ? onInput : undefined}
        onCompositionEnd={editable ? onInput : undefined}
        className="relative w-0 h-full outline-none overflow-hidden text-transparent caret-transparent selection:bg-transparent"
      />
    </div>
  );
}
