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
  private url = "ws://localhost:8080/connect";
  private reconnectDelayMs = 500;
  private connectionTimeoutMs = 5000; // 5 second timeout for connection
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // Allow multiple subscribers to react to incoming messages
  private listeners: Array<(msg: ServerMessage) => void> = [];

  constructor() {}

  connect() {
    const ws = new WebSocket(this.url);

    this.ws = ws;

    // Set a timeout to close the connection if it doesn't open in time
    this.connectionTimeoutId = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log("WebSocket connection timeout");
        ws.close();
      }
    }, this.connectionTimeoutMs);

    ws.onopen = () => {
      // Clear the connection timeout on successful connection
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }
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

        // Always update built-in presence state
        if (msg.type === "presence") {
          console.log("Presence update", msg.users);
          setConnectedUsers(msg.users);
        }

        // Fan out to all listeners
        for (const listener of this.listeners) {
          try {
            listener(msg);
          } catch (e) {
            console.error("WS listener error", e);
          }
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    };
  }

  /**
   * Subscribe to all incoming server messages. Returns an unsubscribe function.
   */
  addListener(fn: (msg: ServerMessage) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  setHandlers(
    typingUpdateHandler: (t: TypingUpdate) => void,
    typingClearHandler: (t: TypingClear) => void,
    typingBackHandler?: (t: TypingBack) => void
  ): () => void {
    // Register a listener instead of overriding onmessage so multiple subscribers can coexist
    const listener = (msg: ServerMessage) => {
      switch (msg.type) {
        case "typing_update":
          typingUpdateHandler(msg as TypingUpdate);
          break;
        case "typing_clear":
          typingClearHandler(msg as TypingClear);
          break;
        case "typing_back":
          typingBackHandler?.(msg as TypingBack);
          break;
        // presence is handled centrally in connect()
      }
    };

    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
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
