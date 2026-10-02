import prisma from "./db";

type ParamsWithTrack = {
  trackNumber?: number;
  songTitle?: string;
  [key: string]: unknown;
};

export function readTrackNumber(params: unknown): number | undefined {
  if (!params || typeof params !== "object") return undefined;
  const n = (params as ParamsWithTrack).trackNumber;
  return typeof n === "number" && n > 0 ? n : undefined;
}

export function readSongTitle(params: unknown): string | undefined {
  if (!params || typeof params !== "object") return undefined;
  const title = (params as ParamsWithTrack).songTitle;
  return typeof title === "string" && title.trim().length > 0
    ? title.trim()
    : undefined;
}

/** Oldest generation = Track 1; uses stored number when present. */
export async function buildTrackNumberMap(
  userId: string,
): Promise<Map<string, number>> {
  const rows = await prisma.musicGeneration.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, params: true },
  });

  const map = new Map<string, number>();
  rows.forEach((row, index) => {
    map.set(row.id, readTrackNumber(row.params) ?? index + 1);
  });
  return map;
}

export async function nextTrackNumber(userId: string): Promise<number> {
  const count = await prisma.musicGeneration.count({ where: { userId } });
  return count + 1;
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
