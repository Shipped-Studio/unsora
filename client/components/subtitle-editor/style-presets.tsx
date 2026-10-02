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
    name: "Gradient Box",
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
    name: "Red Box Focus",
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
    name: "Thick White Stroke",
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
    name: "Bold Green",
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
    name: "Beast Purple",
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
    name: "Italic Yellow",
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
    name: "Neon Glow",
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
    name: "Sunset Pop",
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
    name: "Retro Wave",
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
    name: "Gold Luxe",
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
    name: "Rainbow Highlight",
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
    name: "Bold Blue Stroke",
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
    name: "Red Stroke",
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
    name: "Hand Marker",
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
    name: "Mint Fresh",
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
    name: "Outlined White",
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
    name: "Bold Simple",
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
    name: "Pill Background",
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

interface StylePresetsGridProps {
  selectedPreset: string | null;
  onSelectPreset: (preset: SubtitleStylePreset) => void;
}

const PREVIEW_FONT_SIZE = 18;

function PresetPreview({ preset }: { preset: SubtitleStylePreset }) {
  const mainWord =
    preset.textTransform === "uppercase" ? "THE QUICK" : "The quick";
  const highlightWord =
    preset.textTransform === "uppercase" ? "BROWN" : "brown";

  const isGradientColor = preset.color.startsWith("linear-gradient");

  const baseStyle: React.CSSProperties = {
    fontFamily: getFontFamily(preset.fontFamily),
    fontSize: PREVIEW_FONT_SIZE,
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
    textTransform: preset.textTransform,
    letterSpacing: preset.textTransform === "uppercase" ? "0.05em" : undefined,
  };

  const textStyle: React.CSSProperties = {
    ...baseStyle,
    color: isGradientColor ? "transparent" : preset.color,
    WebkitTextStroke:
      preset.strokeColor && preset.strokeWidth
        ? `${preset.strokeWidth}px ${preset.strokeColor}`
        : undefined,
    paintOrder: preset.strokeColor ? "stroke fill" : undefined,
    textShadow: preset.shadow,
    ...(isGradientColor && {
      backgroundImage: preset.color,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
    }),
  };

  const highlightStyle: React.CSSProperties = {
    ...baseStyle,
    color: preset.highlightColor?.startsWith("linear-gradient")
      ? "transparent"
      : preset.highlightColor ||
        (isGradientColor ? "transparent" : preset.color),
    WebkitTextStroke:
      preset.strokeColor && preset.strokeWidth
        ? `${preset.strokeWidth}px ${preset.strokeColor}`
        : undefined,
    paintOrder: preset.strokeColor ? "stroke fill" : undefined,
    textShadow: preset.shadow,
    ...(preset.highlightColor?.startsWith("linear-gradient") && {
      backgroundImage: preset.highlightColor,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
    }),
    ...(isGradientColor &&
      !preset.highlightColor && {
        backgroundImage: preset.color,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
      }),
    ...(preset.highlightBgColor && {
      ...(preset.highlightBgColor.startsWith("linear-gradient")
        ? { backgroundImage: preset.highlightBgColor }
        : { backgroundColor: preset.highlightBgColor }),
      padding: "0.06em 0.24em",
      borderRadius: "0.18em",
    }),
  };

  return (
    <div className="flex w-full items-center justify-center whitespace-nowrap text-center leading-tight">
      {preset.backgroundColor ? (
        <span
          className="inline-block rounded-md"
          style={{
            ...textStyle,
            backgroundColor: preset.backgroundColor,
            padding: `2px ${preset.backgroundPadding ?? 4}px`,
          }}
        >
          {mainWord} <span style={highlightStyle}>{highlightWord}</span>
        </span>
      ) : (
        <span>
          <span style={textStyle}>{mainWord} </span>
          <span style={highlightStyle}>{highlightWord}</span>
        </span>
      )}
    </div>
  );
}

export function StylePresetsGrid({
  selectedPreset,
  onSelectPreset,
}: StylePresetsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {SUBTITLE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onSelectPreset(preset)}
          className={cn(
            "flex h-[80px] items-center justify-center overflow-hidden rounded-xl bg-slate-700 px-3 transition-all hover:ring-2 hover:ring-primary/40",
            selectedPreset === preset.id && "ring-2 ring-primary bg-slate-600",
          )}
        >
          <PresetPreview preset={preset} />
        </button>
      ))}
    </div>
  );
}
