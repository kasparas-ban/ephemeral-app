"use client";

import {
  ClientEnvelope,
  Presence,
  TypingEnd,
  TypingEndMsg,
  TypingState,
  TypingUpdateMsg,
} from "@/lib/types";
import { WSClient } from "@/lib/ws";
import { useEffect, useRef } from "react";

function ulid() {
  // lightweight ULID-like
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export default function TypingController() {
  const wsRef = useRef<WSClient | null>(null);
  const compIdRef = useRef<string | null>(null);
  const bufferRef = useRef<string>("");
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    const ws = new WSClient({
      presence: (_: Presence) => {},
      typingState: (m: TypingState) =>
        (globalThis as any).__worldCanvas?.applyTypingState(m),
      typingEnd: (m: TypingEnd) =>
        (globalThis as any).__worldCanvas?.applyTypingEnd(m),
    });
    ws.connect();
    wsRef.current = ws;
    return () => {
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!wsRef.current) return;
      if (
        e.key === "Shift" ||
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key === "Alt"
      )
        return;
      if (compIdRef.current == null) {
        compIdRef.current = ulid();
      }
      if (e.key === "Enter" || e.key === "Escape") {
        const end: ClientEnvelope<TypingEndMsg> = {
          type: "typing_end",
          data: {
            compositionId: compIdRef.current!,
            finalText: bufferRef.current,
          },
        };
        wsRef.current.send(end);
        compIdRef.current = null;
        bufferRef.current = "";
        if (flushTimer.current) window.clearTimeout(flushTimer.current);
        return;
      }
      if (e.key === "Backspace")
        bufferRef.current = bufferRef.current.slice(0, -1);
      else if (e.key.length === 1) bufferRef.current += e.key;

      if (flushTimer.current) return;
      flushTimer.current = window.setTimeout(() => {
        if (!wsRef.current || compIdRef.current == null) return;
        const upd: ClientEnvelope<TypingUpdateMsg> = {
          type: "typing_update",
          data: {
            compositionId: compIdRef.current!,
            text: bufferRef.current,
          },
        };
        wsRef.current.send(upd);
        flushTimer.current = null;
      }, 100);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
