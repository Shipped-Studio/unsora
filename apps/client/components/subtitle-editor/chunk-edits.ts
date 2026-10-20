import type {
  KeywordLevel,
  SubtitleChunk,
  WordEffect,
  WordTimestamp,
} from "@/remotion/types";
import type { WordSound } from "@/components/subtitle-editor/caption-style";

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

export function withWordSound(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  sound: WordSound | undefined,
): SubtitleChunk[] {
  const words = chunks[c].words.map((word, i) =>
    i === w ? { ...word, sound } : word,
  );
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

export function setWordKeyword(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  keyword: KeywordLevel | undefined,
): SubtitleChunk[] {
  const words = chunks[c].words.map((word, i) =>
    i === w ? { ...word, keyword } : word,
  );
  return replaceChunk(chunks, c, withWords(chunks[c], words));
}

/** Sets keywords and emojis on every word, by the word's place in the transcript. */
export function applyCaptionMarkup(
  chunks: SubtitleChunk[],
  markup: {
    keywords: { index: number; level: KeywordLevel }[];
    emojis: { index: number; emoji: string }[];
  },
): SubtitleChunk[] {
  const keywords = new Map(markup.keywords.map((k) => [k.index, k.level]));
  const emojis = new Map(markup.emojis.map((e) => [e.index, e.emoji]));
  let index = 0;
  return chunks.map((chunk) => ({
    ...chunk,
    words: chunk.words.map((word) => {
      const i = index++;
      return { ...word, keyword: keywords.get(i), emoji: emojis.get(i) };
    }),
  }));
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

/** Moves words up to and including word `w` to the end of the line before it. */
export function moveToPreviousLine(
  chunks: SubtitleChunk[],
  c: number,
  w = 0,
): SubtitleChunk[] {
  if (c === 0) return chunks;
  const moving = chunks[c].words.slice(0, w + 1).map((word) => ({
    ...word,
    lineBreak: false,
  }));
  const rest = chunks[c].words.slice(w + 1);
  const previous = chunks[c - 1];
  const previousWords = previous.words.map((word, i, all) =>
    i === all.length - 1 ? { ...word, lineBreak: false } : word,
  );
  return replaceChunk(
    replaceChunk(chunks, c, withWords(chunks[c], rest)),
    c - 1,
    withWords(previous, [...previousWords, ...moving]),
  );
}

/**
 * Moves word `w` of line `c` into line `toC` before its word `toW` (or to
 * the end). The word keeps its timing; a line left empty is dropped.
 */
export function moveWord(
  chunks: SubtitleChunk[],
  c: number,
  w: number,
  toC: number,
  toW: number,
): SubtitleChunk[] {
  if (c === toC && (toW === w || toW === w + 1)) return chunks;
  const word = { ...chunks[c].words[w], lineBreak: false };
  const withoutWord = chunks.map((chunk, i) =>
    i === c ? withWords(chunk, chunk.words.filter((_, j) => j !== w)) : chunk,
  );
  const target = withoutWord[toC];
  const at = c === toC && toW > w ? toW - 1 : toW;
  const words = [...target.words.slice(0, at), word, ...target.words.slice(at)];
  return withoutWord
    .map((chunk, i) => (i === toC ? withWords(chunk, words) : chunk))
    .filter((chunk) => chunk.words.length > 0);
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

/** A line's own settings from the line menu. */
export type LineSettings = Pick<
  SubtitleChunk,
  "size" | "positionY" | "style" | "emphasize"
>;
const LINE_SETTING_KEYS = ["size", "positionY", "style", "emphasize"] as const;

export function setLine(
  chunks: SubtitleChunk[],
  c: number,
  patch: Partial<Pick<SubtitleChunk, "hidden" | "emoji"> & LineSettings>,
): SubtitleChunk[] {
  return chunks.map((chunk, i) => (i === c ? { ...chunk, ...patch } : chunk));
}

function withoutSettings(chunk: SubtitleChunk): SubtitleChunk {
  const next = { ...chunk };
  for (const key of LINE_SETTING_KEYS) delete next[key];
  return next;
}

/** Gives every line line `c`'s size, position, style and emphasis. */
export function applyLineToAll(chunks: SubtitleChunk[], c: number): SubtitleChunk[] {
  const settings: LineSettings = {};
  for (const key of LINE_SETTING_KEYS) {
    if (chunks[c][key] !== undefined) Object.assign(settings, { [key]: chunks[c][key] });
  }
  return chunks.map((chunk) => ({ ...withoutSettings(chunk), ...settings }));
}

export function resetLine(chunks: SubtitleChunk[], c: number): SubtitleChunk[] {
  return chunks.map((chunk, i) => (i === c ? withoutSettings(chunk) : chunk));
}

export function resetAllLines(chunks: SubtitleChunk[]): SubtitleChunk[] {
  return chunks.map(withoutSettings);
}

/** Adds a placeholder word at the end of line `c`. */
export function addWordAtEnd(chunks: SubtitleChunk[], c: number): SubtitleChunk[] {
  const words = chunks[c].words;
  if (!words.length) {
    const chunk = chunks[c];
    return replaceChunk(
      chunks,
      c,
      withWords(chunk, [
        { word: "word", start: chunk.start, end: Math.max(chunk.end, chunk.start + NEW_WORD_SECONDS) },
      ]),
    );
  }
  return addWordAfter(chunks, c, words.length - 1);
}

/** Spreads a line's time over new words by their length. */
function retime(words: string[], start: number, end: number): WordTimestamp[] {
  const weights = words.map((w) => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let at = start;
  return words.map((word, i) => {
    const length = ((end - start) * weights[i]) / total;
    const timed = { word, start: at, end: at + length };
    at += length;
    return timed;
  });
}

/**
 * Gives each line new words. A line that keeps its word count keeps each
 * word's timing and marks; otherwise its time is spread over the new words.
 */
export function replaceLineWords(
  chunks: SubtitleChunk[],
  lines: string[][],
): SubtitleChunk[] {
  return chunks.map((chunk, c) => {
    const next = lines[c]?.filter(Boolean);
    if (!next?.length) return chunk;
    if (next.length === chunk.words.length) {
      return withWords(
        chunk,
        chunk.words.map((word, w) =>
          word.word === next[w]
            ? word
            : { ...word, word: next[w], punctuation: "" },
        ),
      );
    }
    return withWords(chunk, retime(next, chunk.start, chunk.end));
  });
}

const comparable = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");

/** Where a word or phrase occurs, as line and first-word indexes. */
export function findPhrase(
  chunks: SubtitleChunk[],
  phrase: string,
): { c: number; w: number; length: number }[] {
  const needle = phrase.split(/\s+/).map(comparable).filter(Boolean);
  if (!needle.length) return [];
  const found: { c: number; w: number; length: number }[] = [];
  chunks.forEach((chunk, c) => {
    for (let w = 0; w + needle.length <= chunk.words.length; w++) {
      if (needle.every((part, k) => comparable(chunk.words[w + k].word) === part)) {
        found.push({ c, w, length: needle.length });
      }
    }
  });
  return found;
}

/** Replaces every match of a word or phrase across the transcript. */
export function replacePhrase(
  chunks: SubtitleChunk[],
  phrase: string,
  replacement: string,
): SubtitleChunk[] {
  const matches = findPhrase(chunks, phrase);
  if (!matches.length) return chunks;
  const words = replacement.split(/\s+/).filter(Boolean);
  // Right to left, so earlier indexes stay valid.
  return [...matches].reverse().reduce((list, { c, w, length }) => {
    const chunk = list[c];
    const span = chunk.words.slice(w, w + length);
    const last = span[span.length - 1];
    const timed = words.length
      ? retime(words, span[0].start, last.end).map((word, i) => ({
          ...(i < span.length ? span[i] : {}),
          ...word,
          punctuation: i === words.length - 1 ? last.punctuation : "",
        }))
      : [];
    const next = [...chunk.words.slice(0, w), ...timed, ...chunk.words.slice(w + length)];
    return replaceChunk(list, c, withWords(chunk, next));
  }, chunks);
}
