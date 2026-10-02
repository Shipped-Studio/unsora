export function deriveSongTitleFromLyrics(
  lyrics: string,
  promptFallback?: string | null,
): string {
  const lines = lyrics
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const isSection = (line: string) => /^\[[^\]]+\]$/.test(line);
  const sectionName = (line: string) =>
    line.replace(/^\[|\]$/g, "").trim().toLowerCase();

  const trimToTitle = (text: string, maxLen = 52) => {
    let title = text
      .replace(/^["'""]|["'""]$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length <= maxLen) {
      return title.charAt(0).toUpperCase() + title.slice(1);
    }
    const truncated = title.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
    const result =
      truncated.length >= 8 ? truncated : title.slice(0, maxLen).trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  for (const section of ["title", "hook", "chorus"]) {
    for (let i = 0; i < lines.length; i++) {
      if (!isSection(lines[i]) || sectionName(lines[i]) !== section) continue;
      for (let j = i + 1; j < lines.length; j++) {
        if (isSection(lines[j])) break;
        if (lines[j].length > 0) return trimToTitle(lines[j]);
      }
    }
  }

  const firstLine = lines.find((line) => !isSection(line));
  if (firstLine) return trimToTitle(firstLine);

  const prompt = promptFallback?.trim();
  if (prompt) return trimToTitle(prompt, 60);

  return "Untitled";
}

export function formatTrackLabel(trackNumber: number): string {
  return `Track ${String(trackNumber).padStart(2, "0")}`;
}

export function formatTrackTitle(
  trackNumber: number,
  songTitle?: string | null,
): string {
  const label = formatTrackLabel(trackNumber);
  const title = songTitle?.trim();
  return title ? `${label} — ${title}` : label;
}

export function formatDownloadFilename(
  trackNumber: number,
  songTitle?: string | null,
): string {
  const base =
    songTitle?.trim() ||
    formatTrackLabel(trackNumber).replace(/\s+/g, "-").toLowerCase();
  const safe = base
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return `${safe || `track-${trackNumber}`}.mp3`;
}
