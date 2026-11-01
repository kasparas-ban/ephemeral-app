import { describe, expect, it } from "vitest";

import {
  actionToClientMessage,
  compositionToActions,
  inputEventToAction,
  isKeyboardCharacter,
  sanitizeKeyboardText,
  serverMessageToAction,
} from "./typing";

describe("isKeyboardCharacter", () => {
  it("accepts single printable ASCII characters", () => {
    expect(isKeyboardCharacter("a")).toBe(true);
    expect(isKeyboardCharacter(" ")).toBe(true);
    expect(isKeyboardCharacter("~")).toBe(true);
  });

  it("rejects control characters, non-ASCII, multi-char and non-strings", () => {
    expect(isKeyboardCharacter("\n")).toBe(false);
    expect(isKeyboardCharacter("é")).toBe(false);
    expect(isKeyboardCharacter("ab")).toBe(false);
    expect(isKeyboardCharacter("")).toBe(false);
    expect(isKeyboardCharacter(1)).toBe(false);
  });
});

describe("sanitizeKeyboardText", () => {
  it("drops non-keyboard characters", () => {
    expect(sanitizeKeyboardText("héllo\twörld")).toBe("hllowrld");
  });

  it("strips line breaks unless allowed, normalizing CRLF", () => {
    expect(sanitizeKeyboardText("a\r\nb\rc\nd")).toBe("abcd");
    expect(
      sanitizeKeyboardText("a\r\nb\rc\nd", { allowLineBreaks: true }),
    ).toBe("a\nb\nc\nd");
  });
});

describe("inputEventToAction", () => {
  const event = (inputType: string, data: string | null = null) =>
    ({ inputType, data }) as InputEvent;

  it("maps paragraph insertion to clear and backspace to back", () => {
    expect(inputEventToAction(event("insertParagraph"))).toEqual({
      kind: "clear",
    });
    expect(inputEventToAction(event("deleteContentBackward"))).toEqual({
      kind: "back",
    });
  });

  it("maps a typed keyboard character to a char action", () => {
    expect(inputEventToAction(event("insertText", "x"))).toEqual({
      kind: "char",
      char: "x",
    });
  });

  it("ignores events without a keyboard character", () => {
    expect(inputEventToAction(event("insertText", null))).toBeNull();
    expect(inputEventToAction(event("insertText", "ü"))).toBeNull();
    expect(inputEventToAction(event("insertFromPaste", "xy"))).toBeNull();
  });
});

describe("compositionToActions", () => {
  it("adds only the characters a composition update appends", () => {
    expect(compositionToActions("", "h")).toEqual([
      { kind: "char", char: "h" },
    ]);
    expect(compositionToActions("h", "hel")).toEqual([
      { kind: "char", char: "e" },
      { kind: "char", char: "l" },
    ]);
  });

  it("does nothing when the composition is committed unchanged", () => {
    expect(compositionToActions("hel", "hel")).toEqual([]);
  });

  it("deletes characters the composition dropped", () => {
    expect(compositionToActions("hel", "he")).toEqual([{ kind: "back" }]);
    expect(compositionToActions("ka", "")).toEqual([
      { kind: "back" },
      { kind: "back" },
    ]);
  });

  it("replaces the changed tail, as autocorrect does", () => {
    expect(compositionToActions("teh", "the")).toEqual([
      { kind: "back" },
      { kind: "back" },
      { kind: "char", char: "h" },
      { kind: "char", char: "e" },
    ]);
  });
});

describe("serverMessageToAction", () => {
  it("decodes typing messages for the given user", () => {
    expect(
      serverMessageToAction(
        { type: "typing_update", userId: "u1", char: "k" },
        "u1",
      ),
    ).toEqual({ kind: "char", char: "k" });
    expect(
      serverMessageToAction({ type: "typing_clear", userId: "u1" }, "u1"),
    ).toEqual({ kind: "clear" });
    expect(
      serverMessageToAction({ type: "typing_back", userId: "u1" }, "u1"),
    ).toEqual({ kind: "back" });
  });

  it("ignores other users, invalid chars and non-typing messages", () => {
    expect(
      serverMessageToAction(
        { type: "typing_update", userId: "u2", char: "k" },
        "u1",
      ),
    ).toBeNull();
    expect(
      serverMessageToAction(
        { type: "typing_update", userId: "u1", char: "\u0007" },
        "u1",
      ),
    ).toBeNull();
    expect(
      serverMessageToAction({ type: "presence", users: [] }, "u1"),
    ).toBeNull();
  });
});

describe("actionToClientMessage", () => {
  it("encodes each action kind to its wire message", () => {
    expect(actionToClientMessage({ kind: "char", char: "a" })).toEqual({
      type: "typing_update",
      char: "a",
    });
    expect(actionToClientMessage({ kind: "back" })).toEqual({
      type: "typing_back",
    });
    expect(actionToClientMessage({ kind: "clear" })).toEqual({
      type: "typing_clear",
    });
  });
});
