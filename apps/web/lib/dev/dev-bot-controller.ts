import { ClientMessage } from "@/lib/types";
import { sanitizeKeyboardText } from "@/lib/typing";
import { ConnectionStatus, WSClient } from "@/lib/ws";

export const DEV_BOT_MAX_COUNT = 10;

export const DEFAULT_DEV_BOT_PHRASES = [
  "hello from a hidden tab",
  "testing the shared air",
  "one more passing thought",
  "this came through the real websocket",
];

export type DevBotSnapshot = {
  id: string;
  name: string;
  status: ConnectionStatus;
  phrase: string;
};

export type DevBotControllerOptions = {
  count: number;
  cadenceMs: number;
  phrases: string[];
};

type DevBot = DevBotSnapshot & {
  ws: WSClient;
  unsubscribeStatus: () => void;
};

export class DevBotController {
  private bots: DevBot[] = [];
  private options = normalizeOptions({
    count: 3,
    cadenceMs: 120,
    phrases: DEFAULT_DEV_BOT_PHRASES,
  });
  private abortController: AbortController | null = null;
  private typingStarted = false;

  constructor(private onChange: (bots: DevBotSnapshot[]) => void) {}

  start(options: DevBotControllerOptions) {
    this.stop();
    this.options = normalizeOptions(options);
    this.abortController = new AbortController();
    this.typingStarted = false;

    this.bots = Array.from({ length: this.options.count }, (_, index) => {
      const ws = new WSClient();
      const bot: DevBot = {
        id: `dev-bot-${index + 1}`,
        name: `Bot ${index + 1}`,
        status: "closed",
        phrase: "",
        ws,
        unsubscribeStatus: () => {},
      };

      bot.unsubscribeStatus = ws.onStatus((status) => {
        bot.status = status;
        this.emit();
      });
      ws.connect();

      return bot;
    });

    this.emit();
  }

  updateOptions(options: DevBotControllerOptions) {
    this.options = normalizeOptions(options);
  }

  setReadyToType(ready: boolean) {
    const signal = this.abortController?.signal;
    if (!ready || this.typingStarted || !signal || signal.aborted) return;

    this.typingStarted = true;
    for (const [index, bot] of this.bots.entries()) {
      void this.runBot(bot, index, signal);
    }
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
    this.typingStarted = false;

    for (const bot of this.bots) {
      bot.unsubscribeStatus();
      bot.ws.disconnect();
    }

    this.bots = [];
    this.emit();
  }

  private async runBot(bot: DevBot, index: number, signal: AbortSignal) {
    await sleep(index * 250, signal);

    while (!signal.aborted) {
      if (bot.status !== "open") {
        await sleep(250, signal);
        continue;
      }

      const phrase = this.nextPhrase(index);
      bot.phrase = phrase;
      this.emit();

      for (const char of Array.from(phrase)) {
        if (signal.aborted) return;
        this.send(bot, { type: "typing_update", char });
        await sleep(this.options.cadenceMs, signal);
      }

      await sleep(1_000 + index * 125, signal);
      this.send(bot, { type: "typing_clear" });
      bot.phrase = "";
      this.emit();

      await sleep(800 + Math.random() * 900, signal);
    }
  }

  private nextPhrase(index: number) {
    const phrases = this.options.phrases;
    return phrases[(Date.now() + index) % phrases.length];
  }

  private send(bot: DevBot, message: ClientMessage) {
    bot.ws.send(message);
  }

  private emit() {
    this.onChange(
      this.bots.map(({ id, name, status, phrase }) => ({
        id,
        name,
        status,
        phrase,
      })),
    );
  }
}

export function normalizeDevBotPhrases(value: string) {
  const phrases = value
    .split("\n")
    .map((line) => sanitizeKeyboardText(line).trim())
    .filter(Boolean);

  return phrases.length > 0 ? phrases : DEFAULT_DEV_BOT_PHRASES;
}

function normalizeOptions(options: DevBotControllerOptions) {
  return {
    count: clamp(Math.round(options.count), 1, DEV_BOT_MAX_COUNT),
    cadenceMs: clamp(Math.round(options.cadenceMs), 40, 2_000),
    phrases:
      options.phrases.length > 0 ? options.phrases : DEFAULT_DEV_BOT_PHRASES,
  };
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(done, ms);

    function done() {
      signal.removeEventListener("abort", done);
      clearTimeout(timeoutId);
      resolve();
    }

    signal.addEventListener("abort", done, { once: true });
  });
}
