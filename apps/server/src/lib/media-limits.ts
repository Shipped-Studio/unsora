import { probeDurationSeconds } from "../api/v1/helpers/media-duration";
import { assertPublicUrl } from "./remote-import";

/**
 * The real duration of a client-supplied media URL, in seconds, read from the
 * container with ranged requests (no full download). Null when the URL isn't
 * public or isn't a readable media file. Price from this, never from a
 * duration the client sends.
 */
export async function measureMediaSeconds(url: string): Promise<number | null> {
  try {
    await assertPublicUrl(url);
  } catch {
    return null;
  }
  return probeDurationSeconds(url);
}

/** Slack for container rounding when comparing against a length limit. */
export const DURATION_TOLERANCE_SECONDS = 0.5;
