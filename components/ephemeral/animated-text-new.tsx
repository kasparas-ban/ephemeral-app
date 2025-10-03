const LINE_MOVE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const CHAR_SHIFT_EASING = "ease-out";
const CHAR_INTRO_EASING = "ease-out";

export type AnimatedTextOptions = {
  charWidth?: number; // px
  lineCharLimit?: number; // characters per line before wrapping on whitespace
  lineStepY?: number; // px to move previous lines up when a new line is created

  // Timings/easings
  charShiftDuration?: number; // ms
  lineMoveDuration?: number; // ms
  charIntroDuration?: number; // ms
  floatInitDuration?: number; // ms
  floatLoopDuration?: number; // ms
};

const DEFAULT_CHAR_WIDTH = 12.24;
const DEFAULT_LINE_CHAR_LIMIT = 15;
const DEFAULT_LINE_STEP_Y = 30;

export default class AnimatedText {
  private container: HTMLElement;
  private options: Required<AnimatedTextOptions>;
  private currentLine = 0;
  private lastLineCharCount = 0;

  constructor(container: HTMLElement, options?: AnimatedTextOptions) {
    this.container = container;
    this.options = {
      // Layout/logic defaults
      charWidth: options?.charWidth ?? DEFAULT_CHAR_WIDTH,
      lineCharLimit: options?.lineCharLimit ?? DEFAULT_LINE_CHAR_LIMIT,
      lineStepY: options?.lineStepY ?? DEFAULT_LINE_STEP_Y,

      // Animation defaults (milliseconds)
      charShiftDuration: options?.charShiftDuration ?? 100,
      lineMoveDuration: options?.lineMoveDuration ?? 160,
      charIntroDuration: options?.charIntroDuration ?? 100,
      floatInitDuration: options?.floatInitDuration ?? 2000,
      floatLoopDuration: options?.floatLoopDuration ?? 2000,
    };
  }

  /** Add and animate a single character. */
  addChar(char: string | null | undefined) {
    if (!char) return null;

    const isWhitespace = /\s/.test(char);

    const isNewLine = isWhitespace
      ? this.lastLineCharCount >= this.options.lineCharLimit
      : false;

    if (isNewLine) {
      this.createLine();
      this.shiftLinesUp();
      this.currentLine = this.currentLine + 1;
      this.lastLineCharCount = 0;
      return;
    }

    const isNewWord = isWhitespace || this.lastLineCharCount === 0;

    // Identify if this line already has a wrapper (i.e. we moved back to edit a previous line)
    const existingLineWrapper = this.container.querySelector(
      `span[data-type="line"][data-line="${this.currentLine}"]`
    ) as HTMLElement | null;

    if (isNewWord) {
      const wordEl = document.createElement("span");
      wordEl.className = "block absolute will-change-transform";
      wordEl.setAttribute("data-type", "word");
      wordEl.setAttribute("data-line", this.currentLine.toString());
      // Append inside existing line wrapper if editing a wrapped line, else directly to container
      if (existingLineWrapper) {
        existingLineWrapper.append(wordEl);
      } else {
        this.container.append(wordEl);
      }
    }

    // Get the last word for this line (inside wrapper if present)
    let lastWord: HTMLElement | null = null;
    if (existingLineWrapper) {
      lastWord = existingLineWrapper.lastElementChild as HTMLElement;
    } else {
      lastWord = this.container.lastElementChild as HTMLElement;
    }
    if (!lastWord) return;

    const charEl = document.createElement("span");
    charEl.textContent = char;
    charEl.className = "block absolute will-change-transform opacity-0";
    charEl.setAttribute("data-kind", "char");
    charEl.setAttribute("data-char-line", this.currentLine.toString());

    this.shiftCurrentLineLeft();

    lastWord.append(charEl);
    this.animateInitialCharAppearance(charEl);
    this.lastLineCharCount += 1;
  }

  /** Delete the last character on the current line (or merge lines if empty). */
  deleteChar() {
    // If there are characters on the current line, remove the last one
    if (this.lastLineCharCount > 0) {
      const chars = Array.from(
        this.container.querySelectorAll(
          `span[data-kind="char"][data-char-line="${this.currentLine}"]`
        )
      ) as HTMLElement[];
      if (!chars.length) return;
      // Last char is the one with the highest (least negative) tx value OR simply the last in DOM order
      const lastChar = chars[chars.length - 1];
      lastChar.remove();
      this.lastLineCharCount -= 1;
      // Shift remaining chars right
      this.shiftCurrentLineRight();

      // If line became empty after removal, treat as removing the line itself
      if (this.lastLineCharCount === 0 && this.currentLine > 0) {
        this.shiftLinesDown();
        this.currentLine -= 1;
        this.lastLineCharCount = this.getLineCharCount(this.currentLine);
      }
      return;
    }

    // No characters on this (empty) line: move back to previous line if exists
    if (this.lastLineCharCount === 0 && this.currentLine > 0) {
      this.shiftLinesDown();
      this.currentLine -= 1;
      this.lastLineCharCount = this.getLineCharCount(this.currentLine);
    }
  }

  private getLineCharCount(line: number) {
    return this.container.querySelectorAll(
      `span[data-kind="char"][data-char-line="${line}"]`
    ).length;
  }

  createLine() {
    const lineEl = document.createElement("span");
    lineEl.className = "block absolute will-change-transform";
    lineEl.setAttribute("data-type", "line");
    lineEl.setAttribute("data-line", this.currentLine.toString());
    this.container.append(lineEl);

    const lineWords = this.container.querySelectorAll(
      `span[data-type="word"][data-line="${this.currentLine}"]`
    );
    lineWords.forEach((word) => {
      (lineEl as HTMLElement).append(word);
    });
  }

  shiftLinesUp() {
    const lines = this.container.querySelectorAll(`span[data-type="line"]`);

    lines.forEach((line) => {
      const outer = line as HTMLElement;
      const currentY = parseFloat(outer.dataset.ty || "0");
      this.animateTranslateY(outer, currentY - this.options.lineStepY);
    });
  }

  shiftLinesDown() {
    const lines = this.container.querySelectorAll(`span[data-type="line"]`);

    lines.forEach((line) => {
      const outer = line as HTMLElement;
      const currentY = parseFloat(outer.dataset.ty || "0");
      this.animateTranslateY(outer, currentY + this.options.lineStepY);
    });
  }

  shiftCurrentLineLeft() {
    const lineChars = document.querySelectorAll(
      `span[data-char-line="${this.currentLine}"]`
    );

    lineChars.forEach((char) => {
      const outer = char as HTMLElement;
      const currentX = parseFloat(outer.dataset.tx || "0");
      this.animateTranslateX(outer, currentX - this.options.charWidth);
    });
  }

  // Shift all chars on current line to the right (used when deleting)
  private shiftCurrentLineRight() {
    const lineChars = document.querySelectorAll(
      `span[data-char-line="${this.currentLine}"]`
    );

    lineChars.forEach((char) => {
      const outer = char as HTMLElement;
      const currentX = parseFloat(outer.dataset.tx || "0");
      this.animateTranslateX(outer, currentX + this.options.charWidth);
    });
  }

  private animateTranslateX(el: HTMLElement, toX: number) {
    const fromX = parseFloat(el.dataset.tx || "0");

    el.animate(
      [
        { transform: `translateX(${fromX}px)` },
        { transform: `translateX(${toX}px)` },
      ],
      {
        duration: this.options.charShiftDuration,
        easing: CHAR_SHIFT_EASING,
        fill: "forwards",
      }
    );

    el.dataset.tx = String(toX);
  }

  private animateTranslateY(el: HTMLElement, toY: number) {
    const fromY = parseFloat(el.dataset.ty || "0");

    el.animate(
      [
        { transform: `translateY(${fromY}px)` },
        { transform: `translateY(${toY}px)` },
      ],
      {
        duration: this.options.lineMoveDuration,
        easing: LINE_MOVE_EASING,
        fill: "forwards",
      }
    );

    el.dataset.ty = String(toY);
  }

  animateInitialCharAppearance(el: HTMLElement) {
    el.animate(
      [
        { opacity: 0, transform: "translateX(0px)" },
        { opacity: 1, transform: `translateX(-${this.options.charWidth}px)` },
      ],
      {
        duration: this.options.charIntroDuration,
        easing: CHAR_INTRO_EASING,
        fill: "forwards",
      }
    );

    el.dataset.tx = String(-this.options.charWidth);
  }
}
