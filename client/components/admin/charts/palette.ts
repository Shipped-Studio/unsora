"use client";

import { useTheme } from "next-themes";

/**
 * Chart palette for the admin dashboard.
 *
 * Values are the dataviz reference instance (already CVD-validated for both
 * the light and dark chart surfaces). Categorical hues are assigned in a
 * FIXED order and never cycled — a series keeps its hue regardless of rank.
 * Magnitude charts (bar lists) use a single sequential hue instead.
 */

// Categorical identity hues — light surface / dark surface.
const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];
const CATEGORICAL_DARK = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
];

// Status palette (fixed — never themed into a series hue). Validated on both
// surfaces, so the same steps are reused in light and dark.
const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

// Sequential single hue for magnitude (bar lists), by mode.
const SEQUENTIAL = { light: "#2a78d6", dark: "#3987e5" } as const;

// Chart chrome / ink.
const CHROME_LIGHT = {
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  surface: "#ffffff",
};
const CHROME_DARK = {
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  surface: "#171717",
};

export interface ChartTheme {
  isDark: boolean;
  categorical: string[];
  sequential: string;
  status: typeof STATUS;
  grid: string;
  axis: string;
  muted: string;
  surface: string;
  /** Color for a categorical series at a fixed index (wraps as a fallback). */
  cat: (i: number) => string;
  /** Color for a task status token. */
  statusColor: (status: string) => string;
}

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const categorical = isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const chrome = isDark ? CHROME_DARK : CHROME_LIGHT;

  return {
    isDark,
    categorical,
    sequential: isDark ? SEQUENTIAL.dark : SEQUENTIAL.light,
    status: STATUS,
    ...chrome,
    cat: (i: number) => categorical[i % categorical.length],
    statusColor: (status: string) => {
      switch (status.toUpperCase()) {
        case "COMPLETED":
          return STATUS.good;
        case "FAILED":
          return STATUS.critical;
        case "QUEUED":
          return STATUS.warning;
        case "PROCESSING":
          return isDark ? SEQUENTIAL.dark : SEQUENTIAL.light;
        default:
          return chrome.muted;
      }
    },
  };
}

/** Human labels for the unified feature/task kinds (mirror of the server). */
export const KIND_LABELS: Record<string, string> = {
  video: "Video Generation",
  image: "Image Generation",
  music: "Music Generation",
  avatar: "AI Avatar",
  voice: "Voice Generation",
  voice_conversion: "Voice Changer",
  clipping: "AI Clipping",
  video_processing: "Video Enhance",
  transcription: "Subtitles",
  video_export: "Video Export",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
