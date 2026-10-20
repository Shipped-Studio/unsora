/**
 * The caption style model shared by the editor preview and the export,
 * following Submagic's editor settings (sub-editor-refs/style.json).
 *
 * Identical copies live in apps/client/components/subtitle-editor and
 * apps/remotion/src. Change both together.
 */
import {
  normalizeCaptionLayout,
  type CaptionLayout,
  type KeywordLevel,
} from "./caption-layout";

export type { CaptionLayout, KeywordLevel };

/** An animation one word plays the moment it's spoken, set in the transcript. */
export type WordEffect = "pop" | "bounce" | "shake" | "zoom" | "swing" | "glow";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  /** Punctuation after the word, shown when the style shows punctuation. */
  punctuation?: string;
  /** Start a new row on screen after this word; set by the style's layout. */
  lineBreak?: boolean;
  effect?: WordEffect;
  /** Highlight color: 1 main, 2 second, 3 third. */
  keyword?: KeywordLevel;
  /** Picked by the AI; shown with the caption when emojis are on. */
  emoji?: string;
  /** A sound effect played as the word is spoken. */
  sound?: WordSound;
}



export type LineSize = "small" | "medium" | "large";

export interface SubtitleChunk {
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
  /** Kept in the transcript but not drawn on the video. */
  hidden?: boolean;
  /** Added in the transcript; shown even when the style has emojis off. */
  emoji?: string;
  /** A keyword shown on its own, larger. */
  solo?: boolean;
  /** Drawn as an emphasized line, in the style's emphasized colors. */
  emphasize?: boolean;
  /** The line's size; medium when missing. */
  size?: LineSize;
  /** The line's vertical position in percent from the top. */
  positionY?: number;
  /** Another template for this line only. */
  style?: SubtitleStylePreset;
}

/** Where captions sit and how big they are, as in Submagic's Basic settings. */
export interface CaptionPlacement {
  /** Font size on Submagic's scale, 1 to 70; drawn at size × frame width / 540. */
  size: number;
  /** Centre of the caption, in percent of the frame from the left. */
  x: number;
  /** Centre of the caption, in percent of the frame from the top. */
  y: number;
  /** Line width in percent of the frame. */
  width: number;
}

export const CAPTION_PLACEMENT_LIMITS = {
  size: { min: 1, max: 70 },
  x: { min: 0, max: 100 },
  y: { min: 0, max: 100 },
  width: { min: 10, max: 100 },
} as const;

export const DEFAULT_CAPTION_WIDTH = 80;

/** Pixels per size unit for a frame width. */
export const sizeToPixels = (size: number, frameWidth: number) =>
  (size * frameWidth) / 540;

type Kebab<S extends string> = S extends `${infer A} ${infer B}`
  ? `${Lowercase<A>}-${Kebab<B>}`
  : Lowercase<S>;

/** Menu options whose values are their labels in kebab case. */
const labelled = <const T extends readonly string[]>(labels: T) =>
  labels.map((label) => ({
    value: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  })) as unknown as { [K in keyof T]: { value: Kebab<T[K]>; label: T[K] } };

/** Sound effects a word can play, as in Submagic's word menu. */
export const WORD_SOUNDS = labelled([
  "Click", "Ding", "Money", "Pop", "Staple", "Typing", "Whoosh",
  "Deep Whoosh", "Short Riser", "Grand Hit", "Soft Chime", "Notification",
  "Pencil", "Pin Drop", "Stamp", "Tick", "Send",
] as const);
export type WordSound = (typeof WORD_SOUNDS)[number]["value"];

/** Sounds transitions play. */
export type TransitionSound =
  | "whoosh-long"
  | "whoosh-fire"
  | "paper-slide"
  | "film-burn"
  | "camera-focus"
  | "glitch"
  | "light-leak";

/** Sound files live in each app's public/sfx folder, named by id. */
export const soundPath = (id: WordSound | TransitionSound) => `sfx/${id}.mp3`;

// The files are peak-normalised, so quiet recordings come out loud; these
// bring them in line with the rest.
const SOUND_VOLUME: Partial<Record<WordSound | TransitionSound, number>> = {
  pencil: 0.3,
  "light-leak": 0.3,
  "soft-chime": 0.4,
  "grand-hit": 0.5,
  typing: 0.4,
};
export const soundVolume = (id: WordSound | TransitionSound) =>
  SOUND_VOLUME[id] ?? 0.6;

/** Caption Animation: moves the whole line. Submagic's 49 options, in order. */
export const CAPTION_ANIMATIONS = labelled([
  "None", "show in", "pop in", "pop out", "bounce in", "zoom out", "zoom in",
  "rotate wiggle", "rotate wiggle small", "rotate wiggle mini",
  "rotate wiggle scale", "pop in zoom", "fade in", "fade out", "scale bounce",
  "rotate left", "rotate right", "rotate slow right", "rotate slow left",
  "scale slow in", "slide up", "slide up zoom out", "slide up out",
  "scale rotate right", "typewriter", "typewriter simple", "letter fade in",
  "screw in", "letter spacing in", "letter spacing bounce in",
  "letter spacing large in", "beast bounce in", "slide right bounce",
  "slide right dust", "slide up wiggle", "slide up in",
  "slide left in typewriter", "blink fade", "border reveal",
  "appear in place", "slide right in", "rotate idle wiggle", "benie rise",
  "benie blur rise", "benie keyword", "benie glow flicker", "mark keyword",
  "mark line pop", "mark lines pop",
] as const);

/** Line animations templates use that aren't in the menu. */
export const TEMPLATE_CAPTION_ANIMATIONS = labelled([
  "scale in drift", "bounce in soft", "bounce in elastic", "bounce in pop",
  "slide up in slow", "slide up fade in", "iman keyword in", "ali slide in",
  "ali scale in", "williamv2 batch1", "williamv2 batch2", "williamv2 batch3",
  "williamv2 batch4", "williamv2 batch5", "mattv2 batch1", "mattv2 batch2",
  "mattv2 batch3", "beast slide up bounce in", "nora rise",
] as const);

export type CaptionAnimation =
  | (typeof CAPTION_ANIMATIONS)[number]["value"]
  | (typeof TEMPLATE_CAPTION_ANIMATIONS)[number]["value"];

/** Word Animation: reveals each word. Submagic's 16 options, in order. */
export const WORD_ANIMATIONS = labelled([
  "None", "fade in", "show in", "show in fast", "zoom in", "opacity 30",
  "slide up", "slide up fast", "fade in fast", "white flash reveal",
  "slide right dust", "pop in scale", "pop in scale reverse",
  "slide right in", "slide up micro", "slide up in",
] as const);

export const TEMPLATE_WORD_ANIMATIONS = labelled([
  "slide up in fast", "fade in linear fast", "nora slide in",
  "mattv2 keyword", "mattv2 stagger appear", "mattv2 stagger slide up",
  "dan2 keyword bounce", "sara slide up blur", "sara keyword",
  "beast keyword bounce", "bob keyword elastic", "bob slide up",
] as const);

export type WordAnimation =
  | (typeof WORD_ANIMATIONS)[number]["value"]
  | (typeof TEMPLATE_WORD_ANIMATIONS)[number]["value"];

export type EmojiAnimation =
  | "none"
  | "bounce-in"
  | "bounce-in-wiggle"
  | "fade-in"
  | "slide-up"
  | "beast-bounce";

/** A motion that loops while the caption is on screen. */
export type IdleAnimation = "none" | "dan-wiggle" | "dan2-wiggle" | "laura2-wiggle";

/** How an emphasized line comes in. */
export const EMPHASIS_ANIMATIONS = [
  { value: "default", label: "Default" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
] as const;
export type EmphasisAnimation =
  | (typeof EMPHASIS_ANIMATIONS)[number]["value"]
  | "cinematic"
  | "drawer";

/** Moves the video at key moments. A project setting, not part of a style. */
export const ZOOM_STYLES = labelled([
  "None", "Random zoom", "Zoom Fast", "Crash Zoom", "Expo Zoom",
  "Crash Zoom Out", "Smooth Zoom in", "Fast Snap", "Fast Hold",
  "Smooth Pulse", "Smooth Hold", "Quick In", "Ramp Ease", "Steady Hold",
  "Steady Ease", "Steady Snap", "Smooth In", "Smooth Out", "Steady In",
  "Steady Out", "Camera Shake", "Slide Top", "Slide Bottom", "Slide Left",
  "Slide Right",
] as const);
export type ZoomStyle = (typeof ZOOM_STYLES)[number]["value"];

/** B-roll default layout. A project setting. */
export const BROLL_LAYOUTS = [
  { value: "template", label: "Use template default" },
  { value: "random", label: "Random (Cover / Split 50/50 / Split 35/65)" },
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "split-50-50", label: "Split 50/50" },
  { value: "split-35-65", label: "Split 35/65" },
  { value: "split-50-50-bordered", label: "Split 50/50 (Bordered)" },
  { value: "split-35-65-bordered", label: "Split 35/65 (Bordered)" },
  { value: "green-screen-bottom-right", label: "Green screen (bottom right)" },
  { value: "green-screen-center", label: "Green screen (center)" },
  { value: "small-video-top-right", label: "Small video (top right)" },
  { value: "small-video-bottom-right", label: "Small video (bottom right)" },
  { value: "portrait-small-video-top-right", label: "Portrait + small video (top right)" },
] as const;
export type BrollLayout = (typeof BROLL_LAYOUTS)[number]["value"];

export type StrokeSize = "thin" | "medium" | "large";
export type ShadowSize = "small" | "medium" | "large";
export type EmojiPosition = "auto" | "top";

/**
 * A template can animate captions differently by where they sit. Rotation
 * variants tilt the caption; emoji variants place its emoji; "solo" is a
 * keyword shown on its own.
 */
export type CaptionVariant =
  | "horizontal"
  | "left"
  | "right"
  | "fourth"
  | "solo"
  | "emoji-top"
  | "emoji-bottom"
  | "emoji-left"
  | "emoji-right"
  | "emoji-none";

export interface VariantAnimation {
  caption?: CaptionAnimation;
  word?: WordAnimation;
  emoji?: EmojiAnimation;
  idle?: IdleAnimation;
}

export type TemplateGroup = "emojis" | "classic" | "storytelling" | "archived";

export interface SubtitleStylePreset {
  id: string;
  name: string;
  /** Template filter group. */
  group?: TemplateGroup;
  fontFamily: string;
  /** Size on Submagic's 1 to 70 scale. */
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase" | "lowercase";
  /** Where the template puts captions, in percent of the frame. */
  position?: { x: number; y: number };
  /** Font color, or a CSS gradient. */
  color: string;
  /** Extra space between letters, in ems. */
  letterSpacing?: number;
  /** Shades the bottom of each letter, as in the Hormozi templates. */
  fillGradient?: boolean;
  /** Keywords are drawn in this font. */
  secondaryFontFamily?: string;
  secondaryFontWeight?: number;

  /** Highlight colors for keywords: main, second, third. Off when missing. */
  keywordColors?: [string, string, string];
  /** Color keyword text, or put each keyword in a colored box. */
  keywordStyle?: "color" | "box";
  /** Animation keywords play instead of the word animation. */
  keywordAnimation?: WordAnimation;
  /** Animation a solo keyword plays. */
  soloWordAnimation?: WordAnimation;

  /** Emphasized lines. */
  emphasis?: {
    color: string;
    background: string;
    animation: EmphasisAnimation;
  };

  /** A box behind each line. */
  backgroundColor?: string;
  backgroundPadding?: number;
  /** Box corner radius, in ems of the text. */
  backgroundRadius?: number;

  strokeColor?: string;
  stroke?: StrokeSize;
  /** Outline width in pixels, for styles made before stroke sizes. */
  strokeWidth?: number;
  shadowSize?: ShadowSize;
  shadowColor?: string;
  /** A CSS text-shadow, for styles made before shadow sizes. */
  shadow?: string;

  /** The spoken word's text color. */
  highlightColor?: string;
  /** A box behind the spoken word. */
  highlightBgColor?: string;

  /** How words are cut into captions. */
  layout?: Partial<CaptionLayout>;
  showPunctuation?: boolean;
  /** Display when silences: keep the caption up through pauses. */
  keepThroughSilences?: boolean;
  emojis?: {
    position: EmojiPosition;
    /** Animate the emoji. */
    animate: boolean;
    entrance?: EmojiAnimation;
    /** Put emojis above or below the line at random. */
    randomTopBottom?: boolean;
  };
  animation?: {
    caption: CaptionAnimation;
    word: WordAnimation;
    /** Animation variants: use the per-position animations below. */
    variants: boolean;
  };
  variants?: Partial<Record<CaptionVariant, VariantAnimation>>;
  /** Where a solo keyword's emoji goes. */
  soloVariant?: CaptionVariant;
  /** Loops while each caption is on screen. */
  idle?: IdleAnimation;
  /** Moves alternate captions up and down, or tilts them in turn. */
  alternate?: "updown" | "rotate";
  /** Blurs captions while they move in. */
  motionBlur?: boolean;
}

export function presetLayout(preset: SubtitleStylePreset): CaptionLayout {
  return normalizeCaptionLayout(preset.layout);
}

/** The placement a template starts with. */
export function presetPlacement(
  preset: SubtitleStylePreset,
  width = DEFAULT_CAPTION_WIDTH,
): CaptionPlacement {
  return {
    size: preset.fontSize,
    x: preset.position?.x ?? 50,
    y: preset.position?.y ?? 50,
    width,
  };
}

// Outline widths in ems, from Submagic's rendered CSS.
export const STROKE_EM: Record<StrokeSize, number> = {
  thin: 0.00766,
  medium: 0.15,
  large: 0.2,
};

/** Submagic's shadow presets, with the shadow and font colors filled in. */
export function shadowCss(
  size: ShadowSize,
  shadowColor: string,
  fontColor: string,
): string {
  const font = fontColor.startsWith("linear-gradient") ? shadowColor : fontColor;
  const base = [
    `0px .02299em .01533em ${shadowColor}`,
    `.00766em .00766em .00766em ${shadowColor}`,
    "0px .00766em 0px white",
    `0px 0px .04598em ${shadowColor}`,
    `0px 0px .12261em ${shadowColor}`,
  ];
  const tail =
    size === "small"
      ? [`0px 0px .16858em ${shadowColor}`, `0 0 .12261em ${font}`, `0 0 .0613em ${font}`]
      : [`0 0 .12261em ${font}`, `0 0 ${size === "medium" ? ".18391em" : ".24521em"} ${font}`];
  return [...base, ...tail].join(", ");
}

/** The text-shadow a preset draws with. */
export function presetShadow(preset: SubtitleStylePreset): string | undefined {
  if (preset.shadowSize) {
    return shadowCss(preset.shadowSize, preset.shadowColor ?? "#000000", preset.color);
  }
  return preset.shadow;
}

/** The outline width in ems, given the font size in pixels. */
export function presetStrokeEm(
  preset: SubtitleStylePreset,
  fontSizePx: number,
): number {
  if (!preset.strokeColor) return 0;
  if (preset.stroke) return STROKE_EM[preset.stroke];
  return preset.strokeWidth ? preset.strokeWidth / fontSizePx : 0;
}

/** Line size multipliers from the line menu. */
export const LINE_SIZE_SCALE: Record<LineSize, number> = {
  small: 0.8,
  medium: 1,
  large: 1.25,
};

// Timeline: B-rolls, transitions, sounds, widgets ----------------------------

export type TransitionKind = "motion" | "overlay";

/** Submagic's 20 transitions, with their length in frames at 30 fps and sound. */
export const TRANSITIONS = [
  { value: "none", label: "None", kind: "motion", frames: 0, sound: null, blend: null },
  { value: "slide-blur-top", label: "Slide In Top", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "slide-blur-bottom", label: "Slide In Bottom", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "slide-blur-left", label: "Slide In Left", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "slide-blur-right", label: "Slide In Right", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "zoom-blur-in", label: "Zoom Blur In", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "zoom-blur-out", label: "Zoom Blur Out", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "shake-blur", label: "Shake Blur", kind: "motion", frames: 12, sound: "whoosh-long", blend: null },
  { value: "film-burn-2", label: "Fire Wipe", kind: "overlay", frames: 18, sound: "whoosh-fire", blend: "plus-lighter" },
  { value: "paper-tear", label: "Paper Tear", kind: "motion", frames: 15, sound: "paper-slide", blend: null },
  { value: "fire-wipe", label: "Fire Wipe 2", kind: "overlay", frames: 18, sound: "film-burn", blend: "plus-lighter" },
  { value: "photo-vintage", label: "Retro Filter", kind: "overlay", frames: 12, sound: "camera-focus", blend: "plus-lighter" },
  { value: "film-burn-3", label: "Film Burn", kind: "overlay", frames: 12, sound: "film-burn", blend: "plus-lighter" },
  { value: "vhs", label: "VHS", kind: "overlay", frames: 12, sound: "glitch", blend: "plus-lighter" },
  { value: "swipe-light", label: "Swipe Light", kind: "overlay", frames: 12, sound: "light-leak", blend: "plus-lighter" },
  { value: "light-leak", label: "Light leak", kind: "overlay", frames: 12, sound: "light-leak", blend: "plus-lighter" },
  { value: "glitch", label: "Glitch 2", kind: "overlay", frames: 12, sound: "glitch", blend: "lighten" },
  { value: "paper-slide", label: "Paper Slide", kind: "overlay", frames: 12, sound: "paper-slide", blend: "lighten" },
  { value: "glitch-2", label: "Glitch", kind: "overlay", frames: 12, sound: "glitch", blend: "plus-lighter" },
  { value: "comic", label: "Comic", kind: "overlay", frames: 30, sound: "whoosh-long", blend: "screen" },
  { value: "drawer", label: "Drawer", kind: "overlay", frames: 12, sound: null, blend: "lighten" },
] as const satisfies readonly {
  value: string;
  label: string;
  kind: TransitionKind;
  frames: number;
  sound: TransitionSound | null;
  blend: "plus-lighter" | "lighten" | "screen" | null;
}[];
export type TransitionId = (typeof TRANSITIONS)[number]["value"];
export const transitionInfo = (id: TransitionId) =>
  TRANSITIONS.find((t) => t.value === id) ?? TRANSITIONS[0];

/** Layouts a B-roll clip uses, without the "use template default" choices. */
export type ClipLayout = Exclude<BrollLayout, "template" | "random">;

export interface BrollClip {
  id: string;
  start: number;
  end: number;
  kind: "video" | "image";
  url: string;
  thumbnailUrl?: string;
  vendor: "pexels" | "ai" | "upload";
  layout: ClipLayout;
  /** The page to credit, for stock footage. */
  sourceUrl?: string;
  author?: string;
}

/** A transition at a cut, usually where a scene starts. */
export interface TimelineTransition {
  at: number;
  id: TransitionId;
}

export interface TimelineSound {
  id: string;
  start: number;
  sound: WordSound | TransitionSound;
  /** 0 to 1; the sound's own level when missing. */
  volume?: number;
}

export type CtaStyle = "link" | "message" | "comment" | "subscribe";
export const CTA_STYLES: { value: CtaStyle; label: string; text: string }[] = [
  { value: "link", label: "Link", text: "yoursite.com" },
  { value: "message", label: "Message", text: "Send me a message" },
  { value: "comment", label: "Comment", text: "Comment \"INFO\" below" },
  { value: "subscribe", label: "Subscribe", text: "Subscribe" },
];

export interface TimelineWidget {
  id: string;
  kind: "speaker" | "cta";
  start: number;
  end: number;
  title: string;
  subtitle?: string;
  /** How a call to action looks. */
  style?: CtaStyle;
  /** Size in percent of its natural size. */
  size?: number;
  /** Centre, in percent of the frame. */
  x?: number;
  y?: number;
}

/** Where a new widget goes. */
export const WIDGET_DEFAULTS: Record<TimelineWidget["kind"], { size: number; x: number; y: number }> = {
  speaker: { size: 70, x: 30, y: 72 },
  cta: { size: 70, x: 50, y: 65 },
};

export interface Timeline {
  brolls: BrollClip[];
  transitions: TimelineTransition[];
  sounds: TimelineSound[];
  widgets: TimelineWidget[];
  /** An end card added after the video. */
  outro?: { title: string; subtitle?: string; duration: number };
  /** The part of the source video to keep, in seconds. */
  trim?: { start: number; end: number };
}

export const EMPTY_TIMELINE: Timeline = {
  brolls: [],
  transitions: [],
  sounds: [],
  widgets: [],
};

/** How long the composition runs for a source duration. */
export function timelineDuration(timeline: Timeline | undefined, sourceDuration: number) {
  const start = timeline?.trim?.start ?? 0;
  const end = timeline?.trim?.end ?? sourceDuration;
  return Math.max(0.1, end - start) + (timeline?.outro?.duration ?? 0);
}
