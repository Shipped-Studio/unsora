import { ALL_FORMATS, Input, UrlSource } from "mediabunny";

/**
 * Read a remote media file's duration from its container metadata. UrlSource
 * uses range requests, so only the header/index bytes are fetched — no full
 * download. Returns null when the URL isn't a readable media file.
 */
export async function probeDurationSeconds(url: string): Promise<number | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(url) });
  try {
    const duration = await input.computeDuration();
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}
