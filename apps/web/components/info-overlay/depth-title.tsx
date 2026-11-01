"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "motion/react";

import { FloatingLetter, letterFloat, sampleMirrored } from "./floating";

/*
 * The title's letters float in 3D. Each letter has a depth, z (0 = on the
 * focal plane, 1 = furthest back), and hangs on a loose chain: two unseen
 * pull points glide along the word drawing letters back, and springs tie each
 * letter to its neighbours, so the letters beside a pulled one follow part of
 * the way.
 *
 * Depth drives everything a camera would show: further letters get smaller,
 * slip slightly toward the centre of the word, and lose focus. Each letter is
 * drawn as its own quad, far to near, with a lens (disc) blur sized by its
 * depth, so overlapping letters composite like real layers.
 */

// Look
const MAX_RADIUS_PX = 9; // blur disc radius at z = 1, CSS px
const MIN_SCALE = 0.86; // letter size at z = 1
const CONVERGENCE = 0.5; // how far receding letters slide toward the centre
const MAX_DPR = 2;
const TAPS = 128; // enough samples that the wide blur stays smooth, not grainy
const INK = 0.04; // neutral-950
const CELL_PAD_PX = Math.ceil(MAX_RADIUS_PX / MIN_SCALE) + 4; // blur room per letter in the atlas
const CANVAS_PAD_PX = MAX_RADIUS_PX + 12; // blur + float room around the word

// Chain. Letters rest on the focal plane, tied to their neighbours.
const NEIGHBOR_STIFFNESS = 5; // the string between letters
const REST_STIFFNESS = 2.7; // each letter's pull back to the focal plane
const DAMPING = 3.25;

// Two pull points travel across the word in opposite directions, leave at one
// end and re-enter at the other. Speed and strength drift on slow, unrelated
// waves so the pattern doesn't read as a loop, but a point's speed never
// reaches zero (wobble * 2π / wobblePeriod < speed), so the blur never stalls
// or parks on a letter. Tuned in simulation: the blur pattern is nearly still
// ~2% of the time, a letter stays soft ~9s typically and ~16s at most, some
// area is clearly soft (4px+) ~99% of the time, soft groups average ~4
// letters, and the whole word is soft together ~2% of the time.
const PULL_POINTS = [
  {
    direction: 1,
    speed: 1,
    offset: 0,
    wobble: 1.2,
    wobblePeriod: 17,
    strengthPeriod: 13.3,
    phase: 0.4,
  },
  {
    direction: -1,
    speed: 0.81,
    offset: 0.5,
    wobble: 1,
    wobblePeriod: 21,
    strengthPeriod: 17.9,
    phase: 3.3,
  },
];
const PULL_DEPTH = 1.6; // how far back a point draws the letter under it
const PULL_WIDTH = 0.7; // spread of a point's pull, in letters
const PULL_MIN_STRENGTH = 0.7; // a point's strength drifts between this and 1
const PULL_MARGIN = 1; // letters beyond each end a point travels before re-entering
// The chain runs on its own clock; 2 = half speed. Slows waves, drag and
// sway together, so the motion keeps its character, just calmer.
const DEPTH_SLOWDOWN = 2;
const FADE_IN_START_S = 1.5; // sharp while the title scales in (real time)
const FADE_IN_DURATION_S = 1.5;
const STEP_S = 1 / 120;

const VERTEX_SHADER = `
attribute vec2 a_pos;
uniform vec2 u_canvas;  // device px
uniform vec2 u_center;  // device px, top-left origin
uniform vec2 u_half;    // device px
varying vec2 v_local;
void main() {
  v_local = a_pos * 0.5 + 0.5;
  vec2 px = u_center + a_pos * vec2(u_half.x, -u_half.y);
  vec2 clip = px / u_canvas * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_local;
uniform sampler2D u_atlas;
uniform vec4 u_cell;      // atlas uv: x0, y0, x1, y1
uniform vec2 u_atlasSize; // px
uniform float u_radius;   // blur radius in atlas px

const int TAPS = ${TAPS};
const float GOLDEN_ANGLE = 2.39996323;

float toSrgb(float c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

void main() {
  vec2 uv = mix(u_cell.xy, u_cell.zw, v_local);
  float a;
  if (u_radius < 0.5) {
    a = texture2D(u_atlas, uv).a;
  } else {
    // Even disc of samples on a golden-angle spiral: a lens aperture.
    float sum = 0.0;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float dist = sqrt(fi / float(TAPS)) * u_radius;
      float angle = fi * GOLDEN_ANGLE;
      sum += texture2D(u_atlas, uv + vec2(cos(angle), sin(angle)) * dist / u_atlasSize).a;
    }
    a = sum / float(TAPS);
  }

  // Ink on white: average the light, not the ink. Coverage a over white is
  // radiance 1 - a; re-encoding that to sRGB keeps defocused strokes airy
  // rather than muddy. Faded in with the radius so sharp edges are untouched.
  float lensA = 1.0 - toSrgb(1.0 - a);
  a = mix(a, lensA, smoothstep(0.5, 2.5, u_radius));
  gl_FragColor = vec4(vec3(${INK}) * a, a);
}`;

export default function DepthTitle({ word }: { word: string }) {
  const reduceMotion = useReducedMotion();
  const rowRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const chars = word.split("");

  useEffect(() => {
    const row = rowRef.current;
    const canvas = canvasRef.current;
    if (reduceMotion || webglFailed || !row || !canvas) return;

    const letters = word.split("");
    const atlas = document.createElement("canvas");
    const ctx = atlas.getContext("2d");
    let renderer = ctx && createRenderer(canvas);
    if (!ctx || !renderer) {
      setWebglFailed(true);
      return;
    }

    const chain = createChain(letters.length);
    let layout: Layout | null = null;
    let cell = { width: 0, height: 0 };
    let raf = 0;
    let fontReady = false;
    let disposed = false;
    let simSeconds = 0;
    const start = performance.now();

    const measure = () => {
      layout = measureLayout(row, ctx);
      const { dpr, word: box, letters: boxes } = layout;
      const cssWidth = box.width + CANVAS_PAD_PX * 2;
      const cssHeight = box.height + CANVAS_PAD_PX * 2;
      Object.assign(canvas.style, {
        left: `${box.x - CANVAS_PAD_PX}px`,
        top: `${box.y - CANVAS_PAD_PX}px`,
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
      });
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      cell = {
        width: Math.max(...boxes.map((b) => b.width)) + CELL_PAD_PX * 2,
        height: box.height + CELL_PAD_PX * 2,
      };
      atlas.width = Math.round(cell.width * boxes.length * dpr);
      atlas.height = Math.round(cell.height * dpr);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!layout || !renderer || !fontReady) return;
      const seconds = (now - start) / 1000;

      // Fixed-step physics; after a long pause (hidden tab) skip ahead.
      simSeconds = Math.max(simSeconds, seconds - 0.25);
      while (simSeconds < seconds) {
        const fadeIn = smoothstep(
          FADE_IN_START_S,
          FADE_IN_START_S + FADE_IN_DURATION_S,
          simSeconds,
        );
        stepChain(
          chain,
          simSeconds / DEPTH_SLOWDOWN,
          STEP_S / DEPTH_SLOWDOWN,
          fadeIn,
        );
        simSeconds += STEP_S;
      }

      drawAtlas(ctx, letters, layout, cell, seconds);
      renderer.draw(atlas, buildQuads(chain, layout, cell, seconds));
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(row);
    measure();

    // Canvas text can't swap fonts later, so wait for Space Mono first.
    document.fonts.load(layout!.font).finally(() => {
      if (disposed) return;
      fontReady = true;
      measure();
    });
    raf = requestAnimationFrame(frame);

    // iOS can drop WebGL state when the page is backgrounded; rebuild on return.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      renderer = null;
    };
    const onContextRestored = () => {
      renderer = createRenderer(canvas);
      if (!renderer) setWebglFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer?.dispose();
    };
  }, [reduceMotion, webglFailed, word]);

  if (reduceMotion || webglFailed) {
    return chars.map((char, i) => (
      <FloatingLetter key={i} char={char} index={i} still={!!reduceMotion} />
    ));
  }

  return (
    <>
      {/* Invisible copy keeps the layout and tells the canvas where letters go.
          inline-block: ResizeObserver ignores size changes of inline boxes. */}
      <span
        ref={rowRef}
        aria-hidden="true"
        className="invisible inline-block whitespace-nowrap"
      >
        {chars.map((char, i) => (
          <span key={i} className="inline-block">
            {char}
          </span>
        ))}
      </span>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute"
      />
    </>
  );
}

/* ---- Layout ---- */

type Layout = {
  dpr: number;
  font: string;
  baseline: number;
  word: { x: number; y: number; width: number; height: number };
  letters: { x: number; y: number; width: number; height: number }[];
};

// Where the invisible DOM copy put each letter, so the canvas draws them at
// exactly the same spots. Offsets, not getBoundingClientRect: they ignore
// the title's intro scale.
function measureLayout(
  row: HTMLSpanElement,
  ctx: CanvasRenderingContext2D,
): Layout {
  const style = getComputedStyle(row);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.font = font;
  const metrics = ctx.measureText(row.textContent ?? "");
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize);
  const letterEls = [...row.children] as HTMLElement[];
  const word = {
    x: letterEls[0].offsetLeft,
    y: letterEls[0].offsetTop,
    width: row.offsetWidth,
    height: lineHeight,
  };

  return {
    dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
    font,
    // CSS half-leading: glyphs sit centred in the line box.
    baseline: (lineHeight - (ascent + descent)) / 2 + ascent,
    word,
    letters: letterEls.map((el) => ({
      x: el.offsetLeft - word.x,
      y: el.offsetTop - word.y,
      width: el.offsetWidth,
      height: el.offsetHeight,
    })),
  };
}

/* ---- The chain ---- */

type Chain = { z: number[]; velocity: number[] };

function createChain(count: number): Chain {
  return { z: Array(count).fill(0), velocity: Array(count).fill(0) };
}

// How far back the pull points want each letter right now (chain time).
function pullTargets(count: number, seconds: number) {
  const loop = count - 1 + PULL_MARGIN * 2;
  const points = PULL_POINTS.map((p) => {
    const travelled =
      p.direction *
        (p.speed * seconds +
          p.wobble *
            Math.sin((2 * Math.PI * seconds) / p.wobblePeriod + p.phase)) +
      p.offset * loop;
    const strengthWave =
      0.5 +
      0.5 *
        Math.sin((2 * Math.PI * seconds) / p.strengthPeriod + p.phase * 1.7);
    return {
      position: (((travelled % loop) + loop) % loop) - PULL_MARGIN,
      strength: PULL_MIN_STRENGTH + (1 - PULL_MIN_STRENGTH) * strengthWave,
    };
  });

  return Array.from({ length: count }, (_, i) =>
    points.reduce(
      (sum, p) =>
        sum +
        PULL_DEPTH *
          p.strength *
          Math.exp(-(((i - p.position) / PULL_WIDTH) ** 2)),
      0,
    ),
  );
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

// `seconds` and `dt` are chain time; fadeIn (0-1) comes from real time.
function stepChain(chain: Chain, seconds: number, dt: number, fadeIn: number) {
  const { z, velocity } = chain;
  const targets = pullTargets(z.length, seconds);

  // Forces from the current positions, then integrate (semi-implicit Euler).
  const forces = z.map((zi, i) => {
    let force =
      REST_STIFFNESS * (fadeIn * targets[i] - zi) - DAMPING * velocity[i];
    if (i > 0) force += NEIGHBOR_STIFFNESS * (z[i - 1] - zi);
    if (i < z.length - 1) force += NEIGHBOR_STIFFNESS * (z[i + 1] - zi);
    return force;
  });

  forces.forEach((force, i) => {
    velocity[i] += force * dt;
    z[i] += velocity[i] * dt;
  });
}

/* ---- Drawing ---- */

type Cell = { width: number; height: number };

// One letter per atlas cell, centred, with its 2D float rotation baked in.
function drawAtlas(
  ctx: CanvasRenderingContext2D,
  letters: string[],
  layout: Layout,
  cell: Cell,
  seconds: number,
) {
  const { dpr, font, baseline, letters: boxes } = layout;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = font;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";

  boxes.forEach((box, i) => {
    const { r0, r1, duration } = letterFloat(i);
    const rotate = sampleMirrored([r0, r1], duration, seconds);
    ctx.save();
    ctx.translate(cell.width * i + cell.width / 2, cell.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.fillText(letters[i], -box.width / 2, -box.height / 2 + baseline);
    ctx.restore();
  });
}

type Quad = {
  center: [number, number];
  half: [number, number];
  cell: [number, number, number, number];
  radius: number;
};

// Project each letter by its depth and order the quads far to near.
function buildQuads(
  chain: Chain,
  layout: Layout,
  cell: Cell,
  seconds: number,
): Quad[] {
  const { dpr, word, letters: boxes } = layout;
  const wordCx = CANVAS_PAD_PX + word.width / 2;
  const wordCy = CANVAS_PAD_PX + word.height / 2;
  const count = boxes.length;

  return boxes
    .map((box, i) => {
      const z = Math.min(Math.max(chain.z[i], 0), 1.1);
      const scale = 1 - (1 - MIN_SCALE) * z;
      const pull = 1 - (1 - scale) * CONVERGENCE;
      const { y0, y1, duration } = letterFloat(i);
      const floatY = sampleMirrored([y0, y1], duration, seconds);
      const cx = CANVAS_PAD_PX + box.x + box.width / 2;
      const cy = CANVAS_PAD_PX + box.y + box.height / 2;
      return {
        z,
        quad: {
          center: [
            (wordCx + (cx - wordCx) * pull) * dpr,
            (wordCy + (cy - wordCy) * pull + floatY * scale) * dpr,
          ],
          half: [
            ((cell.width * scale) / 2) * dpr,
            ((cell.height * scale) / 2) * dpr,
          ],
          cell: [i / count, 0, (i + 1) / count, 1],
          // Radius is in atlas pixels, which the quad shrinks by `scale`.
          radius: (MAX_RADIUS_PX * z * dpr) / scale,
        } satisfies Quad,
      };
    })
    .sort((a, b) => b.z - a.z)
    .map(({ quad }) => quad);
}

function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl || gl.isContextLost()) return null;

  const program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  if (!program) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Premultiplied "over": nearer letters drawn later cover farther ones.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const uniforms = {
    canvas: gl.getUniformLocation(program, "u_canvas"),
    center: gl.getUniformLocation(program, "u_center"),
    half: gl.getUniformLocation(program, "u_half"),
    cell: gl.getUniformLocation(program, "u_cell"),
    atlasSize: gl.getUniformLocation(program, "u_atlasSize"),
    radius: gl.getUniformLocation(program, "u_radius"),
  };

  return {
    draw(atlas: HTMLCanvasElement, quads: Quad[]) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlas,
      );
      gl.uniform2f(uniforms.canvas, canvas.width, canvas.height);
      gl.uniform2f(uniforms.atlasSize, atlas.width, atlas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const quad of quads) {
        gl.uniform2fv(uniforms.center, quad.center);
        gl.uniform2fv(uniforms.half, quad.half);
        gl.uniform4fv(uniforms.cell, quad.cell);
        gl.uniform1f(uniforms.radius, quad.radius);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    },
    // Free GPU resources but keep the context: the same canvas may mount
    // again (React dev double-mount) and getContext would return a lost one.
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

function linkProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}
