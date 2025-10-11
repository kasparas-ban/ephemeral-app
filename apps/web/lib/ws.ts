import {
  ClientEnvelope,
  ServerEnvelope,
  HelloAck,
  Presence,
  TypingEnd,
  TypingState,
} from "./types";

type Handlers = {
  helloAck?: (msg: HelloAck) => void;
  presence?: (msg: Presence) => void;
  typingState?: (msg: TypingState) => void;
  typingEnd?: (msg: TypingEnd) => void;
  open?: () => void;
  close?: () => void;
  error?: (e: Event) => void;
};

export class WSClient {
  private ws: WebSocket | null = null;
  private url =
    (typeof location !== "undefined"
      ? (location.protocol === "https:" ? "wss://" : "ws://") + location.host
      : "ws://localhost:3000") + "/ws";
  private reconnectDelayMs = 500;
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.reconnectDelayMs = 500;
      this.handlers.open?.();
    };
    ws.onclose = () => {
      this.handlers.close?.();
      setTimeout(() => this.connect(), this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(8000, this.reconnectDelayMs * 2);
    };
    ws.onerror = (e) => this.handlers.error?.(e);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerEnvelope<any>;
        switch (msg.type) {
          case "hello_ack":
            this.handlers.helloAck?.(msg.data as HelloAck);
            break;
          case "presence":
            this.handlers.presence?.(msg.data as Presence);
            break;
          case "typing_state":
            this.handlers.typingState?.(msg.data as TypingState);
            break;
          case "typing_end":
            this.handlers.typingEnd?.(msg.data as TypingEnd);
            break;
        }
      } catch {}
    };
  }

  send<T>(payload: ClientEnvelope<T>) {
    const s = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.ws.bufferedAmount > 256 * 1024) return; // backpressure guard
      this.ws.send(s);
    }
  }
}
