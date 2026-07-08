"use client";

import { useEffect, useMemo, useRef } from "react";

import { atom, useAtomValue } from "jotai";

import { serverMessageToAction } from "@/lib/typing";
import { wsClientAtom } from "@/stores/stores";

import Composition, { CompositionHandle } from "./composition";

/**
 * Remote adapter. Subscribes to the socket and decodes the messages for one
 * `userId` into typing actions, replaying them onto a read-only Composition.
 */
export default function RemoteEphemeral({ userId }: { userId: string }) {
  const textAtom = useMemo(() => atom(""), []);
  const compositionRef = useRef<CompositionHandle>(null);
  const wsClient = useAtomValue(wsClientAtom);

  useEffect(() => {
    if (!wsClient) return;
    return wsClient.onMessage((msg) => {
      const action = serverMessageToAction(msg, userId);
      if (action) compositionRef.current?.apply(action);
    });
  }, [wsClient, userId]);

  return (
    <Composition
      ref={compositionRef}
      textAtom={textAtom}
      textClassName="text-gray-500"
      caretClassName="bg-gray-400"
      testId="remote-composition"
    />
  );
}
