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
    <div className="relative flex">
      <div className="absolute pointer-events-none right-0">
        <div ref={textRef} className="text-xl" />
      </div>

      {/* Custom caret */}
      <div className="absolute inset-y-0 pointer-events-none h-auto">
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
        className="absolute inset-0 w-full h-10 outline-none
                   text-transparent caret-transparent selection:bg-transparent"
      />
    </div>
  );
}

function Caret() {
  return (
    <div className={cn("w-0.5 border-r-2 bg-gray-600 h-10", styles["caret"])} />
  );
}
