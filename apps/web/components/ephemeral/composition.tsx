"use client";

import type {
  CompositionEvent,
  FocusEvent,
  FormEvent,
  KeyboardEvent,
  Ref,
} from "react";
import { useEffect, useImperativeHandle, useRef } from "react";

import { TypingAction } from "@/lib/types";

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
  editable?: boolean;
  autoFocus?: boolean;
  keepFocus?: boolean;
  onBeforeInput?: (e: InputEvent) => void;
  onCompositionUpdate?: (text: string) => void;
  onCompositionEnd?: (text: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  testId?: string;
  textClassName?: string;
  caretClassName?: string;
};

export default function Composition({
  ref,
  editable = false,
  autoFocus = editable,
  keepFocus = editable,
  onBeforeInput,
  onCompositionUpdate,
  onCompositionEnd,
  onKeyDown,
  testId,
  textClassName = "",
  caretClassName = "bg-gray-600",
}: CompositionProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<AnimatedText | null>(null);

  const caretRef = useRef<HTMLDivElement>(null);
  const caretAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // The single place an action becomes a visible effect.
  useImperativeHandle(
    ref,
    () => ({
      apply(action: TypingAction) {
        const animator = animatorRef.current;
        if (!animator) return;

        switch (action.kind) {
          case "char":
            animator.addChar(action.char);
            break;
          case "back":
            animator.deleteChar();
            break;
          case "clear":
            animator.blurAll();
            break;
        }

        // Hold the caret steady while typing; blinking resumes when idle.
        const caret = caretRef.current;
        if (!caret) return;
        caret.classList.add(styles.caretTyping);
        if (caretAnimationTimeoutRef.current) {
          clearTimeout(caretAnimationTimeoutRef.current);
        }
        caretAnimationTimeoutRef.current = setTimeout(() => {
          caret.classList.remove(styles.caretTyping);
        }, CARET_IDLE_DELAY);
      },
      blur() {
        editableRef.current?.blur();
      },
      focus() {
        if (editable) focusWithoutScrolling(editableRef.current);
      },
    }),
    [editable],
  );

  useEffect(() => {
    if (autoFocus && editable) focusWithoutScrolling(editableRef.current);
  }, [autoFocus, editable]);

  // Typing with nothing focused, e.g. after clicking empty space or closing
  // the info screen, goes to the Composition.
  useEffect(() => {
    if (!editable || !keepFocus) return;

    const handleKeyDown = () => {
      if (document.activeElement === document.body) {
        focusWithoutScrolling(editableRef.current);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editable, keepFocus]);

  // Keep focus unless it moved to another control, so Tab still works.
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.relatedTarget) focusWithoutScrolling(e.currentTarget);
  };

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

  // Composition text can't be prevented, so clear it once it has been read;
  // leftover text would let the keyboard re-compose earlier words.
  const clearEditable = (e: FormEvent<HTMLDivElement>) => {
    if ((e.nativeEvent as InputEvent).isComposing) return;
    e.currentTarget.textContent = "";
  };

  const handleCompositionEnd = (e: CompositionEvent<HTMLDivElement>) => {
    onCompositionEnd?.(e.data);
    e.currentTarget.textContent = "";
  };

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
        // Letters are animated one span at a time, which screen readers
        // would spell out; the textbox carries the accessible name instead.
        aria-hidden="true"
        data-testid={testId ? `${testId}-text` : "composition-text"}
        className={`pointer-events-none absolute right-[3px] whitespace-nowrap ${textClassName}`}
      />

      {/* Custom caret */}
      <div aria-hidden="true" className="pointer-events-none h-auto">
        <div
          ref={caretRef}
          className={`h-full w-0.5 ${caretClassName} ${styles.caret}`}
        />
        <div className="absolute inset-0 left-0.5 w-8 bg-white" />
      </div>

      {/* Real editable target: present, focusable, but visually transparent */}
      <div
        ref={editableRef}
        contentEditable={editable}
        role={editable ? "textbox" : undefined}
        aria-label={editable ? "Type to everyone" : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="done"
        inputMode="text"
        spellCheck={false}
        onBlur={editable && keepFocus ? handleBlur : undefined}
        onInput={editable ? clearEditable : undefined}
        onCompositionUpdate={
          editable ? (e) => onCompositionUpdate?.(e.data) : undefined
        }
        onCompositionEnd={editable ? handleCompositionEnd : undefined}
        onKeyDown={editable ? onKeyDown : undefined}
        className="relative h-full w-0 overflow-hidden text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  );
}

function focusWithoutScrolling(element: HTMLElement | null) {
  if (!element || document.activeElement === element) return;
  element.focus({ preventScroll: true });
}
