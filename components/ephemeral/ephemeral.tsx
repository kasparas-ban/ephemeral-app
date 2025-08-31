"use client";

import { FormEvent, RefObject, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { atom, useAtom } from "jotai";
import { useAnimate } from "motion/react-mini";
import styles from "./styles.module.css";

const isCaretPlaying = atom(true);
const shownText = atom<{ char: string | null }>({ char: null });

export default function Ephemeral() {
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

function FloatingText({
  textRef,
}: {
  textRef: RefObject<HTMLDivElement | null>;
}) {
  const [text] = useAtom(shownText);

  useEffect(() => {
    if (!text.char) return;

    const textSpan = document.createElement("span");
    textSpan.className = "inline-block";
    textSpan.textContent = text.char ?? "";
    textRef.current?.append(textSpan);

    textSpan.animate(
      [
        {
          opacity: 1,
          transform: "translateX(0px) translateY(0px)",
          filter: "blur(0px)",
        },
        { opacity: 0, transform: getCharTranslation(), filter: "blur(3px)" },
      ],
      {
        duration: 5000,
        easing: "ease-in",
        fill: "forwards",
      }
    );

    setTimeout(() => textSpan.remove(), 5000);
  }, [text]);

  return (
    <div
      ref={textRef}
      className="absolute pointer-events-none right-[3px] whitespace-nowrap"
    />
  );
}

const CHAR_DISTANCE = 30;

function getCharTranslation() {
  const direction = Math.random() < 0.5 ? -1 : 1;

  return `translateX(${-CHAR_DISTANCE}px) translateY(${direction * 3}px)`;
}
