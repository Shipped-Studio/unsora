/**
 * Turns a raw failure string from a provider, worker or ffmpeg into one short
 * line a person can act on. Keep the raw text for a `title` attribute.
 *
 * `kind` picks the generic advice: "prompt" tools can suggest changing the
 * prompt, "file" tools (upscalers, clipping) suggest a different file.
 *
 * No line says "Try again": result tiles and rows have no retry action, so
 * the copy only points at things the person can do from the composer.
 */
export function friendlyGenerationError(
  raw?: string | null,
  kind: "prompt" | "file" = "prompt",
): string {
  const text = (raw ?? "").toLowerCase();

  if (/time[ds]? ?out|timeout|took too long|sweeper|stale|stuck|deadline/.test(text)) {
    return "Took too long. Your credits were refunded.";
  }
  if (/ffmpeg|transcod|encod|decod|processing|render|corrupt|codec/.test(text)) {
    return "Processing failed.";
  }
  if (
    /\b4\d\d\b|provider|unauthori[sz]ed|forbidden|auth|api key|invalid|bad request|rejected|moderation|safety|policy|nsfw/.test(
      text,
    )
  ) {
    return kind === "file"
      ? "Couldn't process this file. Use a different one."
      : "Couldn't generate this one. Change the prompt and generate again.";
  }
  return "Something went wrong on our side.";
}
