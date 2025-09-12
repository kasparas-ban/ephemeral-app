"use client";

import { FormEvent, RefObject, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useAnimate } from "motion/react";
import styles from "./styles.module.css";

const isCaretPlayingAtom = atom(true);
const lastCharAtom = atom<{ val: string | null }>({ val: null });

export default function EphemeralBlock() {
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
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const currentLine = useRef(0);

  useEffect(() => {
    if (!lastChar) return;

    const lineChars = textRef.current?.querySelectorAll(
      `span[data-char-line="${currentLine.current}"]`
    );

    const isNewLine = lineChars ? lineChars.length > LINE_CHAR_LIMIT : false;
    const isWhitespace = lastChar.val ? /\s/.test(lastChar.val) : false;

    if (isNewLine && isWhitespace) {
      // Create new line
      const lineWords = textRef.current?.querySelectorAll(
        `span[data-word-line="${currentLine.current}"]`
      );
      const lineSpan = document.createElement("span");
      lineSpan.className = "block absolute will-change-transform";
      lineSpan.setAttribute("data-line", currentLine.current.toString());
      lineSpan.append(...(lineWords ? Array.from(lineWords) : []));
      textRef.current?.append(lineSpan);

      // Move all words in previous lines up
      for (let line = 0; line <= currentLine.current; line++) {
        const lineSpan = textRef.current?.querySelector(
          `span[data-line="${line}"]`
        );

        if (!lineSpan) continue;

        animate(
          lineSpan,
          { y: -30 * (currentLine.current - line + 1) },
          { duration: 0.25, ease: "easeOut" }
        );
      }

      currentLine.current += 1;
    } else {
      // Animate existing line characters
      lineChars?.forEach((span, idx) => {
        animate(
          span,
          { x: -CHAR_WIDTH * (lineChars.length - idx + 1) },
          { duration: 0.1, ease: "easeOut" }
        );
      });
    }

    // Create a new span for the new character
    const charSpan = document.createElement("span");
    charSpan.className = "block absolute will-change-transform";
    charSpan.textContent = lastChar.val ?? "";
    charSpan.setAttribute("data-kind", "char");
    charSpan.setAttribute("data-char-line", currentLine.current.toString());

    // Append to a word wrapper when the char is not whitespace.
    // For whitespace, append directly to the container and start a new word next time.
    const container = textRef.current;
    if (!container) return;

    if (isWhitespace) {
      if (!isNewLine) container.append(charSpan);

      // Animate last word
      const lastWord = container.children[container.children.length - 2];
      if (lastWord && lastWord.getAttribute("data-kind") === "word") {
        const y = [randomFloat(-3, 3), randomFloat(-3, 3)];

        animate(
          lastWord,
          { y: [0, y[0]] },
          { duration: 2, ease: "easeInOut" }
        ).then(() => {
          animate(
            lastWord,
            { y },
            {
              duration: 2,
              ease: "easeIn",
              repeat: Infinity,
              repeatType: "mirror",
            }
          );
        });
      }
    } else {
      const last = container.lastElementChild as HTMLElement | null;
      let wordWrapper: HTMLElement | null =
        last && last.getAttribute("data-kind") === "word" ? last : null;

      if (!wordWrapper) {
        wordWrapper = document.createElement("span");
        wordWrapper.className = "block absolute will-change-transform";
        wordWrapper.setAttribute("data-kind", "word");
        wordWrapper.setAttribute(
          "data-word-line",
          currentLine.current.toString()
        );
        container.append(wordWrapper);
      }

      wordWrapper.append(charSpan);

      // Animate the new character
      animate(
        charSpan,
        { x: ["-50%", "-100%"], opacity: [0, 1] },
        { duration: 0.1, ease: "easeOut" }
      );

      const y = [randomFloat(-1, 1), randomFloat(-1, 1)];
      const rotate = [randomFloat(-2, 2), randomFloat(-2, 2)];

      // Animate char to the initial floating position
      animate(
        charSpan,
        { y: [0, y[0]], rotate: [0, rotate[0]] },
        { duration: 2, ease: "easeInOut" }
      ).then(() => {
        // Animate floating char
        animate(
          charSpan,
          { y, rotate },
          {
            duration: 2,
            ease: "easeIn",
            repeat: Infinity,
            repeatType: "mirror",
          }
        );
      });
    }

    // Remove the new character after the animation
    // setTimeout(() => textSpan.remove(), 5000);
  }, [lastChar]);

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
