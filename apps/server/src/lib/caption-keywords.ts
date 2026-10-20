import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "./ai-client";
import { captionKeywordsPrompt } from "../../prompts/caption-keywords.prompt";
import type { KeywordLevel } from "./caption-layout";

// Words per AI call; longer transcripts are marked up in parts.
const WORDS_PER_CALL = 500;
const MAX_WORDS = 6000;
const MAX_EMOJI_LENGTH = 16;

// The model sometimes miscounts, so it repeats each word and the word is
// looked for this far either side of the index it gave.
const INDEX_SLACK = 4;

const FILLER = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at", "is",
  "are", "was", "were", "be", "i", "you", "we", "they", "he", "she", "it",
  "this", "that", "so", "like", "just", "about", "very", "really", "um",
  "uh", "have", "has", "had", "do", "does", "did", "my", "your", "its",
]);

const bare = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

const resultSchema = z.object({
  keywords: z.array(
    z.object({
      index: z.number().int(),
      word: z.string(),
      level: z.number().int().min(1).max(3),
    }),
  ),
  emojis: z.array(
    z.object({ index: z.number().int(), word: z.string(), emoji: z.string() }),
  ),
});

/** The index of `word` at or near `index` within [from, to), or -1. */
function locate(words: string[], word: string, index: number, from: number, to: number): number {
  const target = bare(word);
  if (!target) return -1;
  for (let d = 0; d <= INDEX_SLACK; d++) {
    for (const i of d ? [index - d, index + d] : [index]) {
      if (i >= from && i < to && bare(words[i]) === target) return i;
    }
  }
  return -1;
}

export interface CaptionMarkup {
  keywords: { index: number; level: KeywordLevel }[];
  emojis: { index: number; emoji: string }[];
}

/** Asks the AI which words are keywords and which deserve an emoji. */
export async function findCaptionKeywords(words: string[]): Promise<CaptionMarkup> {
  const capped = words.slice(0, MAX_WORDS);
  const parts: number[] = [];
  for (let start = 0; start < capped.length; start += WORDS_PER_CALL) parts.push(start);

  const results = await Promise.all(
    parts.map(async (start) => {
      const slice = capped.slice(start, start + WORDS_PER_CALL);
      const { object } = await generateObject({
        model: openrouter("openai/gpt-4o-mini"),
        schema: resultSchema,
        prompt: captionKeywordsPrompt(
          slice.map((word, i) => `${start + i} ${word}`).join("\n"),
          slice.length,
        ),
      });
      const end = start + slice.length;
      return {
        keywords: object.keywords
          .map((k) => ({
            index: locate(capped, k.word, k.index, start, end),
            level: k.level as KeywordLevel,
          }))
          .filter((k) => k.index >= 0 && !FILLER.has(bare(capped[k.index]))),
        emojis: object.emojis
          .map((e) => ({
            index: locate(capped, e.word, e.index, start, end),
            emoji: Array.from(e.emoji.trim()).slice(0, MAX_EMOJI_LENGTH).join(""),
          }))
          .filter((e) => e.index >= 0 && e.emoji && !FILLER.has(bare(capped[e.index]))),
      };
    }),
  );

  // One mark per word: the first answer wins.
  const keywords = new Map<number, KeywordLevel>();
  const emojis = new Map<number, string>();
  for (const result of results) {
    for (const k of result.keywords) if (!keywords.has(k.index)) keywords.set(k.index, k.level);
    for (const e of result.emojis) if (!emojis.has(e.index)) emojis.set(e.index, e.emoji);
  }
  return {
    keywords: [...keywords].map(([index, level]) => ({ index, level })),
    emojis: [...emojis].map(([index, emoji]) => ({ index, emoji })),
  };
}

/** Sets the markup on the words, clearing any older marks. */
export function applyCaptionMarkup<W extends { keyword?: KeywordLevel; emoji?: string }>(
  words: W[],
  markup: CaptionMarkup,
): W[] {
  const keywords = new Map(markup.keywords.map((k) => [k.index, k.level]));
  const emojis = new Map(markup.emojis.map((e) => [e.index, e.emoji]));
  return words.map((word, i) => {
    const { keyword: _keyword, emoji: _emoji, ...rest } = word;
    const keyword = keywords.get(i);
    const emoji = emojis.get(i);
    return {
      ...rest,
      ...(keyword ? { keyword } : {}),
      ...(emoji ? { emoji } : {}),
    } as W;
  });
}
