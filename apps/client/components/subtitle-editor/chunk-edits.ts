import type {
  SubtitleChunk,
  WordEffect,
  WordTimestamp,
} from "@/remotion/types";

/**
 * Word-level edits for subtitle lines. Each returns a new chunk list and
 * keeps every touched line's text and times in step with its words.
 */

/** Seconds a newly added word lasts when there's room for it. */
const NEW_WORD_SECONDS = 0.3;

function withWords(chunk: SubtitleChunk, rawWords: WordTimestamp[]): SubtitleChunk {
  if (rawWords.length === 0) return { ...chunk, words: rawWords, text: "" };
  // A break after the last word would only add an empty row.
  const words = rawWords.map((word, i) =>
    i === rawWords.length - 1 && word.lineBreak
      ? { ...word, lineBreak: false }
      : word,
  );
  return {
    ...chunk,
    words,
    text: words.map((w) => w.word).join(" "),
    start: words[0].start,
    end: words[words.length - 1].end,
  };
}

/** Replaces line `c`, dropping it if it has no words left. */
function replaceChunk(
  chunks: SubtitleChunk[],
  c: number,
  ...next: SubtitleChunk[]
): SubtitleChunk[] {
  const kept = next.filter((chunk) => chunk.words.length > 0);
  return [...chunks.slice(0, c), ...kept, ...chunks.slice(c + 1)];
}

export function setWordText(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  text: string,
): SubtitleChunk[] {
  const words = chunks[c].words.map((word, i) =>
    i === w ? { ...word, word: text } : word,
  );
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

export function setWordTiming(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  timing: { start?: number; end?: number },
): SubtitleChunk[] {
  const words = chunks[c].words.map((word, i) => {
    if (i !== w) return word;
    const start = Math.max(0, timing.start ?? word.start);
    const end = Math.max(start, timing.end ?? word.end);
    return { ...word, start, end };
  });
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

export function setWordEffect(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  effect: WordEffect | undefined,
): SubtitleChunk[] {
  const words = chunks[c].words.map((word, i) =>
    i === w ? { ...word, effect } : word,
  );
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

export function toggleLineBreak(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
): SubtitleChunk[] {
  const words = chunks[c].words.map((word, i) =>
    i === w ? { ...word, lineBreak: !word.lineBreak } : word,
  );
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

/** Moves the line's first word to the end of the line before it. */
export function moveToPreviousLine(
  chunks: SubtitleChunk[],
  c: number,
): SubtitleChunk[] {
  if (c === 0) return chunks;
  const [first, ...rest] = chunks[c].words;
  const previous = chunks[c - 1];
  const previousWords = previous.words.map((word, i, all) =>
    i === all.length - 1 ? { ...word, lineBreak: false } : word,
  );
  return replaceChunk(
    replaceChunk(chunks, c, withWords(chunks[c], rest)),
    c - 1,
    withWords(previous, [...previousWords, { ...first, lineBreak: false }]),
  );
}

/** Moves the line's last word to the start of the line after it. */
export function moveToNextLine(
  chunks: SubtitleChunk[],
  c: number,
): SubtitleChunk[] {
  if (c === chunks.length - 1) return chunks;
  const words = chunks[c].words;
  const last = words[words.length - 1];
  const rest = words.slice(0, -1).map((word, i, all) =>
    i === all.length - 1 ? { ...word, lineBreak: false } : word,
  );
  const following = chunks[c + 1];
  const updated = replaceChunk(
    chunks,
    c + 1,
    withWords(following, [{ ...last, lineBreak: false }, ...following.words]),
  );
  return replaceChunk(updated, c, withWords(chunks[c], rest));
}

/** Starts a new line at word `w`. */
export function splitLine(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
): SubtitleChunk[] {
  if (w === 0) return chunks;
  const chunk = chunks[c];
  const before = chunk.words
    .slice(0, w)
    .map((word, i, all) =>
      i === all.length - 1 ? { ...word, lineBreak: false } : word,
    );
  return replaceChunk(
    chunks,
    c,
    withWords(chunk, before),
    // The new line keeps the emoji off; it belongs to the original line.
    withWords({ ...chunk, emoji: undefined }, chunk.words.slice(w)),
  );
}

/** Adds a placeholder word after word `w`, timed into the gap after it. */
export function addWordAfter(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  text = "word",
): SubtitleChunk[] {
  const words = chunks[c].words;
  const current = words[w];
  const nextStart = words[w + 1]?.start ?? chunks[c + 1]?.start;
  const room = nextStart !== undefined ? nextStart - current.end : Infinity;
  const start = current.end;
  const end = start + Math.max(0, Math.min(NEW_WORD_SECONDS, room));
  const next = [
    ...words.slice(0, w + 1),
    { word: text, start, end },
    ...words.slice(w + 1),
  ];
  return replaceChunk(chunks, c, withWords(chunks[c], next));
}

export function removeWord(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
): SubtitleChunk[] {
  const words = chunks[c].words.filter((_, i) => i !== w);
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

export function setLine(
  chunks: SubtitleChunk[],
  c: number,
  patch: Partial<Pick<SubtitleChunk, "hidden" | "emoji">>,
): SubtitleChunk[] {
  return chunks.map((chunk, i) => (i === c ? { ...chunk, ...patch } : chunk));
}
