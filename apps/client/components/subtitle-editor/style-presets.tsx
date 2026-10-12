"use client";

import { useState } from "react";
import { SlidersHorizontal, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SavedSubtitlePreset } from "@/hooks/subtitle/use-subtitle-api";
import { cn } from "@/lib/utils";
import { getFontFamily } from "@/remotion/fonts";

export interface SubtitleStylePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase" | "lowercase";
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
    name: "Aiden",
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
    name: "Rex",
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
    name: "Bolt",
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
    name: "Jade",
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
    name: "Vex",
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
    name: "Sol",
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
    name: "Neon",
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
    name: "Sunny",
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
    name: "Retro",
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
    name: "Goldie",
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
    name: "Iris",
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
    name: "Blue",
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
    name: "Blaze",
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
    name: "Inky",
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
    name: "Mint",
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
    name: "Classic",
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
    name: "Simple",
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
    name: "Type",
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
    name: "Pill",
    fontFamily: "lato",
    fontSize: 17,
    fontWeight: 500,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.7)",
    backgroundPadding: 8,
  },
  {
    id: "cream-box",
    name: "Cleo",
    fontFamily: "inter",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "none",
    color: "#111111",
    backgroundColor: "#fdf6e3",
    backgroundPadding: 8,
  },
  {
    id: "white-box",
    name: "Paige",
    fontFamily: "poppins",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    color: "#111111",
    backgroundColor: "#ffffff",
    backgroundPadding: 8,
  },
  {
    id: "yellow-box",
    name: "Hazel",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 900,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#111111",
    backgroundColor: "#facc15",
    backgroundPadding: 8,
  },
  {
    id: "grey-box",
    name: "Slate",
    fontFamily: "inter",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    backgroundColor: "rgba(82,82,91,0.9)",
    backgroundPadding: 8,
  },
  {
    id: "black-box",
    name: "Onyx",
    fontFamily: "inter",
    fontSize: 17,
    fontWeight: 600,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    backgroundColor: "#000000",
    backgroundPadding: 8,
  },
  {
    id: "green-word-box",
    name: "Kiwi",
    fontFamily: "poppins",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#000000",
    highlightBgColor: "#4ade80",
    shadow: "0 2px 8px rgba(0,0,0,0.45)",
  },
  {
    id: "golden-condensed",
    name: "Titan",
    fontFamily: "anton",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#fbbf24",
    shadow: "0 0 10px rgba(30,58,138,0.9), 0 3px 0 rgba(0,0,0,0.6)",
  },
  {
    id: "italic-condensed",
    name: "Duke",
    fontFamily: "anton",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#facc15",
    shadow: "0 3px 8px rgba(0,0,0,0.9)",
  },
  {
    id: "dark-outlined",
    name: "Ink",
    fontFamily: "oswald",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#111111",
    highlightColor: "#dc2626",
    strokeColor: "#ffffff",
    strokeWidth: 3,
  },
  {
    id: "heavy-outline",
    name: "Stark",
    fontFamily: "archivo-black",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 4,
  },
  {
    id: "red-outlined",
    name: "Ruby",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 900,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#ef4444",
    strokeColor: "#000000",
    strokeWidth: 2,
    shadow: "0 2px 6px rgba(0,0,0,0.5)",
  },
  {
    id: "thin-elegant",
    name: "Lux",
    fontFamily: "inter",
    fontSize: 17,
    fontWeight: 300,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    shadow: "0 1px 8px rgba(0,0,0,0.55)",
  },
  {
    id: "soft-shadow",
    name: "Aura",
    fontFamily: "poppins",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#a5f3fc",
    shadow: "0 2px 14px rgba(0,0,0,0.7)",
  },
  {
    id: "rounded-soft",
    name: "Puff",
    fontFamily: "fredoka",
    fontSize: 17,
    fontWeight: 600,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#fda4af",
    shadow: "0 2px 10px rgba(0,0,0,0.5)",
  },
  {
    id: "white-glow",
    name: "Halo",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 800,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#fef08a",
    shadow: "0 0 10px rgba(255,255,255,0.9), 0 0 24px rgba(255,255,255,0.6)",
  },
  {
    id: "dark-glow",
    name: "Shade",
    fontFamily: "montserrat",
    fontSize: 17,
    fontWeight: 900,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#facc15",
    shadow: "0 0 16px rgba(0,0,0,0.95), 0 0 34px rgba(0,0,0,0.8)",
  },
  {
    id: "warm-serif-glow",
    name: "Amber",
    fontFamily: "playfair",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    color: "#fbbf24",
    shadow: "0 0 14px rgba(251,191,36,0.75)",
  },
  {
    id: "thin-serif",
    name: "Nyx",
    fontFamily: "playfair",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    shadow: "0 1px 10px rgba(0,0,0,0.5)",
  },
  {
    id: "lime-serif-box",
    name: "Fern",
    fontFamily: "playfair",
    fontSize: 17,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    color: "#111111",
    backgroundColor: "#e5f86b",
    backgroundPadding: 8,
  },
  {
    id: "orange-comic",
    name: "Zest",
    fontFamily: "luckiest-guy",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "normal",
    textTransform: "uppercase",
    color: "#ffffff",
    highlightColor: "#fb923c",
    strokeColor: "#431407",
    strokeWidth: 3,
    shadow: "0 3px 0 rgba(0,0,0,0.6)",
  },
  {
    id: "bubble-outline",
    name: "Pop",
    fontFamily: "titan-one",
    fontSize: 17,
    fontWeight: 400,
    fontStyle: "normal",
    textTransform: "none",
    color: "#ffffff",
    highlightColor: "#38bdf8",
    strokeColor: "#000000",
    strokeWidth: 4,
  },
];

const PREVIEW_FONT_SIZE = 26;
/** Caption size the presets' outline widths are tuned for. */
const DESIGN_FONT_SIZE = 43;

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

/** The preset's name, drawn the way the preset draws a spoken word. */
function PresetPreview({ preset }: { preset: SubtitleStylePreset }) {
  const upper = preset.textTransform === "uppercase";
  const highlighted = Boolean(preset.highlightColor || preset.highlightBgColor);
  const boxColor = preset.highlightBgColor ?? preset.backgroundColor;

  return (
    <span
      aria-hidden
      // No overflow clipping here: it would cut glows and shadows into boxes.
      className="whitespace-nowrap"
      style={{
        fontFamily: getFontFamily(preset.fontFamily),
        fontSize: PREVIEW_FONT_SIZE,
        fontWeight: preset.fontWeight,
        fontStyle: preset.fontStyle,
        textTransform: preset.textTransform,
        letterSpacing: upper ? "0.04em" : undefined,
        lineHeight: 1.25,
        textShadow: preset.shadow,
        // Like the renderer, a boxed word has no outline.
        ...(preset.strokeColor && preset.strokeWidth && !preset.highlightBgColor
          ? {
              WebkitTextStroke: `${(preset.strokeWidth / DESIGN_FONT_SIZE).toFixed(3)}em ${preset.strokeColor}`,
              paintOrder: "stroke fill",
            }
          : {}),
        ...textFill(
          highlighted ? (preset.highlightColor ?? preset.color) : preset.color,
        ),
        ...(boxColor
          ? {
              ...(boxColor.startsWith("linear-gradient")
                ? { backgroundImage: boxColor }
                : { backgroundColor: boxColor }),
              padding: `0.04em ${upper ? 0.14 : 0.18}em 0.04em 0.18em`,
              borderRadius: "0.18em",
            }
          : {}),
      }}
    >
      {preset.name}
    </span>
  );
}

export const PRESET_CATEGORIES: { label: string; ids: string[] }[] = [
  {
    label: "Box",
    ids: ["gradient-box-focus", "red-box-focus", "green-word-box", "cream-box", "white-box", "yellow-box", "grey-box", "black-box", "typewriter", "pill-background"],
  },
  {
    label: "Bold",
    ids: ["bold-green-highlight", "golden-condensed", "italic-condensed", "heavy-outline", "dark-outlined", "red-outlined", "bold-blue-stroke", "red-stroke-bold"],
  },
  {
    label: "Clean",
    ids: ["outlined-white", "bold-simple", "soft-shadow", "thin-elegant", "rounded-soft", "mint-fresh"],
  },
  {
    label: "Glow",
    ids: ["white-glow", "dark-glow", "warm-serif-glow", "neon-glow", "retro-wave"],
  },
  { label: "Serif", ids: ["thin-serif", "lime-serif-box", "italic-yellow-highlight", "gold-luxe"] },
  {
    label: "Fun",
    ids: ["thick-white-stroke", "orange-comic", "bubble-outline", "beast-purple", "hand-marker", "rainbow-highlight", "sunset-pop"],
  },
];

const SAVED_ID_PREFIX = "saved-";

/** A preset the user saved, ready to select; missing fields fall back to the first built-in. */
export function savedToPreset(saved: SavedSubtitlePreset): SubtitleStylePreset {
  return {
    ...SUBTITLE_PRESETS[0],
    ...(saved.style as Partial<SubtitleStylePreset>),
    id: `${SAVED_ID_PREFIX}${saved.id}`,
    name: saved.name,
  };
}

/** The style to store when saving a preset: everything but its id and name. */
export function presetStyle(
  preset: SubtitleStylePreset,
): Record<string, unknown> {
  const style: Record<string, unknown> = { ...preset };
  delete style.id;
  delete style.name;
  return style;
}

const MINE = "Mine";
const ALL = "All";

export function StylePresetsGrid({
  selectedPresetId,
  onSelectPreset,
  savedPresets,
  onCustomize,
  onDeleteSaved,
}: {
  selectedPresetId: string;
  onSelectPreset: (preset: SubtitleStylePreset) => void;
  savedPresets: SavedSubtitlePreset[];
  onCustomize: () => void;
  onDeleteSaved: (saved: SavedSubtitlePreset) => void;
}) {
  const [filter, setFilter] = useState(ALL);
  const filters = [
    ALL,
    ...(savedPresets.length ? [MINE] : []),
    ...PRESET_CATEGORIES.map((category) => category.label),
  ];
  // A filter can vanish (the last saved preset was deleted).
  const active = filters.includes(filter) ? filter : ALL;

  const saved =
    active === ALL || active === MINE
      ? savedPresets.map((item) => ({ preset: savedToPreset(item), saved: item }))
      : [];
  const category = PRESET_CATEGORIES.find((c) => c.label === active);
  const builtIn =
    active === MINE
      ? []
      : SUBTITLE_PRESETS.filter(
          (preset) => !category || category.ids.includes(preset.id),
        ).map((preset) => ({ preset, saved: null }));

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Filter presets"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {filters.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={label === active}
            onClick={() => setFilter(label)}
            className="h-8 shrink-0 rounded-full px-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="group"
        aria-label={`${active} presets`}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {[...saved, ...builtIn].map(({ preset, saved: item }) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            selected={preset.id === selectedPresetId}
            onSelect={() => onSelectPreset(preset)}
            onCustomize={onCustomize}
            onDelete={item ? () => onDeleteSaved(item) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
  onCustomize,
  onDelete,
}: {
  preset: SubtitleStylePreset;
  selected: boolean;
  onSelect: () => void;
  onCustomize: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group/preset relative min-w-0">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={preset.name}
        onClick={onSelect}
        className={cn(
          // Mid grey keeps both white text and dark outlines readable.
          "flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-neutral-400 px-3 outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-neutral-500",
          selected && "ring-2 ring-primary hover:ring-primary",
        )}
      >
        <PresetPreview preset={preset} />
      </button>
      {selected ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={`Customize ${preset.name}`}
                onClick={onCustomize}
                className="absolute right-1.5 bottom-1.5 shadow-sm"
              />
            }
          >
            <SlidersHorizontal />
          </TooltipTrigger>
          <TooltipContent>Customize</TooltipContent>
        </Tooltip>
      ) : null}
      {onDelete ? (
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label={`Delete ${preset.name}`}
          onClick={onDelete}
          className="absolute top-1.5 right-1.5 opacity-0 shadow-sm transition-opacity group-hover/preset:opacity-100 focus-visible:opacity-100"
        >
          <Trash />
        </Button>
      ) : null}
    </div>
  );
}
