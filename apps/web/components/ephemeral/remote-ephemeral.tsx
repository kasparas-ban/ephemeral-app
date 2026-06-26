"use client";

import { useEffect, useRef } from "react";
import { PrimitiveAtom, useAtomValue } from "jotai";
import { wsClientAtom } from "@/stores/stores";
import { serverMessageToAction } from "@/lib/typing";
import Composition, { CompositionHandle } from "./composition";

/**
 * Remote adapter. Subscribes to the socket and decodes the messages for one
 * `userId` into typing actions, replaying them onto a read-only Composition.
 */
export default function RemoteEphemeral({
  textAtom,
  userId,
}: {
  textAtom: PrimitiveAtom<string>;
  userId: string;
}) {
  const compositionRef = useRef<CompositionHandle>(null);
  const wsClient = useAtomValue(wsClientAtom);

  useEffect(() => {
    if (!wsClient) return;
    return wsClient.onMessage((msg) => {
      const action = serverMessageToAction(msg, userId);
      if (action) compositionRef.current?.apply(action);
    });
  }, [wsClient, userId]);

  return <Composition ref={compositionRef} textAtom={textAtom} />;
}
