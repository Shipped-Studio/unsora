/**
 * How a transcript is cut into captions for a style: how many words are on
 * screen at once, how they wrap onto rows, and which keywords are shown on
 * their own. Pure functions, no imports.
 *
 * Identical copies live in apps/client/components/subtitle-editor,
 * apps/remotion/src and apps/server/src/lib. Change all three together.
 */

export type KeywordLevel = 1 | 2 | 3;

/** The parts of a word the layout reads. Other fields are carried along. */
export interface LayoutWord {
  word: string;
  start: number;
  end: number;
  /** Punctuation the speaker's sentence had after this word. */
  punctuation?: string;
  /** Start a new row on screen after this word. */
  lineBreak?: boolean;
  /** 1 is the most important word in its sentence; 3 the least. */
  keyword?: KeywordLevel;
}

export interface LayoutChunk<W extends LayoutWord = LayoutWord> {
  text: string;
  start: number;
  end: number;
  words: W[];
  /** A keyword shown on its own, larger. */
  solo?: boolean;
  hidden?: boolean;
  emoji?: string;
}

export interface CaptionLayout {
  /** Most words on screen at once. */
  wordsPerCaption: number;
  /**
   * A caption longer than this many characters wraps onto two rows, and
   * no caption is longer than two such rows.
   */
  maxLineChars: number;
  /** Let a caption wrap onto a second row. */
  breakLines: boolean;
  /** Make both rows about the same length. */
  balancedRows: boolean;
  /** Always use two rows when a caption has more than one word. */
  twoRows: boolean;
  /** Show a keyword alone about every this many captions; 0 never does. */
  soloEvery: number;
  /** At least this many captions between two solo keywords. */
  soloMinGap: number;
}

export const CAPTION_LAYOUT_DEFAULTS: CaptionLayout = {
  wordsPerCaption: 3,
  maxLineChars: 15,
  breakLines: true,
  balancedRows: true,
  twoRows: false,
  soloEvery: 0,
  soloMinGap: 2,
};

export const CAPTION_LAYOUT_LIMITS = {
  wordsPerCaption: { min: 1, max: 6 },
  maxLineChars: { min: 6, max: 30 },
  soloEvery: { min: 0, max: 10 },
  soloMinGap: { min: 0, max: 10 },
} as const;

type NumericKey = keyof typeof CAPTION_LAYOUT_LIMITS;
const BOOLEAN_KEYS = ["breakLines", "balancedRows", "twoRows"] as const;

/** Fills in and clamps a stored or requested layout. */
export function normalizeCaptionLayout(raw: unknown): CaptionLayout {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const layout = { ...CAPTION_LAYOUT_DEFAULTS };
  for (const key of Object.keys(CAPTION_LAYOUT_LIMITS) as NumericKey[]) {
    const value = Number(input[key]);
    if (!Number.isFinite(value)) continue;
    const { min, max } = CAPTION_LAYOUT_LIMITS[key];
    layout[key] = Math.min(max, Math.max(min, Math.round(value)));
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof input[key] === "boolean") layout[key] = input[key] as boolean;
  }
  return layout;
}

// A pause this long always ends a caption.
const PAUSE_SECONDS = 0.5;
// A caption is never on screen longer than this, however few its words.
const MAX_CAPTION_SECONDS = 3;
const SENTENCE_END = /[.!?…]/;
const CLAUSE_END = /[,;:—–]/;

// Caption costs. A caption short of the word count costs this per missing
// word, squared, so a phrase is shared out evenly instead of leaving one
// word behind.
const SHORT_CAPTION_COST = 20;
const COMMA_BREAK_BONUS = 30;
const COMMA_INSIDE_COST = 40;
const SINGLE_WORD_COST = 40;
const LEADING_WORD_COST = 60;
// Row choice: how much a row ending on a leading word weighs, in characters.
const LEADING_ROW_END_CHARS = 6;

// Words that read badly at the end of a caption or row.
const LEADING_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "so", "to", "of", "in", "on", "at",
  "for", "with", "from", "by", "as", "if", "my", "your", "our", "their",
  "his", "her", "its",
]);

const bare = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Whisper's word timestamps carry no punctuation, but the full transcript
 * does. Walks both in order and sets each word's punctuation ("" when it
 * can't be matched, e.g. languages written without spaces). Words that
 * already have it are kept.
 */
export function attachPunctuation<W extends LayoutWord>(
  words: W[],
  transcript: string,
): W[] {
  const tokens = transcript.split(/\s+/).filter(Boolean);
  let t = 0;
  return words.map((word) => {
    if (word.punctuation !== undefined) return word;
    const target = bare(word.word);
    for (let k = t; k < Math.min(t + 5, tokens.length); k++) {
      if (bare(tokens[k]) === target) {
        t = k + 1;
        const punctuation = tokens[k].match(/[^\p{L}\p{N}']+$/u)?.[0] ?? "";
        return { ...word, punctuation };
      }
    }
    return { ...word, punctuation: "" };
  });
}

const length = (words: LayoutWord[]) =>
  words.reduce((n, w) => n + w.word.trim().length, 0) + words.length - 1;

function fits(words: LayoutWord[], layout: CaptionLayout): boolean {
  if (words.length === 1) return true;
  if (words.length > layout.wordsPerCaption) return false;
  if (words[words.length - 1].end - words[0].start > MAX_CAPTION_SECONDS) {
    return false;
  }
  return length(words) <= layout.maxLineChars * 2 + 1;
}

function captionCost(
  words: LayoutWord[],
  layout: CaptionLayout,
  endsPhrase: boolean,
): number {
  const last = words[words.length - 1];
  const breaksAtComma = CLAUSE_END.test(last.punctuation ?? "");
  let cost =
    Math.max(0, layout.wordsPerCaption - words.length) ** 2 *
    SHORT_CAPTION_COST;
  if (breaksAtComma) cost -= COMMA_BREAK_BONUS;
  cost +=
    words.slice(0, -1).filter((w) => CLAUSE_END.test(w.punctuation ?? ""))
      .length * COMMA_INSIDE_COST;
  if (words.length === 1 && layout.wordsPerCaption > 1 && !breaksAtComma) {
    cost += SINGLE_WORD_COST;
  }
  if (!endsPhrase && LEADING_WORDS.has(bare(last.word))) {
    cost += LEADING_WORD_COST;
  }
  return cost;
}

/** Cuts a run of words into the captions with the lowest total cost. */
function captionRanges(
  words: LayoutWord[],
  layout: CaptionLayout,
): [number, number][] {
  const n = words.length;
  const best = [0, ...Array<number>(n).fill(Infinity)];
  const from = Array<number>(n + 1).fill(0);
  for (let end = 1; end <= n; end++) {
    for (let start = end - 1; start >= 0; start--) {
      const caption = words.slice(start, end);
      // Longer captions only get bigger, so stop at the first that doesn't fit.
      if (!fits(caption, layout)) break;
      const cost = best[start] + captionCost(caption, layout, end === n);
      if (cost < best[end]) {
        best[end] = cost;
        from[end] = start;
      }
    }
  }
  const ranges: [number, number][] = [];
  for (let end = n; end > 0; end = from[end]) ranges.unshift([from[end], end]);
  return ranges;
}

/** Where a caption's second row starts, or -1 for a single row. */
function rowBreak(words: LayoutWord[], layout: CaptionLayout): number {
  const n = words.length;
  if (n < 2) return -1;
  if (!layout.twoRows && (!layout.breakLines || length(words) <= layout.maxLineChars)) {
    return -1;
  }

  const options: { at: number; spread: number; fills: boolean }[] = [];
  for (let at = 1; at < n; at++) {
    const top = length(words.slice(0, at));
    const bottom = length(words.slice(at));
    options.push({
      at,
      spread:
        Math.abs(top - bottom) +
        (LEADING_WORDS.has(bare(words[at - 1].word)) ? LEADING_ROW_END_CHARS : 0),
      fills: top <= layout.maxLineChars,
    });
  }

  if (!layout.balancedRows && !layout.twoRows) {
    // The first row takes as many words as fit.
    const filling = options.filter((o) => o.fills);
    if (filling.length) return filling[filling.length - 1].at;
  }
  return options.reduce((a, b) => (b.spread < a.spread ? b : a)).at;
}

function buildChunk<W extends LayoutWord>(
  words: W[],
  layout: CaptionLayout,
  solo: boolean,
): LayoutChunk<W> {
  const breakAt = solo ? -1 : rowBreak(words, layout);
  const laidOut = words.map((word, i) => ({
    ...word,
    lineBreak: i === breakAt - 1,
  }));
  return {
    text: laidOut.map((w) => w.word).join(" "),
    start: laidOut[0].start,
    end: laidOut[laidOut.length - 1].end,
    words: laidOut,
    ...(solo ? { solo: true } : {}),
  };
}

/** Splits words into captions for a layout. */
export function splitIntoCaptions<W extends LayoutWord>(
  words: W[],
  rawLayout: Partial<CaptionLayout>,
): LayoutChunk<W>[] {
  const layout = normalizeCaptionLayout(rawLayout);

  // Phrases end at sentence ends and pauses; no caption crosses one.
  const phrases: W[][] = [];
  let current: W[] = [];
  for (const word of words) {
    const prev = current[current.length - 1];
    if (prev && word.start - prev.end >= PAUSE_SECONDS) {
      phrases.push(current);
      current = [];
    }
    current.push(word);
    if (SENTENCE_END.test(word.punctuation ?? "")) {
      phrases.push(current);
      current = [];
    }
  }
  if (current.length) phrases.push(current);

  const chunks: LayoutChunk<W>[] = [];
  let sinceSolo = Infinity;

  const emit = (run: W[]) => {
    if (!run.length) return;
    if (layout.soloEvery > 0) {
      for (let k = 0; k < run.length; k++) {
        // Only the stronger keywords are worth a caption of their own.
        if (!run[k].keyword || run[k].keyword! > 2) continue;
        const before = captionRanges(run.slice(0, k), layout);
        const gap = sinceSolo + before.length;
        if (gap < layout.soloMinGap || gap + 1 < layout.soloEvery) continue;
        for (const [s, e] of before) {
          chunks.push(buildChunk(run.slice(s, e), layout, false));
        }
        chunks.push(buildChunk([run[k]], layout, true));
        sinceSolo = 0;
        emit(run.slice(k + 1));
        return;
      }
    }
    const ranges = captionRanges(run, layout);
    for (const [s, e] of ranges) {
      chunks.push(buildChunk(run.slice(s, e), layout, false));
    }
    sinceSolo += ranges.length;
  };

  phrases.forEach(emit);
  return chunks;
}

/**
 * Re-cuts existing captions for a new layout. Word edits are kept. A new
 * caption takes its line settings (size, position, style, emphasis) from the
 * line its first word came from; it's hidden only if all its words were, and
 * a line's emoji moves with the line's first word.
 */
export function resplitChunks<C extends LayoutChunk>(
  chunks: C[],
  layout: Partial<CaptionLayout>,
): C[] {
  type W = C["words"][number];
  const owner = new Map<W, C>();
  const words: W[] = [];
  for (const chunk of chunks) {
    for (const word of chunk.words) {
      owner.set(word, chunk);
      words.push(word);
    }
  }
  // Laying out copies the words, so they're matched back by position.
  let index = 0;
  return splitIntoCaptions(words, layout).map((chunk) => {
    const originals = words.slice(index, index + chunk.words.length);
    index += chunk.words.length;
    const sources = originals.map((word) => owner.get(word));
    const emoji = originals
      .map((word, i) => (sources[i]?.words[0] === word ? sources[i]?.emoji : undefined))
      .find(Boolean);
    const settings: Record<string, unknown> = { ...sources[0] };
    for (const key of ["text", "start", "end", "words", "solo", "hidden", "emoji"]) {
      delete settings[key];
    }
    return {
      ...settings,
      ...chunk,
      ...(sources.every((source) => source?.hidden) ? { hidden: true } : {}),
      ...(emoji ? { emoji } : {}),
    } as unknown as C;
  });
}

/** True when two caption lists cut the words in the same places. */
export function sameCaptionCuts(a: LayoutChunk[], b: LayoutChunk[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((chunk, i) => {
    const other = b[i];
    if (chunk.words.length !== other.words.length) return false;
    if (Boolean(chunk.solo) !== Boolean(other.solo)) return false;
    return chunk.words.every(
      (word, w) =>
        word.start === other.words[w].start &&
        Boolean(word.lineBreak) === Boolean(other.words[w].lineBreak),
    );
  });
}
