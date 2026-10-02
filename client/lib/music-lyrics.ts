export interface LyricTimelineLine {
  text: string;
  startTime: number;
  isSection: boolean;
}

export function parseLyricLines(lyrics: string): string[] {
  return lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isSectionHeader(text: string): boolean {
  return /^\[[^\]]+\]$/.test(text);
}

export function buildLyricTimeline(
  lyrics: string,
  duration: number,
): LyricTimelineLine[] {
  const rawLines = parseLyricLines(lyrics);
  if (rawLines.length === 0 || duration <= 0) return [];

  const singableLines = rawLines.filter((text) => !isSectionHeader(text));
  const totalWords = singableLines.reduce(
    (sum, text) => sum + text.split(/\s+/).filter(Boolean).length,
    0,
  );

  if (totalWords === 0) {
    return rawLines.map((text) => ({
      text,
      startTime: 0,
      isSection: isSectionHeader(text),
    }));
  }

  const playableDuration = duration * 0.92;
  let cursor = 0;

  return rawLines.map((text) => {
    if (isSectionHeader(text)) {
      return { text, startTime: cursor, isSection: true };
    }

    const words = text.split(/\s+/).filter(Boolean).length;
    const startTime = cursor;
    cursor += (words / totalWords) * playableDuration;

    return { text, startTime, isSection: false };
  });
}

export function getActiveLyricIndex(
  timeline: LyricTimelineLine[],
  currentTime: number,
): number {
  if (timeline.length === 0) return -1;

  let activeIndex = 0;
  for (let i = 0; i < timeline.length; i += 1) {
    if (timeline[i].startTime <= currentTime + 0.05) {
      activeIndex = i;
    } else {
      break;
    }
  }

  return activeIndex;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
