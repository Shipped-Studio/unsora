import {
  DEFAULT_TITLE_STYLE,
  type TitleStyle,
} from "@/components/subtitle-editor/title-overlay";

export interface TitleTheme {
  id: string;
  name: string;
  style: TitleStyle;
}

const SOFT_SHADOW = "0 0.04em 0.18em rgba(0,0,0,0.55)";
const HARD_SHADOW = "0 0.06em 0 rgba(0,0,0,0.85)";

/** Picking a theme copies its whole style into the title. */
export const TITLE_THEMES: TitleTheme[] = [
  { id: "nova", name: "Nova", style: DEFAULT_TITLE_STYLE },
  {
    id: "leo",
    name: "Leo",
    style: {
      fontFamily: "montserrat",
      fontWeight: 900,
      accentFontFamily: "montserrat",
      accentFontWeight: 900,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#facc15",
      strokeWidth: 0.08,
      strokeColor: "#000000",
      shadow: SOFT_SHADOW,
    },
  },
  {
    id: "mia",
    name: "Mia",
    style: {
      fontFamily: "inter",
      fontWeight: 800,
      accentFontFamily: "inter",
      accentFontWeight: 800,
      textTransform: "none",
      color: "#111111",
      accentColor: "#ef4444",
      backgroundColor: "#ffffff",
    },
  },
  {
    id: "kai",
    name: "Kai",
    style: {
      fontFamily: "anton",
      fontWeight: 400,
      accentFontFamily: "anton",
      accentFontWeight: 400,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#ffffff",
      accentBackgroundColor: "#f97316",
      shadow: SOFT_SHADOW,
    },
  },
  {
    id: "ivy",
    name: "Ivy",
    style: {
      fontFamily: "montserrat",
      fontWeight: 800,
      accentFontFamily: "montserrat",
      accentFontWeight: 800,
      textTransform: "uppercase",
      color: "#111111",
      accentColor: "#111111",
      backgroundColor: "#facc15",
      pill: true,
    },
  },
  {
    id: "zoe",
    name: "Zoe",
    style: {
      fontFamily: "playfair",
      fontWeight: 700,
      accentFontFamily: "dancing-script",
      accentFontWeight: 700,
      accentScale: 1.3,
      textTransform: "none",
      color: "#ffffff",
      accentColor: "#fbbf24",
      shadow: SOFT_SHADOW,
    },
  },
  {
    id: "max",
    name: "Max",
    style: {
      fontFamily: "bebas",
      fontWeight: 400,
      accentFontFamily: "bebas",
      accentFontWeight: 400,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#22c55e",
      shadow: HARD_SHADOW,
    },
  },
  {
    id: "ray",
    name: "Ray",
    style: {
      fontFamily: "montserrat",
      fontWeight: 800,
      accentFontFamily: "montserrat",
      accentFontWeight: 800,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#fca5a5",
      shadow: "0 0 0.15em #ef4444, 0 0 0.45em rgba(239,68,68,0.7)",
    },
  },
  {
    id: "luna",
    name: "Luna",
    style: {
      fontFamily: "luckiest-guy",
      fontWeight: 400,
      accentFontFamily: "luckiest-guy",
      accentFontWeight: 400,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#c084fc",
      strokeWidth: 0.07,
      strokeColor: "#000000",
      shadow: HARD_SHADOW,
    },
  },
  {
    id: "theo",
    name: "Theo",
    style: {
      fontFamily: "bangers",
      fontWeight: 400,
      accentFontFamily: "bangers",
      accentFontWeight: 400,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#fb923c",
      strokeWidth: 0.06,
      strokeColor: "#000000",
      shadow: HARD_SHADOW,
    },
  },
  {
    id: "ada",
    name: "Ada",
    style: {
      fontFamily: "fredoka",
      fontWeight: 600,
      accentFontFamily: "fredoka",
      accentFontWeight: 700,
      textTransform: "none",
      color: "#ffffff",
      accentColor: "#34d399",
      shadow: SOFT_SHADOW,
    },
  },
  {
    id: "finn",
    name: "Finn",
    style: {
      fontFamily: "oswald",
      fontWeight: 700,
      accentFontFamily: "oswald",
      accentFontWeight: 700,
      textTransform: "uppercase",
      color: "#ffffff",
      accentColor: "#38bdf8",
      backgroundColor: "rgba(0,0,0,0.65)",
    },
  },
];
