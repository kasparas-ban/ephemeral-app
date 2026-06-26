"use client";

import { FormEvent, useRef } from "react";
import { atom, useAtomValue } from "jotai";
import { wsClientAtom } from "@/stores/stores";
import { actionToClientMessage, inputEventToAction } from "@/lib/typing";
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

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    const action = inputEventToAction(e.nativeEvent as InputEvent);
    if (!action) return;

    compositionRef.current?.apply(action);
    wsClient?.send(actionToClientMessage(action));
  };

  return (
    <Composition
      ref={compositionRef}
      textAtom={localText}
      editable
      onInput={handleInput}
    />
  );
}
