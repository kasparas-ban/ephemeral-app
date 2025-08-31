"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { atom, useAtom } from "jotai";
import styles from "./styles.module.css";

const isCaretPlaying = atom(true);

export default function Ephemeral() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, setIsPlaying] = useAtom(isCaretPlaying);

  const handleInput = () => {
    if (!textRef.current || !editableRef.current) return;

    textRef.current.textContent = editableRef.current.innerText;
    setIsPlaying(false);

    timeoutRef.current && clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsPlaying(true), 100);
  };

  useEffect(() => {
    editableRef.current?.focus();
  }, []);

  return (
    <div className="relative flex text-xl h-[1lh]">
      <div
        ref={textRef}
        className="absolute pointer-events-none right-0.5 whitespace-nowrap"
      />

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
      //   className={cn("w-0.5 border-r-2 bg-gray-600 h-full", styles["caret"])}
    />
  );
}
