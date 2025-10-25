import { setConnectedUsers } from "@/stores/stores";
import {
  ClientMessage,
  ServerMessage,
  TypingBack,
  TypingClear,
  TypingUpdate,
} from "./types";

export class WSClient {
  private ws: WebSocket | null = null;
  private url =
    (typeof location !== "undefined"
      ? (location.protocol === "https:" ? "wss://" : "ws://") + location.host
      : "ws://localhost:3000") + "/connect";
  private reconnectDelayMs = 500;

  constructor() {}

  connect() {
    const ws = new WebSocket(this.url);

    this.ws = ws;
    ws.onopen = () => {
      this.reconnectDelayMs = 500;
    };

    ws.onclose = () => {
      setTimeout(() => this.connect(), this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(8000, this.reconnectDelayMs * 2);
    };

    ws.onerror = (e) => {
      console.error("WebSocket error", e);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage;

        if (msg.type === "presence") {
          setConnectedUsers(msg.users);
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    };
  }

  setHandlers(
    typingUpdateHandler: (t: TypingUpdate) => void,
    typingClearHandler: (t: TypingClear) => void,
    typingBackHandler?: (t: TypingBack) => void
  ) {
    if (!this.ws) return;

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage;

        switch (msg.type) {
          case "presence":
            setConnectedUsers(msg.users);
            break;
          case "typing_update":
            typingUpdateHandler(msg as TypingUpdate);
            break;
          case "typing_clear":
            typingClearHandler(msg as TypingClear);
            break;
          case "typing_back":
            typingBackHandler?.(msg as TypingBack);
            break;
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    };
  }

  send(payload: ClientMessage) {
    const s = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.ws.bufferedAmount > 256 * 1024) return; // backpressure guard
      this.ws.send(s);
    }
  }
}
