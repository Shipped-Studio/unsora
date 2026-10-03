/**
 * Chart colors for the admin dashboard. Everything resolves to theme tokens
 * from globals.css, so charts follow light and dark mode without JS.
 *
 * Categorical hues are assigned in a fixed order: a series keeps its color
 * regardless of rank. Magnitude charts (bar lists) use the first hue only.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** How many series a categorical chart can show before hues repeat. */
export const MAX_SERIES = CHART_COLORS.length;

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/** Color for a task status token. */
export function statusColor(status: string): string {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "var(--success)";
    case "FAILED":
      return "var(--destructive)";
    case "QUEUED":
      return "var(--warning)";
    case "PROCESSING":
      return "var(--info)";
    case "PENDING":
      return "var(--warning)";
    case "DRAFT":
      return "var(--chart-4)";
    default:
      return "var(--muted-foreground)";
  }
}

/** Human labels for the unified feature/task kinds (mirror of the server). */
export const KIND_LABELS: Record<string, string> = {
  video: "Video generation",
  image: "Image generation",
  music: "Music generation",
  avatar: "AI avatar",
  voice: "Voice generation",
  voice_conversion: "Voice changer",
  clipping: "AI clipping",
  video_processing: "Video enhance",
  transcription: "Subtitles",
  video_export: "Video export",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
