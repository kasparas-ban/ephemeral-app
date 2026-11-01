import { ClientMessage, ServerMessage, TypingAction } from "./types";

const PRINTABLE_ASCII_START = 0x20;
const PRINTABLE_ASCII_END = 0x7e;

export function isKeyboardCharacter(char: unknown): char is string {
  if (typeof char !== "string" || char.length !== 1) return false;

  const code = char.charCodeAt(0);
  return code >= PRINTABLE_ASCII_START && code <= PRINTABLE_ASCII_END;
}

export function sanitizeKeyboardText(
  value: string,
  options: { allowLineBreaks?: boolean } = {},
): string {
  const normalizedValue = options.allowLineBreaks
    ? value.replace(/\r\n?/g, "\n")
    : value;
  let sanitized = "";

  for (const char of normalizedValue) {
    if (isKeyboardCharacter(char)) {
      sanitized += char;
      continue;
    }

    if (options.allowLineBreaks && char === "\n") {
      sanitized += char;
    }
  }

  return sanitized;
}

/** Keyboard adapter: decode a raw `InputEvent` into a typing action. */
export function inputEventToAction(e: InputEvent): TypingAction | null {
  // Enter / paragraph insertion clears the composition.
  if (e.inputType === "insertParagraph") return { kind: "clear" };
  // Backspace deletes the last character.
  if (e.inputType === "deleteContentBackward") return { kind: "back" };
  // Everything else only matters if it carried a character.
  if (e.data == null) return null;
  if (!isKeyboardCharacter(e.data)) return null;

  return { kind: "char", char: e.data };
}

/**
 * IME adapter: the actions that turn the composition text already applied into
 * the next composition text. Both strings must already be keyboard text.
 */
export function compositionToActions(
  applied: string,
  next: string,
): TypingAction[] {
  let common = 0;
  while (common < applied.length && applied[common] === next[common]) {
    common++;
  }

  const backs = Array.from(
    { length: applied.length - common },
    (): TypingAction => ({ kind: "back" }),
  );
  const chars = Array.from(
    next.slice(common),
    (char): TypingAction => ({ kind: "char", char }),
  );

  return [...backs, ...chars];
}

/**
 * Remote adapter: decode a server message into a typing action for a single
 * user. Returns null for messages that belong to another user or aren't typing
 * (e.g. presence), so a subscriber can filter purely on the return value.
 */
export function serverMessageToAction(
  msg: ServerMessage,
  userId: string,
): TypingAction | null {
  switch (msg.type) {
    case "typing_update":
      if (msg.userId !== userId) return null;
      if (!isKeyboardCharacter(msg.char)) return null;
      return { kind: "char", char: msg.char };
    case "typing_clear":
      if (msg.userId !== userId) return null;
      return { kind: "clear" };
    case "typing_back":
      if (msg.userId !== userId) return null;
      return { kind: "back" };
    default:
      return null;
  }
}

/** Encode a local typing action into the client-to-server wire message. */
export function actionToClientMessage(action: TypingAction): ClientMessage {
  switch (action.kind) {
    case "char":
      return { type: "typing_update", char: action.char };
    case "back":
      return { type: "typing_back" };
    case "clear":
      return { type: "typing_clear" };
  }
}
