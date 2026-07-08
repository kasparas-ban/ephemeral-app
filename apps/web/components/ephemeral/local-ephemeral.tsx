"use client";

import type { KeyboardEvent, SyntheticEvent } from "react";
import { useEffect, useRef } from "react";

import { atom, useAtomValue } from "jotai";

import type { TypingAction } from "@/lib/types";
import { actionToClientMessage, inputEventToAction } from "@/lib/typing";
import { wsClientAtom } from "@/stores/stores";
import { hasOnScreenKeyboardAtom, isKeyboardOpenAtom } from "@/stores/viewport";

import Composition, { type CompositionHandle } from "./composition";

// Mirrors the local user's text; write-only today, scoped to this module.
const localText = atom("");

export default function LocalEphemeral() {
  const compositionRef = useRef<CompositionHandle>(null);
  const lastAcceptedActionRef = useRef<TypingAction | null>(null);
  const hasOnScreenKeyboard = useAtomValue(hasOnScreenKeyboardAtom);
  const isKeyboardOpen = useAtomValue(isKeyboardOpenAtom);
  const wsClient = useAtomValue(wsClientAtom);
  const showStartTypingButton = hasOnScreenKeyboard && !isKeyboardOpen;

  const applyAction = (action: TypingAction) => {
    lastAcceptedActionRef.current = action;
    compositionRef.current?.apply(action);
    wsClient?.send(actionToClientMessage(action));
  };

  const applyInputEvent = (event: InputEvent) => {
    const action = inputEventToAction(event);
    if (!action) return;
    if (
      hasOnScreenKeyboard &&
      shouldSuppressMobileSpaceInput(action, lastAcceptedActionRef.current)
    ) {
      return;
    }

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
        autoFocus={!hasOnScreenKeyboard}
        keepFocus={!hasOnScreenKeyboard}
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
          className="absolute top-[calc(100%+0.75rem)] left-1/2 -translate-x-1/2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-neutral-900 shadow-sm transition active:scale-95"
        >
          Start typing
        </button>
      )}
    </div>
  );
}

function shouldSuppressMobileSpaceInput(
  action: TypingAction,
  lastAcceptedAction: TypingAction | null,
) {
  if (action.kind !== "char") return false;
  if (!lastActionWasSpace(lastAcceptedAction)) return false;

  if (startsWithSpace(action.char)) return true;

  return action.char === "." || action.char === ". ";
}

function startsWithSpace(value: string) {
  return value.startsWith(" ") || value.startsWith("\u00a0");
}

function lastActionWasSpace(action: TypingAction | null) {
  return action?.kind === "char" && startsWithSpace(action.char);
}
