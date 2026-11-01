"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "motion/react";

import { FloatingLetter, letterFloat, sampleMirrored } from "./floating";

const MAX_RADIUS_PX = 9;
const MIN_SCALE = 0.86;
const CONVERGENCE = 0.5;
const MAX_DPR = 2;
const TAPS = 128;
const INK = 0.04;
const CELL_PAD_PX = Math.ceil(MAX_RADIUS_PX / MIN_SCALE) + 4;
const CANVAS_PAD_PX = MAX_RADIUS_PX + 12;

const NEIGHBOR_STIFFNESS = 5;
const REST_STIFFNESS = 2.7;
const DAMPING = 3.25;

// Keep wobble * 2π / wobblePeriod < speed so a point never stops and the blur
// never stalls.
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
const PULL_DEPTH = 1.6;
const PULL_WIDTH = 0.7;
const PULL_MIN_STRENGTH = 0.7;
const PULL_MARGIN = 1;
const DEPTH_SLOWDOWN = 2;
const FADE_IN_START_S = 1.5;
const FADE_IN_DURATION_S = 1.5;
const STEP_S = 1 / 120;

const VERTEX_SHADER = `
attribute vec2 a_pos;
uniform vec2 u_canvas;
uniform vec2 u_center;
uniform vec2 u_half;
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
uniform vec4 u_cell;
uniform vec2 u_atlasSize;
uniform float u_radius;

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
    float sum = 0.0;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float dist = sqrt(fi / float(TAPS)) * u_radius;
      float angle = fi * GOLDEN_ANGLE;
      sum += texture2D(u_atlas, uv + vec2(cos(angle), sin(angle)) * dist / u_atlasSize).a;
    }
    a = sum / float(TAPS);
  }

  // Average light, not ink, so defocused strokes look airy rather than muddy.
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

    // Canvas text can't swap fonts later, so wait for the font first.
    document.fonts.load(layout!.font).finally(() => {
      if (disposed) return;
      fontReady = true;
      measure();
    });
    raf = requestAnimationFrame(frame);

    // iOS can drop WebGL state in the background.
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
      {/* inline-block: ResizeObserver ignores size changes of inline boxes. */}
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

type Layout = {
  dpr: number;
  font: string;
  baseline: number;
  word: { x: number; y: number; width: number; height: number };
  letters: { x: number; y: number; width: number; height: number }[];
};

// Offsets, not getBoundingClientRect: they ignore the title's intro scale.
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

type Chain = { z: number[]; velocity: number[] };

function createChain(count: number): Chain {
  return { z: Array(count).fill(0), velocity: Array(count).fill(0) };
}

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

function stepChain(chain: Chain, seconds: number, dt: number, fadeIn: number) {
  const { z, velocity } = chain;
  const targets = pullTargets(z.length, seconds);

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

type Cell = { width: number; height: number };

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
    // Keep the context: a dev double-mount reuses the canvas, and a lost
    // context can't be recreated.
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
