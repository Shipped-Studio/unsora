export const hookTitlePrompt = (transcript: string, previousHooks: string[]) => `
You write the hook title shown on screen during the first seconds of a short vertical video (TikTok, Reels, Shorts). Its only job is to make the viewer keep watching.

Write one hook for the video whose transcript is below.

Rules:
- 3 to 8 words, split across 1 or 2 lines. Put a line break ("\\n") between lines.
- Write it in the same language as the transcript.
- Make it specific to this video and build curiosity. Don't promise anything the video doesn't deliver.
- Wrap the 1 or 2 most important words in asterisks, like *this*. They will be styled differently.
- You may end with one emoji that fits the topic. Don't use any other emoji.
- No hashtags, no quotation marks, no full stop at the end.
${
  previousHooks.length
    ? `- Make it clearly different from these earlier hooks:\n${previousHooks
        .map((hook) => `  - ${hook.replace(/\n/g, " / ")}`)
        .join("\n")}`
    : ""
}

Transcript:
"""
${transcript}
"""
`;
