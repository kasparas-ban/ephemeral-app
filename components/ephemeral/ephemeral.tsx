"use client";

import { useEffect, useRef } from "react";
import styles from "./styles.module.css";
import { cn } from "@/lib/utils";

export default function Ephemeral() {
  const editableRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const handleInput = () => {
    if (textRef.current && editableRef.current) {
      textRef.current.textContent = editableRef.current.innerText;
    }
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
  return (
    <div
      className={cn("w-0.5 border-r-2 bg-gray-600 h-full", styles["caret"])}
    />
  );
}
