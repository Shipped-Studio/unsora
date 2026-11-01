import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "./ai-client";
import {
  badTakesPrompt,
  captionScenesPrompt,
} from "../../prompts/subtitle-tools.prompt";

/**
 * The subtitle editor's AI Tools, as in Submagic: passes that clean the
 * audio, cut pauses and repeated takes, and split the video into scenes
 * with a zoom each. The ffmpeg parts run in Trigger.dev workers only.
 */

export const AI_TOOLS = [
  "clean-audio",
  "remove-silence",
  "remove-bad-takes",
  "auto-zooms",
  "eye-contact",
] as const;
export type AiTool = (typeof AI_TOOLS)[number];

/** Credits each tool spends, as in Submagic. */
export const AI_TOOL_CREDITS: Record<AiTool, number> = {
  "auto-zooms": 1,
  "clean-audio": 2,
  "remove-silence": 2,
  "eye-contact": 3,
  "remove-bad-takes": 2,
};

/** Tools that change the video and run as a background job. */
export const VIDEO_TOOLS: AiTool[] = ["clean-audio", "remove-silence", "remove-bad-takes"];

export const isAiTool = (value: string): value is AiTool =>
  (AI_TOOLS as readonly string[]).includes(value);

export interface ToolWord {
  word: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface ToolChunk {
  text: string;
  start: number;
  end: number;
  words: ToolWord[];
  [key: string]: unknown;
}

export type Range = [number, number];

// Pauses longer than this are cut, leaving this much on each side.
const SILENCE_SECONDS = 0.6;
const SILENCE_PADDING = 0.15;

/** The parts of the video to keep when cutting out pauses. */
export function keepRangesWithoutSilence(words: ToolWord[], duration: number): Range[] {
  if (!words.length) return [[0, duration]];
  const keep: Range[] = [];
  let start = Math.max(0, words[0].start - SILENCE_PADDING);
  let end = words[0].end;
  for (const word of words.slice(1)) {
    if (word.start - end > SILENCE_SECONDS) {
      keep.push([start, Math.min(duration, end + SILENCE_PADDING)]);
      start = Math.max(0, word.start - SILENCE_PADDING);
    }
    end = Math.max(end, word.end);
  }
  keep.push([start, Math.min(duration, end + SILENCE_PADDING)]);
  return keep;
}

/** Turns the ranges to drop into the ranges to keep. */
export function invertRanges(remove: Range[], duration: number): Range[] {
  const sorted = [...remove].sort((a, b) => a[0] - b[0]);
  const keep: Range[] = [];
  let at = 0;
  for (const [start, end] of sorted) {
    if (start > at) keep.push([at, start]);
    at = Math.max(at, end);
  }
  if (at < duration) keep.push([at, duration]);
  return keep.filter(([a, b]) => b - a > 0.05);
}

/** Asks the AI which caption lines are failed takes that a later line repeats. */
export async function findBadTakes(chunks: ToolChunk[], duration: number): Promise<Range[]> {
  if (chunks.length < 2) return [];
  const { object } = await generateObject({
    model: openrouter("openai/gpt-4o-mini"),
    schema: z.object({ badLines: z.array(z.number().int()) }),
    prompt: badTakesPrompt(chunks.map((c, i) => `${i}: ${c.text}`).join("\n")),
  });
  // The AI over-flags, so a line only counts when a line soon after says
  // most of the same words again.
  const bad = new Set(
    object.badLines.filter(
      (i) => i >= 0 && i < chunks.length && isRetaken(chunks, i),
    ),
  );
  // A cut runs from the line's start to where the next kept line starts.
  return [...bad].map((i) => {
    let next = i + 1;
    while (bad.has(next)) next++;
    return [chunks[i].start, chunks[next]?.start ?? duration] as Range;
  });
}

// A retake repeats at least this share of a line's words within this many lines.
const RETAKE_OVERLAP = 0.6;
const RETAKE_WINDOW = 3;

const contentWords = (text: string) =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}']/gu, ""))
    .filter((w) => w.length > 2);

function isRetaken(chunks: ToolChunk[], i: number): boolean {
  const words = contentWords(chunks[i].text);
  if (!words.length) return false;
  const after = chunks.slice(i + 1, i + 1 + RETAKE_WINDOW).map((c) => new Set(contentWords(c.text)));
  return after.some(
    (next) => words.filter((w) => next.has(w)).length / words.length >= RETAKE_OVERLAP,
  );
}

/** Moves every caption onto the cut video's timeline; dropped words go. */
export function retimeChunks<C extends ToolChunk>(chunks: C[], keep: Range[]): C[] {
  const map = (t: number): number | null => {
    let removedBefore = 0;
    let at = 0;
    for (const [start, end] of keep) {
      removedBefore += start - at;
      if (t < start) return null;
      if (t <= end) return t - removedBefore;
      at = end;
    }
    return null;
  };
  return chunks.flatMap((chunk) => {
    const words = chunk.words.flatMap((word) => {
      const start = map(word.start);
      const end = map(word.end) ?? (start !== null ? start + (word.end - word.start) : null);
      return start === null || end === null ? [] : [{ ...word, start, end }];
    });
    if (!words.length) return [];
    return [
      {
        ...chunk,
        words,
        text: words.map((w) => w.word).join(" "),
        start: words[0].start,
        end: words[words.length - 1].end,
      },
    ];
  });
}

function getFfmpeg() {
  const { ffmpeg } = require("./ffmpeg-config") as typeof import("./ffmpeg-config");
  return ffmpeg;
}

function run(command: ReturnType<ReturnType<typeof getFfmpeg>>): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on("error", (error: Error) => reject(error))
      .on("end", () => resolve())
      .run();
  });
}

/** Keeps only the given ranges of the video, re-encoding so cuts are frame exact. */
export async function cutVideo(input: string, output: string, keep: Range[]) {
  const between = keep
    .map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`)
    .join("+");
  await run(
    getFfmpeg()(input)
      .videoFilters([`select='${between}'`, "setpts=N/FRAME_RATE/TB"])
      .audioFilters([`aselect='${between}'`, "asetpts=N/SR/TB"])
      .outputOptions(["-c:v libx264", "-preset veryfast", "-crf 20", "-c:a aac", "-movflags +faststart"])
      .output(output),
  );
}

/** Denoises and evens out the speech; the picture is copied as is. */
export async function cleanAudio(input: string, output: string) {
  await run(
    getFfmpeg()(input)
      .audioFilters([
        "highpass=f=80",
        "lowpass=f=12000",
        "afftdn=nr=12:nf=-35",
        "dynaudnorm=f=150:g=15",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
      ])
      .outputOptions(["-c:v copy", "-c:a aac", "-b:a 192k", "-movflags +faststart"])
      .output(output),
  );
}

export interface CaptionScene {
  start: number;
  end: number;
  /** What the scene is about, for picking B-roll. */
  keyword: string;
  /** A short stock-footage search for the scene. */
  brollQuery: string;
  /** Suggested zoom, as a zoom id, or null for none. */
  zoom: string | null;
}

const ZOOM_IDS = [
  "zoom-fast", "crash-zoom", "expo-zoom", "crash-zoom-out", "smooth-zoom-in",
  "fast-snap", "fast-hold", "smooth-pulse", "smooth-hold", "quick-in",
  "ramp-ease", "steady-hold", "steady-ease", "steady-snap", "smooth-in",
  "smooth-out", "steady-in", "steady-out", "camera-shake", "slide-top",
  "slide-bottom", "slide-left", "slide-right",
];

/** Splits the video into scenes by topic, each with a zoom and a B-roll search. */
export async function findScenes(chunks: ToolChunk[], duration: number): Promise<CaptionScene[]> {
  if (!chunks.length) return [];
  const { object } = await generateObject({
    model: openrouter("openai/gpt-4o-mini"),
    schema: z.object({
      scenes: z.array(
        z.object({
          firstLine: z.number().int(),
          keyword: z.string(),
          brollQuery: z.string(),
          zoom: z.string().nullable(),
        }),
      ),
    }),
    prompt: captionScenesPrompt(
      chunks.map((c, i) => `${i} [${c.start.toFixed(1)}s]: ${c.text}`).join("\n"),
      ZOOM_IDS,
    ),
  });
  const starts = [...new Set(object.scenes.map((s) => s.firstLine))]
    .filter((i) => i >= 0 && i < chunks.length)
    .sort((a, b) => a - b);
  if (!starts.length || starts[0] !== 0) starts.unshift(0);
  const byLine = new Map(object.scenes.map((s) => [s.firstLine, s]));
  return starts.map((line, i) => {
    const scene = byLine.get(line);
    const next = starts[i + 1];
    return {
      start: i === 0 ? 0 : chunks[line].start,
      end: next !== undefined ? chunks[next].start : duration,
      keyword: (scene?.keyword ?? chunks[line].text).slice(0, 80),
      brollQuery: (scene?.brollQuery ?? chunks[line].text).slice(0, 80),
      zoom: scene?.zoom && ZOOM_IDS.includes(scene.zoom) ? scene.zoom : null,
    };
  });
}
