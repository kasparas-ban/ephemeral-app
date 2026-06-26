import { ClientMessage, ServerMessage, TypingAction } from "./types";

/** Keyboard adapter: decode a raw `InputEvent` into a typing action. */
export function inputEventToAction(e: InputEvent): TypingAction | null {
  // Enter / paragraph insertion clears the composition.
  if (e.inputType === "insertParagraph") return { kind: "clear" };
  // Backspace deletes the last character.
  if (e.inputType === "deleteContentBackward") return { kind: "back" };
  // Everything else only matters if it carried a character.
  if (e.data == null) return null;
  return { kind: "char", char: e.data };
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
