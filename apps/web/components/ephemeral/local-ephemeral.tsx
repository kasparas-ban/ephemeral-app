"use client";

import type { KeyboardEvent, SyntheticEvent } from "react";
import { useEffect, useRef } from "react";

import { atom, useAtomValue } from "jotai";

import type { TypingAction } from "@/lib/types";
import { actionToClientMessage, inputEventToAction } from "@/lib/typing";
import { wsClientAtom } from "@/stores/stores";

import Composition, { type CompositionHandle } from "./composition";

// Mirrors the local user's text; write-only today, scoped to this module.
const localText = atom("");

/**
 * Keyboard adapter. Decodes the editable's `InputEvent`s into typing actions,
 * applies them to the Composition, and emits them to the wire.
 */
type LocalEphemeralProps = {
  manualKeyboardActivation?: boolean;
  showStartTypingButton?: boolean;
};

export default function LocalEphemeral({
  manualKeyboardActivation = false,
  showStartTypingButton = false,
}: LocalEphemeralProps) {
  const compositionRef = useRef<CompositionHandle>(null);
  const wsClient = useAtomValue(wsClientAtom);

  const applyAction = (action: TypingAction) => {
    compositionRef.current?.apply(action);
    wsClient?.send(actionToClientMessage(action));
  };

  const applyInputEvent = (event: InputEvent) => {
    const action = inputEventToAction(event);
    if (!action) return;

    applyAction(action);
  };

  const handleInput = (e: SyntheticEvent<HTMLDivElement>) => {
    applyInputEvent(e.nativeEvent as InputEvent);
  };

  const handleBeforeInput = (event: InputEvent) => {
    if (event.cancelable) event.preventDefault();
    applyInputEvent(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      applyAction({ kind: "back" });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      applyAction({ kind: "clear" });
    }
  };

  useEffect(() => {
    if (showStartTypingButton) compositionRef.current?.blur();
  }, [showStartTypingButton]);

  return (
    <div className="relative inline-flex">
      <Composition
        ref={compositionRef}
        textAtom={localText}
        editable
        autoFocus={!manualKeyboardActivation}
        keepFocus={!manualKeyboardActivation}
        testId="local-composition"
        onBeforeInput={handleBeforeInput}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />

      {showStartTypingButton && (
        <button
          type="button"
          data-testid="local-composition-start-typing"
          onClick={() => compositionRef.current?.focus()}
          className="absolute left-1/2 top-[calc(100%+0.75rem)] -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 shadow-sm transition active:scale-95"
        >
          Start typing
        </button>
      )}
    </div>
  );
}
