"use client";

import { SyntheticEvent, useRef } from "react";

import { atom, useAtomValue } from "jotai";

import { actionToClientMessage, inputEventToAction } from "@/lib/typing";
import { wsClientAtom } from "@/stores/stores";

import Composition, { CompositionHandle } from "./composition";

// Mirrors the local user's text; write-only today, scoped to this module.
const localText = atom("");

/**
 * Keyboard adapter. Decodes the editable's `InputEvent`s into typing actions,
 * applies them to the Composition, and emits them to the wire.
 */
export default function LocalEphemeral() {
  const compositionRef = useRef<CompositionHandle>(null);
  const wsClient = useAtomValue(wsClientAtom);

  const applyInputEvent = (event: InputEvent) => {
    const action = inputEventToAction(event);
    if (!action) return;

    compositionRef.current?.apply(action);
    wsClient?.send(actionToClientMessage(action));
  };

  const handleInput = (e: SyntheticEvent<HTMLDivElement>) => {
    applyInputEvent(e.nativeEvent as InputEvent);
  };

  const handleBeforeInput = (event: InputEvent) => {
    if (event.cancelable) event.preventDefault();
    applyInputEvent(event);
  };

  return (
    <Composition
      ref={compositionRef}
      textAtom={localText}
      editable
      testId="local-composition"
      onBeforeInput={handleBeforeInput}
      onInput={handleInput}
    />
  );
}
