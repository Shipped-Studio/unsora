export const captionTranslatePrompt = (language: string, numberedLines: string) => `
Translate the caption lines of a short video into ${language}.

Rules:
- Translate each line on its own, keeping its meaning and tone. Keep it short and natural to say aloud; captions are read in a second or two.
- Return exactly one translated line for every numbered line, in the same order, with the same index.
- Keep names, brands and numbers as they are.
- No quotation marks, notes or explanations.

Lines:
${numberedLines}
`;

export const captionOptimizePrompt = (numberedLines: string) => `
These are the caption lines of a short video, made by speech recognition. Each line is "index: word word word".

Fix only recognition mistakes: misheard words, misspelled names and brands, wrong homophones, numbers written the wrong way. Don't rephrase, shorten, add or remove meaning, and don't add punctuation.

Keep the same number of words in a line whenever you can, so each word keeps its timing. Only change the count when a word was clearly heard as two or two as one.

Return every line, in the same order with the same index, even lines you didn't change.

Lines:
${numberedLines}
`;
