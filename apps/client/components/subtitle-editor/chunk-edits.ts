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
 *
 * A "chunk" is one caption line. Functions take the line's index in the
 * list (`lineIndex`) and the word's index in that line (`wordIndex`).
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
    text: words.map((word) => word.word).join(" "),
    start: words[0].start,
    end: words[words.length - 1].end,
  };
}

/** Replaces line `lineIndex`, dropping it if it has no words left. */
function replaceChunk(
  chunks: SubtitleChunk[],
  lineIndex: number,
  ...next: SubtitleChunk[]
): SubtitleChunk[] {
  const kept = next.filter((chunk) => chunk.words.length > 0);
  return [...chunks.slice(0, lineIndex), ...kept, ...chunks.slice(lineIndex + 1)];
}

/** Applies `change` to one word, then refreshes its line's text and times. */
function updateWord(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  change: (word: WordTimestamp) => WordTimestamp,
): SubtitleChunk[] {
  const line = chunks[lineIndex];
  const words = line.words.map((word, i) => (i === wordIndex ? change(word) : word));
  return replaceChunk(chunks, lineIndex, withWords(line, words));
}

export function setWordText(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  text: string,
): SubtitleChunk[] {
  return updateWord(chunks, lineIndex, wordIndex, (word) => ({ ...word, word: text }));
}

export function setWordTiming(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  timing: { start?: number; end?: number },
): SubtitleChunk[] {
  return updateWord(chunks, lineIndex, wordIndex, (word) => {
    const start = Math.max(0, timing.start ?? word.start);
    const end = Math.max(start, timing.end ?? word.end);
    return { ...word, start, end };
  });
}

export function setWordEffect(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  effect: WordEffect | undefined,
): SubtitleChunk[] {
  return updateWord(chunks, lineIndex, wordIndex, (word) => ({ ...word, effect }));
}

export function withWordSound(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  sound: WordSound | undefined,
): SubtitleChunk[] {
  return updateWord(chunks, lineIndex, wordIndex, (word) => ({ ...word, sound }));
}

export function setWordKeyword(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  keyword: KeywordLevel | undefined,
): SubtitleChunk[] {
  return updateWord(chunks, lineIndex, wordIndex, (word) => ({ ...word, keyword }));
}

export function toggleLineBreak(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
): SubtitleChunk[] {
  return updateWord(chunks, lineIndex, wordIndex, (word) => ({
    ...word,
    lineBreak: !word.lineBreak,
  }));
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

/** Moves words up to and including `wordIndex` to the end of the line before. */
export function moveToPreviousLine(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex = 0,
): SubtitleChunk[] {
  if (lineIndex === 0) return chunks;
  const line = chunks[lineIndex];
  const moving = line.words.slice(0, wordIndex + 1).map((word) => ({
    ...word,
    lineBreak: false,
  }));
  const rest = line.words.slice(wordIndex + 1);
  const previous = chunks[lineIndex - 1];
  const previousWords = previous.words.map((word, i, all) =>
    i === all.length - 1 ? { ...word, lineBreak: false } : word,
  );
  return replaceChunk(
    replaceChunk(chunks, lineIndex, withWords(line, rest)),
    lineIndex - 1,
    withWords(previous, [...previousWords, ...moving]),
  );
}

/**
 * Moves a word into line `toLine`, before its word `toWord` (or to the end).
 * The word keeps its timing; a line left empty is dropped.
 */
export function moveWord(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  toLine: number,
  toWord: number,
): SubtitleChunk[] {
  const staysPut =
    lineIndex === toLine && (toWord === wordIndex || toWord === wordIndex + 1);
  if (staysPut) return chunks;

  const word = { ...chunks[lineIndex].words[wordIndex], lineBreak: false };
  const withoutWord = chunks.map((chunk, i) =>
    i === lineIndex
      ? withWords(chunk, chunk.words.filter((_, j) => j !== wordIndex))
      : chunk,
  );
  const target = withoutWord[toLine];
  // Taking the word out shifts the later words on its own line back by one.
  const at = lineIndex === toLine && toWord > wordIndex ? toWord - 1 : toWord;
  const words = [...target.words.slice(0, at), word, ...target.words.slice(at)];
  return withoutWord
    .map((chunk, i) => (i === toLine ? withWords(chunk, words) : chunk))
    .filter((chunk) => chunk.words.length > 0);
}

/** Starts a new line at word `wordIndex`. */
export function splitLine(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
): SubtitleChunk[] {
  if (wordIndex === 0) return chunks;
  const line = chunks[lineIndex];
  const before = line.words
    .slice(0, wordIndex)
    .map((word, i, all) =>
      i === all.length - 1 ? { ...word, lineBreak: false } : word,
    );
  return replaceChunk(
    chunks,
    lineIndex,
    withWords(line, before),
    // The new line keeps the emoji off; it belongs to the original line.
    withWords({ ...line, emoji: undefined }, line.words.slice(wordIndex)),
  );
}

/** Adds a placeholder word after `wordIndex`, timed into the gap after it. */
export function addWordAfter(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
  text = "word",
): SubtitleChunk[] {
  const words = chunks[lineIndex].words;
  const current = words[wordIndex];
  const nextStart = words[wordIndex + 1]?.start ?? chunks[lineIndex + 1]?.start;
  const room = nextStart !== undefined ? nextStart - current.end : Infinity;
  const start = current.end;
  const end = start + Math.max(0, Math.min(NEW_WORD_SECONDS, room));
  const next = [
    ...words.slice(0, wordIndex + 1),
    { word: text, start, end },
    ...words.slice(wordIndex + 1),
  ];
  return replaceChunk(chunks, lineIndex, withWords(chunks[lineIndex], next));
}

export function removeWord(
  chunks: SubtitleChunk[],
  lineIndex: number,
  wordIndex: number,
): SubtitleChunk[] {
  const words = chunks[lineIndex].words.filter((_, i) => i !== wordIndex);
  return replaceChunk(chunks, lineIndex, withWords(chunks[lineIndex], words));
}

/** A line's own settings from the line menu. */
export type LineSettings = Pick<
  SubtitleChunk,
  "size" | "positionY" | "style" | "emphasize"
>;
const LINE_SETTING_KEYS = ["size", "positionY", "style", "emphasize"] as const;

export function setLine(
  chunks: SubtitleChunk[],
  lineIndex: number,
  patch: Partial<Pick<SubtitleChunk, "hidden" | "emoji"> & LineSettings>,
): SubtitleChunk[] {
  return chunks.map((chunk, i) => (i === lineIndex ? { ...chunk, ...patch } : chunk));
}

function withoutSettings(chunk: SubtitleChunk): SubtitleChunk {
  const next = { ...chunk };
  for (const key of LINE_SETTING_KEYS) delete next[key];
  return next;
}

/** Gives every line the size, position, style and emphasis of line `lineIndex`. */
export function applyLineToAll(chunks: SubtitleChunk[], lineIndex: number): SubtitleChunk[] {
  const source = chunks[lineIndex];
  const settings: LineSettings = {};
  for (const key of LINE_SETTING_KEYS) {
    if (source[key] !== undefined) Object.assign(settings, { [key]: source[key] });
  }
  return chunks.map((chunk) => ({ ...withoutSettings(chunk), ...settings }));
}

export function resetLine(chunks: SubtitleChunk[], lineIndex: number): SubtitleChunk[] {
  return chunks.map((chunk, i) => (i === lineIndex ? withoutSettings(chunk) : chunk));
}

export function resetAllLines(chunks: SubtitleChunk[]): SubtitleChunk[] {
  return chunks.map(withoutSettings);
}

/** Adds a placeholder word at the end of line `lineIndex`. */
export function addWordAtEnd(chunks: SubtitleChunk[], lineIndex: number): SubtitleChunk[] {
  const line = chunks[lineIndex];
  if (line.words.length) {
    return addWordAfter(chunks, lineIndex, line.words.length - 1);
  }
  const end = Math.max(line.end, line.start + NEW_WORD_SECONDS);
  return replaceChunk(
    chunks,
    lineIndex,
    withWords(line, [{ word: "word", start: line.start, end }]),
  );
}

/** Spreads a line's time over new words by their length. */
function retime(words: string[], start: number, end: number): WordTimestamp[] {
  const weights = words.map((word) => Math.max(1, word.length));
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
  return chunks.map((chunk, lineIndex) => {
    const next = lines[lineIndex]?.filter(Boolean);
    if (!next?.length) return chunk;
    if (next.length === chunk.words.length) {
      return withWords(
        chunk,
        chunk.words.map((word, wordIndex) =>
          word.word === next[wordIndex]
            ? word
            : { ...word, word: next[wordIndex], punctuation: "" },
        ),
      );
    }
    return withWords(chunk, retime(next, chunk.start, chunk.end));
  });
}

const comparable = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");

/** Where a word is: its line, and its place in that line. */
export interface WordPosition {
  lineIndex: number;
  wordIndex: number;
}

/** One place a phrase occurs: its first word, and how many words it spans. */
export interface PhraseMatch extends WordPosition {
  length: number;
}

/** Where a word or phrase occurs across the transcript. */
export function findPhrase(chunks: SubtitleChunk[], phrase: string): PhraseMatch[] {
  const needle = phrase.split(/\s+/).map(comparable).filter(Boolean);
  if (!needle.length) return [];
  const found: PhraseMatch[] = [];
  chunks.forEach((chunk, lineIndex) => {
    for (let wordIndex = 0; wordIndex + needle.length <= chunk.words.length; wordIndex++) {
      const matches = needle.every(
        (part, k) => comparable(chunk.words[wordIndex + k].word) === part,
      );
      if (matches) found.push({ lineIndex, wordIndex, length: needle.length });
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
  return [...matches].reverse().reduce((list, { lineIndex, wordIndex, length }) => {
    const line = list[lineIndex];
    const span = line.words.slice(wordIndex, wordIndex + length);
    const last = span[span.length - 1];
    const timed = words.length
      ? retime(words, span[0].start, last.end).map((word, i) => ({
          ...(i < span.length ? span[i] : {}),
          ...word,
          punctuation: i === words.length - 1 ? last.punctuation : "",
        }))
      : [];
    const next = [
      ...line.words.slice(0, wordIndex),
      ...timed,
      ...line.words.slice(wordIndex + length),
    ];
    return replaceChunk(list, lineIndex, withWords(line, next));
  }, chunks);
}
