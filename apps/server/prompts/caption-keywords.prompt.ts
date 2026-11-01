export const captionKeywordsPrompt = (
  numberedWords: string,
  wordCount: number,
) => `
You mark up the captions of a short vertical video (TikTok, Reels, Shorts). Below are ${wordCount} words of its transcript, one per line as "index word".

1. Keywords: the words a viewer should notice. Give each a level.
   - 1: the most important word of a sentence: a number, a name, a surprising, emotional or vivid word. Give about one per sentence.
   - 2: a word that carries meaning: a strong noun, verb or adjective. One or two per sentence.
   - 3: a word worth a light accent.
   Never mark filler: a, an, the, and, or, but, to, of, in, on, is, are, was, I, you, we, it, this, that, so, like, just, about, very, really, um.
   Mark ${Math.max(3, Math.round(wordCount / 5))} words in total, about a third of them level 1.

2. Emojis: pick ${Math.max(1, Math.round(wordCount / 12))} words whose meaning one emoji shows clearly (money → 💰, fire → 🔥, map → 🗺️, heart → ❤️). Spread them through the transcript. Use a face emoji only for emotions.

For every word you mark, give its index and repeat the word exactly as written.

Words:
${numberedWords}
`;
