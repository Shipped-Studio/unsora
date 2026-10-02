"use client";

import { cn } from "@/lib/utils";
import { getFontFamily } from "@/remotion/fonts";

export interface SubtitleStylePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase";
  color: string;
  highlightColor?: string;
  highlightBgColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  backgroundPadding?: number;
  shadow?: string;
}

export const SUBTITLE_PRESETS: SubtitleStylePreset[] = [
  {
    id: "gradient-box-focus",
    name: "Gradient box",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 3,
    highlightBgColor: "linear-gradient(90deg, #3b82f6, #34d399)",
    shadow: "0 2px 8px rgba(0,0,0,0.45)",
  },
  {
    id: "red-box-focus",
    name: "Red box focus",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 3,
    highlightBgColor: "#ef4444",
    shadow: "0 2px 8px rgba(0,0,0,0.45)",
  },
  {
    id: "thick-white-stroke",
    name: "Thick white stroke",
    fontFamily: "bangers",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 3,
    highlightColor: "#16a34a",
  },
  {
    id: "bold-green-highlight",
    name: "Bold green",
    fontFamily: "bebas",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#22c55e",
    strokeColor: "#000000",
    strokeWidth: 2,
  },
  {
    id: "beast-purple",
    name: "Beast purple",
    fontFamily: "russo",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#a855f7",
    strokeColor: "#4c1d95",
    strokeWidth: 3,
    shadow: "0 3px 10px rgba(0,0,0,0.55)",
  },
  {
    id: "italic-yellow-highlight",
    name: "Italic yellow",
    fontFamily: "playfair",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#eab308",
    strokeColor: "#000000",
    strokeWidth: 2,
  },
  {
    id: "neon-glow",
    name: "Neon glow",
    fontFamily: "orbitron",
    fontSize: 16,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#e0fbff",
    highlightColor: "#22d3ee",
    shadow: "0 0 10px #22d3ee, 0 0 28px rgba(34,211,238,0.65)",
  },
  {
    id: "sunset-pop",
    name: "Sunset pop",
    fontFamily: "poppins",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "linear-gradient(90deg, #fbbf24, #fb923c, #f43f5e)",
    highlightColor: "#ffffff",
    shadow: "0 2px 10px rgba(0,0,0,0.5)",
  },
  {
    id: "retro-wave",
    name: "Retro wave",
    fontFamily: "righteous",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "linear-gradient(180deg, #ff9ff3, #f368e0, #8e44ad)",
    highlightColor: "#feca57",
    shadow: "0 0 14px rgba(243,104,224,0.55)",
  },
  {
    id: "gold-luxe",
    name: "Gold luxe",
    fontFamily: "playfair",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "linear-gradient(180deg, #f9e29c, #d4af37, #b8860b)",
    shadow: "0 2px 12px rgba(0,0,0,0.6)",
  },
  {
    id: "rainbow-highlight",
    name: "Rainbow highlight",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor:
      "linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff)",
  },
  {
    id: "bold-blue-stroke",
    name: "Bold blue stroke",
    fontFamily: "oswald",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    strokeColor: "#2563eb",
    strokeWidth: 3,
  },
  {
    id: "red-stroke-bold",
    name: "Red stroke",
    fontFamily: "oswald",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#ffffff",
    strokeColor: "#ef4444",
    strokeWidth: 3,
  },
  {
    id: "hand-marker",
    name: "Hand marker",
    fontFamily: "permanent-marker",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#fde047",
    shadow: "0 2px 8px rgba(0,0,0,0.6)",
  },
  {
    id: "mint-fresh",
    name: "Mint fresh",
    fontFamily: "fredoka",
    fontSize: 17,
    fontWeight: 600,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#34d399",
    strokeColor: "#064e3b",
    strokeWidth: 2,
    shadow: "0 2px 8px rgba(0,0,0,0.45)",
  },
  {
    id: "outlined-white",
    name: "Outlined white",
    fontFamily: "inter",
    fontSize: 17,
    fontWeight: 500,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 2,
  },
  {
    id: "bold-simple",
    name: "Bold simple",
    fontFamily: "roboto",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    shadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  {
    id: "typewriter",
    name: "Typewriter",
    fontFamily: "courier-prime",
    fontSize: 16,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    color: "#f5f5f0",
    backgroundColor: "rgba(0,0,0,0.75)",
    backgroundPadding: 8,
  },
  {
    id: "pill-background",
    name: "Pill background",
    fontFamily: "lato",
    fontSize: 17,
    fontWeight: 500,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.7)",
    backgroundPadding: 8,
  },
];

const PREVIEW_FONT_SIZE = 16;

function strokeStyle(preset: SubtitleStylePreset): React.CSSProperties {
  return preset.strokeColor && preset.strokeWidth
    ? {
        WebkitTextStroke: `${preset.strokeWidth}px ${preset.strokeColor}`,
        paintOrder: "stroke fill",
      }
    : {};
}

/** Paints a colour value that may be a CSS gradient onto text. */
function textFill(color: string | undefined): React.CSSProperties {
  if (!color) return {};
  return color.startsWith("linear-gradient")
    ? {
        backgroundImage: color,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }
    : { color };
}

function PresetPreview({ preset }: { preset: SubtitleStylePreset }) {
  const upper = preset.textTransform === "uppercase";
  const baseStyle: React.CSSProperties = {
    fontFamily: getFontFamily(preset.fontFamily),
    fontSize: PREVIEW_FONT_SIZE,
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
    textTransform: preset.textTransform,
    letterSpacing: upper ? "0.05em" : undefined,
    textShadow: preset.shadow,
    ...strokeStyle(preset),
  };

  const wordStyle: React.CSSProperties = {
    ...baseStyle,
    ...textFill(preset.color),
  };

  const highlightStyle: React.CSSProperties = {
    ...baseStyle,
    ...textFill(preset.highlightColor ?? preset.color),
    ...(preset.highlightBgColor
      ? {
          ...(preset.highlightBgColor.startsWith("linear-gradient")
            ? { backgroundImage: preset.highlightBgColor }
            : { backgroundColor: preset.highlightBgColor }),
          padding: "0.06em 0.24em",
          borderRadius: "0.18em",
        }
      : {}),
  };

  const words = (
    <>
      <span style={wordStyle}>{upper ? "THE QUICK" : "The quick"} </span>
      <span style={highlightStyle}>{upper ? "BROWN" : "brown"}</span>
    </>
  );

  return (
    <span aria-hidden className="whitespace-nowrap leading-tight">
      {preset.backgroundColor ? (
        <span
          className="inline-block rounded-md"
          style={{
            backgroundColor: preset.backgroundColor,
            padding: `2px ${preset.backgroundPadding ?? 4}px`,
          }}
        >
          {words}
        </span>
      ) : (
        words
      )}
    </span>
  );
}

export function StylePresetsGrid({
  selectedPresetId,
  onSelectPreset,
}: {
  selectedPresetId: string;
  onSelectPreset: (preset: SubtitleStylePreset) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Subtitle presets"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {SUBTITLE_PRESETS.map((preset) => {
        const selected = preset.id === selectedPresetId;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectPreset(preset)}
            className="group/preset flex min-w-0 flex-col gap-1.5 rounded-lg text-left outline-none"
          >
            <span
              className={cn(
                "flex h-20 w-full items-center justify-center overflow-hidden rounded-lg bg-media px-3 ring-offset-2 ring-offset-background transition-shadow group-hover/preset:ring-2 group-hover/preset:ring-foreground/20 group-focus-visible/preset:ring-3 group-focus-visible/preset:ring-ring/50",
                selected &&
                  "ring-2 ring-foreground group-hover/preset:ring-foreground",
              )}
            >
              <PresetPreview preset={preset} />
            </span>
            <span
              className={cn(
                "truncate px-0.5 text-xs",
                selected ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {preset.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
