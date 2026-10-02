"use client";

import { FrameCorners, ArrowsIn, ArrowsOut, DropHalf } from "@phosphor-icons/react";

export type AspectRatioId = "original" | "9:16" | "1:1" | "4:5" | "16:9";
export type VideoFitId = "contain" | "cover" | "blur";

export interface PreviewStyleConfig {
  aspectRatio: AspectRatioId;
  videoFit: VideoFitId;
  backgroundColor: string;
}

export const PREVIEW_STYLE_DEFAULTS: PreviewStyleConfig = {
  aspectRatio: "original",
  videoFit: "contain",
  backgroundColor: "#000000",
};

const ASPECT_RATIO_OPTIONS: {
  id: AspectRatioId;
  label: string;
  hint: string;
  // Icon box proportions (w x h in px, max 28)
  box: { w: number; h: number };
}[] = [
  { id: "original", label: "Original", hint: "Same as video", box: { w: 22, h: 22 } },
  { id: "9:16", label: "9:16", hint: "TikTok / Reels", box: { w: 14, h: 25 } },
  { id: "1:1", label: "1:1", hint: "Square", box: { w: 22, h: 22 } },
  { id: "4:5", label: "4:5", hint: "Instagram feed", box: { w: 20, h: 25 } },
  { id: "16:9", label: "16:9", hint: "YouTube", box: { w: 28, h: 16 } },
];

const VIDEO_FIT_OPTIONS: {
  id: VideoFitId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "contain", label: "Fit", hint: "Whole video visible", icon: ArrowsIn },
  { id: "cover", label: "Fill", hint: "Crop to fill frame", icon: ArrowsOut },
  { id: "blur", label: "Blur", hint: "Blurred background", icon: DropHalf },
];

const BACKGROUND_COLOR_OPTIONS = [
  "#000000",
  "#ffffff",
  "#18181b",
  "#1e3a5f",
  "#166534",
  "#7c2d12",
  "#4c1d95",
  "#831843",
];

/**
 * Resolve the composition canvas size for a given aspect ratio.
 * Fixed ratios use 1080 on the short side; "original" follows the
 * source video. Dimensions are rounded to even numbers for h264.
 */
export function getCompositionDimensions(
  config: PreviewStyleConfig | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  switch (config?.aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "original":
    default:
      return { width: even(sourceWidth), height: even(sourceHeight) };
  }
}

interface PreviewStyleTabProps {
  config: PreviewStyleConfig;
  onChange: (config: PreviewStyleConfig) => void;
}

export function PreviewStyleTab({ config, onChange }: PreviewStyleTabProps) {
  const update = <K extends keyof PreviewStyleConfig>(
    key: K,
    value: PreviewStyleConfig[K],
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <FrameCorners className="size-4 text-muted-foreground" />
          <label className="text-sm font-semibold">Aspect Ratio</label>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Sets the frame of both the preview and the exported video.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {ASPECT_RATIO_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => update("aspectRatio", opt.id)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-all ${
                config.aspectRatio === opt.id
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span
                className="rounded-[3px] border-2 border-current"
                style={{ width: opt.box.w, height: opt.box.h }}
              />
              <span className="text-xs font-medium">{opt.label}</span>
              <span className="text-[10px] leading-none opacity-70">
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold">
          Video Fill Style
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          How the video fills the frame when it doesn&apos;t match the aspect
          ratio.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_FIT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => update("videoFit", opt.id)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition-all ${
                config.videoFit === opt.id
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <opt.icon className="size-4" />
              <span className="text-xs font-medium">{opt.label}</span>
              <span className="text-[10px] leading-none opacity-70">
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {config.videoFit === "contain" && (
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Background Color
          </label>
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => update("backgroundColor", c)}
                className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor:
                    config.backgroundColor === c
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                }}
              />
            ))}
            <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
              <input
                type="color"
                value={config.backgroundColor}
                onChange={(e) => update("backgroundColor", e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <span className="text-[10px] text-muted-foreground">+</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
