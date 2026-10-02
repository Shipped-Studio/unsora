/** Strip section tags like [Verse] and collapse whitespace for TTS. */
export function flattenLyricsForSpeech(lyrics: string): string {
  return lyrics
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLyricLines(lyrics: string): string[] {
  return lyrics
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isSectionHeader(line: string): boolean {
  return /^\[[^\]]+\]$/.test(line);
}

function sectionName(line: string): string {
  return line.replace(/^\[|\]$/g, "").trim().toLowerCase();
}

function trimToTitle(text: string, maxLen = 52): string {
  let title = text
    .replace(/^["'""]|["'""]$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length <= maxLen) {
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  const truncated = title.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
  const result = truncated.length >= 8 ? truncated : title.slice(0, maxLen).trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Derive a display title from lyrics — prefers [Chorus], then [Hook]/[Title],
 * then the first singable line. Falls back to style prompt.
 */
export function deriveSongTitleFromLyrics(
  lyrics: string,
  promptFallback?: string | null,
): string {
  const lines = parseLyricLines(lyrics);
  const preferredSections = ["title", "hook", "chorus"];

  for (const section of preferredSections) {
    for (let i = 0; i < lines.length; i++) {
      if (!isSectionHeader(lines[i])) continue;
      if (sectionName(lines[i]) !== section) continue;

      for (let j = i + 1; j < lines.length; j++) {
        if (isSectionHeader(lines[j])) break;
        if (lines[j].length > 0) return trimToTitle(lines[j]);
      }
    }
  }

  const firstLine = lines.find((line) => !isSectionHeader(line));
  if (firstLine) return trimToTitle(firstLine);

  const prompt = promptFallback?.trim();
  if (prompt) return trimToTitle(prompt, 60);

  return "Untitled";
}

/**
 * Lyrics formatted for music vocal overlay — line breaks become pauses so
 * spoken delivery follows verse structure instead of one long paragraph.
 */
export function flattenLyricsForMusicVocal(lyrics: string): string {
  const lines = lyrics
    .replace(/\[[^\]]+\]/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  return lines.join('<break time="0.7s" /> ');
}
