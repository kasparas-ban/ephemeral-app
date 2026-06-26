import { ClientMessage, ServerMessage } from "./types";

export type ConnectionStatus = "connecting" | "open" | "closed";

export class WSClient {
  private ws: WebSocket | null = null;
  private url = "ws://localhost:8080/connect";
  private reconnectDelayMs = 500;
  private connectionTimeoutMs = 5000; // 5 second timeout for connection
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  private messageListeners: Array<(msg: ServerMessage) => void> = [];
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  private status: ConnectionStatus = "closed";

  connect() {
    this.intentionallyClosed = false;
    this.setStatus("connecting");

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
      this.setStatus("open");
    };

    ws.onclose = () => {
      this.setStatus("closed");
      if (this.intentionallyClosed) return;
      this.reconnectTimeoutId = setTimeout(
        () => this.connect(),
        this.reconnectDelayMs,
      );
      this.reconnectDelayMs = Math.min(8000, this.reconnectDelayMs * 2);
    };

    ws.onerror = (e) => {
      console.error("WebSocket error", e);
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch (e) {
        console.error("Error parsing message", e);
        return;
      }
      // Fan out to all subscribers; routing is their concern, not ours.
      for (const listener of this.messageListeners) {
        try {
          listener(msg);
        } catch (e) {
          console.error("WS listener error", e);
        }
      }
    };
  }

  /** Tear down the socket and stop the reconnect loop. */
  disconnect() {
    this.intentionallyClosed = true;
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Subscribe to every incoming server message. Returns an unsubscribe function.
   */
  onMessage(fn: (msg: ServerMessage) => void): () => void {
    this.messageListeners.push(fn);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== fn);
    };
  }

  /**
   * Subscribe to connection-status changes. Fires immediately with the current
   * status, then again on every transition. Returns an unsubscribe function.
   */
  onStatus(fn: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(fn);
    fn(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== fn);
    };
  }

  send(payload: ClientMessage) {
    const s = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.ws.bufferedAmount > 256 * 1024) return; // backpressure guard
      this.ws.send(s);
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) {
        console.error("WS status listener error", e);
      }
    }
  }
}
