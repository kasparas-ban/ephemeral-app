export type AnimatedTextOptions = {
  // Layout/logic options to mirror FloatingText behavior
  charWidth?: number; // px
  lineCharLimit?: number; // characters per line before wrapping on whitespace
  lineStepY?: number; // px to move previous lines up when a new line is created

  // Timings/easings
  charShiftDuration?: number; // ms
  charShiftEase?: string;

  lineMoveDuration?: number; // ms
  lineMoveEase?: string;

  charIntroDuration?: number; // ms
  charIntroEase?: string;

  floatInitDuration?: number; // ms
  floatInitEase?: string;

  floatLoopDuration?: number; // ms
  floatLoopEase?: string;
};

/**
 * AnimatedText encapsulates floating text character creation and animation using WAAPI only.
 * Mirrors the advanced FloatingText logic from ephemeral-block-updated.tsx.
 */
export default class AnimatedText {
  private container: HTMLElement;
  private options: Required<AnimatedTextOptions>;
  private currentLine = 0;

  constructor(container: HTMLElement, options?: AnimatedTextOptions) {
    this.container = container;
    this.options = {
      // Layout/logic defaults
      charWidth: options?.charWidth ?? 12.24,
      lineCharLimit: options?.lineCharLimit ?? 15,
      lineStepY: options?.lineStepY ?? 30,

      // Animation defaults (milliseconds)
      charShiftDuration: options?.charShiftDuration ?? 100,
      charShiftEase: options?.charShiftEase ?? "ease-out",

      lineMoveDuration: options?.lineMoveDuration ?? 200,
      lineMoveEase: options?.lineMoveEase ?? "ease-out",

      charIntroDuration: options?.charIntroDuration ?? 100,
      charIntroEase: options?.charIntroEase ?? "ease-out",

      floatInitDuration: options?.floatInitDuration ?? 2000,
      floatInitEase: options?.floatInitEase ?? "ease-in-out",

      floatLoopDuration: options?.floatLoopDuration ?? 2000,
      floatLoopEase: options?.floatLoopEase ?? "ease-in",
    } as Required<AnimatedTextOptions>;
  }

  /** Add and animate a single character. */
  addChar(char: string | null | undefined): HTMLSpanElement | null {
    if (!char) return null;

    const isWhitespace = /\s/.test(char);

    const lineChars = this.container.querySelectorAll(
      `span[data-kind="char"][data-char-line="${this.currentLine}"]`
    );

    const isNewLine = lineChars
      ? lineChars.length > (this.options.lineCharLimit ?? 15)
      : false;

    if (isNewLine && isWhitespace) {
      this.createNewLineFromCurrentWords();
      this.bumpPreviousLines();
      this.currentLine += 1;
    } else {
      // Shift existing chars on the current line left by charWidth (on outer char wrapper)
      lineChars?.forEach((span, idx) => {
        const outer = span as HTMLElement;
        const targetX = -this.options.charWidth * (lineChars.length - idx);
        this.animateTranslateX(outer, targetX);
      });
    }

    // Create nested spans to separate transforms
    // outer (char) -> inner (intro + float)
    const charOuter = document.createElement("span");
    charOuter.className = "block absolute will-change-transform";
    charOuter.setAttribute("data-kind", "char");
    charOuter.setAttribute("data-char-line", this.currentLine.toString());
    // Track current X on outer via dataset
    if (!charOuter.dataset.tx) charOuter.dataset.tx = "0";

    const charInner = document.createElement("span");
    charInner.className = "block absolute will-change-transform";
    charInner.textContent = char;

    charOuter.append(charInner);

    if (isWhitespace) {
      if (!isNewLine) this.container.append(charOuter);
      // After whitespace, animate last completed word
      this.animateLastWordOnWhitespace(isNewLine);
    } else {
      // Non-whitespace: ensure a word wrapper and append
      const last = this.container.lastElementChild as HTMLElement | null;
      let wordWrapper: HTMLElement | null =
        last && last.getAttribute("data-kind") === "word" ? last : null;

      if (!wordWrapper) {
        wordWrapper = document.createElement("span");
        wordWrapper.className = "block absolute will-change-transform";
        wordWrapper.setAttribute("data-kind", "word");
        wordWrapper.setAttribute("data-word-line", this.currentLine.toString());
        this.container.append(wordWrapper);
      }

      wordWrapper.append(charOuter);

      // 1) Intro animation on inner: translateX % and opacity
      const intro = charInner.animate(
        [
          { transform: "translateX(-50%)", opacity: 0 },
          { transform: "translateX(-100%)", opacity: 1 },
        ],
        {
          duration: this.options.charIntroDuration,
          easing: this.options.charIntroEase,
          fill: "forwards",
        }
      );

      intro.finished.then(async () => {
        // 2) Move to initial float position (y/rotate)
        const y0 = this.randomFloat(-1, 1, 0.5);
        const r0 = this.randomFloat(-2, 2, 0.5);

        const toInit = charInner.animate(
          [
            { transform: `translateX(-100%) translateY(0px) rotate(0deg)` },
            {
              transform: `translateX(-100%) translateY(${y0}px) rotate(${r0}deg)`,
            },
          ],
          {
            duration: this.options.floatInitDuration,
            easing: this.options.floatInitEase,
            fill: "forwards",
          }
        );

        return toInit.finished.then(() => {
          // 3) Infinite float loop between two positions
          const y1 = this.randomFloat(-1.5, 1.5, 0.5);
          const r1 = this.randomFloat(-2, 2, 0.5);

          charInner.animate(
            [
              {
                transform: `translateX(-100%) translateY(${y0}px) rotate(${r0}deg)`,
              },
              {
                transform: `translateX(-100%) translateY(${y1}px) rotate(${r1}deg)`,
              },
            ],
            {
              duration: this.options.floatLoopDuration,
              easing: this.options.floatLoopEase,
              direction: "alternate",
              iterations: Infinity,
              fill: "both",
            }
          );
        });
      });
    }

    return charOuter;
  }

  /** Remove all children and cancel ongoing animations */
  clear(): void {
    while (this.container.firstChild) {
      const node = this.container.firstChild as HTMLElement;
      try {
        // Clone cancels all running animations
        const clone = node.cloneNode(true);
        this.container.replaceChild(clone, node);
        this.container.removeChild(clone);
      } catch {
        this.container.removeChild(node);
      }
    }

    this.currentLine = 0;
  }

  // --- Advanced helpers ---

  private createNewLineFromCurrentWords() {
    const lineWords = this.container?.querySelectorAll(
      `span[data-kind="word"][data-word-line="${this.currentLine}"]`
    );
    const lineSpan = document.createElement("span");
    lineSpan.className = "block absolute will-change-transform";
    lineSpan.setAttribute("data-line", this.currentLine.toString());
    if (!lineSpan.dataset.ty) lineSpan.dataset.ty = "0";
    lineSpan.append(...(lineWords ? Array.from(lineWords) : []));
    this.container.append(lineSpan);
  }

  private bumpPreviousLines() {
    for (let line = 0; line <= this.currentLine; line++) {
      const lineSpan = this.container.querySelector(
        `span[data-line="${line}"]`
      ) as HTMLElement | null;
      if (!lineSpan) continue;

      const fromY = parseFloat(lineSpan.dataset.ty || "0");
      const toY = -this.options.lineStepY * (this.currentLine - line + 1);

      lineSpan.animate(
        [
          { transform: `translateY(${fromY}px)` },
          { transform: `translateY(${toY}px)` },
        ],
        {
          duration: this.options.lineMoveDuration,
          easing: this.options.lineMoveEase,
          fill: "forwards",
        }
      );

      lineSpan.dataset.ty = String(toY);
    }
  }

  private async animateLastWordOnWhitespace(isNewLine: boolean) {
    if (isNewLine) return;

    const children = this.container.children;
    if (children.length < 2) return;

    const lastWord = children[children.length - 2] as HTMLElement | null;
    if (!lastWord || lastWord.getAttribute("data-kind") !== "word") return;

    const y0 = this.randomFloat(-2, 2, 1);

    const toInit = lastWord.animate(
      [{ transform: `translateY(0px)` }, { transform: `translateY(${y0}px)` }],
      {
        duration: this.options.floatInitDuration,
        easing: this.options.floatInitEase,
        fill: "forwards",
      }
    );

    await toInit.finished;

    const y1 = this.randomFloat(-2, 2, 1);
    lastWord.animate(
      [
        { transform: `translateY(${y0}px)` },
        { transform: `translateY(${y1}px)` },
      ],
      {
        duration: this.options.floatLoopDuration,
        easing: this.options.floatLoopEase,
        direction: "alternate",
        iterations: Infinity,
        fill: "both",
      }
    );
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
        easing: this.options.charShiftEase,
        fill: "forwards",
      }
    );

    el.dataset.tx = String(toX);
  }

  // Updated to support controlling minimum absolute value of the result when possible
  private randomFloat(min: number, max: number, minAbs = 0): number {
    // Ensure valid ordering
    if (min > max) [min, max] = [max, min];

    // No constraint requested
    if (minAbs <= 0) {
      return Math.random() * (max - min) + min;
    }

    // If the entire range is already outside the exclusion zone [-minAbs, minAbs], sample uniformly
    if (max <= -minAbs || min >= minAbs) {
      return Math.random() * (max - min) + min;
    }

    const negExists = min < -minAbs; // there is a valid negative interval [min, -minAbs]
    const posExists = max > minAbs; // there is a valid positive interval [minAbs, max]

    // If neither side can satisfy the constraint (range fully within (-minAbs, minAbs)), fall back to uniform
    if (!negExists && !posExists) {
      return Math.random() * (max - min) + min;
    }

    // Both sides available: choose proportionally to interval lengths
    if (negExists && posExists) {
      const negStart = min;
      const negEnd = -minAbs;
      const posStart = minAbs;
      const posEnd = max;

      const lenNeg = negEnd - negStart; // > 0
      const lenPos = posEnd - posStart; // > 0

      const useNeg = Math.random() < lenNeg / (lenNeg + lenPos);
      if (useNeg) {
        return negStart + Math.random() * lenNeg;
      } else {
        return posStart + Math.random() * lenPos;
      }
    }

    // Only negative side available
    if (negExists) {
      const start = min;
      const end = Math.min(max, -minAbs);
      return start + Math.random() * (end - start);
    }

    // Only positive side available
    const start = Math.max(min, minAbs);
    const end = max;
    return start + Math.random() * (end - start);
  }
}
