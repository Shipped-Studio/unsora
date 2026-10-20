"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowsClockwise,
  Clock,
  KeyReturn,
  Plus,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ColorField,
  EditorSection,
  FONT_SELECT_OPTIONS,
  OVERLAY_COLORS,
  SelectField,
  SliderField,
  SwitchRow,
  renderFontOption,
} from "@/components/subtitle-editor/editor-fields";
import { formatTimestamp } from "@/components/subtitle-editor/format";
import {
  TITLE_OVERLAY_DEFAULTS,
  parseTitle,
  serializeTitle,
  type TitleHighlight,
  type TitleOverlayConfig,
  type TitleStyle,
  type TitleWord,
} from "@/components/subtitle-editor/title-overlay";
import {
  TITLE_THEMES,
  type TitleTheme,
} from "@/components/subtitle-editor/title-themes";
import { cn } from "@/lib/utils";
import { fontWeights, getFontFamily } from "@/remotion/fonts";

const MAX_HISTORY = 10;

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

const weightOptions = (font: string) =>
  fontWeights(font).map((weight) => ({
    value: String(weight),
    label: WEIGHT_LABELS[weight] ?? String(weight),
  }));

interface HookTitleEditorProps {
  config: TitleOverlayConfig;
  onChange: (config: TitleOverlayConfig) => void;
  /** Resolves to a new hook, or null if it failed (the caller reports why). */
  onGenerate: (previousHooks: string[]) => Promise<string | null>;
  /** False until the video has a transcript to write a hook from. */
  canGenerate: boolean;
  /** Where the preview is, for Set start time. */
  getCurrentTime: () => number;
  onBack: () => void;
}

/** The hook title editor from Submagic's Captions tab. */
export function HookTitleEditor({
  config,
  onChange,
  onGenerate,
  canGenerate,
  getCurrentTime,
  onBack,
}: HookTitleEditorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const update = <K extends keyof TitleOverlayConfig>(
    key: K,
    value: TitleOverlayConfig[K],
  ) => onChange({ ...config, [key]: value });

  const updateStyle = <K extends keyof TitleStyle>(
    key: K,
    value: TitleStyle[K],
  ) => onChange({ ...config, style: { ...config.style, [key]: value } });


  const regenerate = async () => {
    setIsGenerating(true);
    const hook = await onGenerate(config.history);
    setIsGenerating(false);
    if (!hook) return;
    onChange({
      ...config,
      enabled: true,
      text: hook,
      history: [hook, ...config.history.filter((h) => h !== hook)].slice(
        0,
        MAX_HISTORY,
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back to captions"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-sm font-medium">Hook Title</h2>
      </div>

      <section className="space-y-5 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
            <Sparkle weight="fill" />
            Hook Title
          </span>
          <div className="flex items-center gap-0.5">
            <IconAction
              label={
                config.fullVideo
                  ? "Set start time (off while shown for the full video)"
                  : `Set start time (now ${formatTimestamp(config.start ?? 0)})`
              }
              disabled={config.fullVideo}
              onClick={() => onChange({ ...config, start: Math.max(0, getCurrentTime()) })}
            >
              <Clock />
            </IconAction>
            <IconAction
              label="Regenerate"
              disabled={!canGenerate || isGenerating}
              onClick={regenerate}
            >
              {isGenerating ? <Spinner /> : <ArrowsClockwise />}
            </IconAction>
            <IconAction
              label="Delete"
              disabled={!config.text && !config.enabled}
              onClick={() => onChange({ ...config, enabled: false, text: "" })}
            >
              <Trash />
            </IconAction>
          </div>
        </div>

        <TitleWords
          text={config.text}
          onChange={(text) => onChange({ ...config, enabled: Boolean(text.trim()), text })}
          canGenerate={canGenerate}
        />

      <EditorSection title="Theme">
        <div
          role="group"
          aria-label="Hook title themes"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {TITLE_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={theme.id === config.themeId}
              onSelect={() =>
                onChange({ ...config, themeId: theme.id, style: theme.style })
              }
            />
          ))}
        </div>
      </EditorSection>

      </section>

      <EditorSection title="Font">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <SelectField
            label="Font family"
            options={FONT_SELECT_OPTIONS}
            value={config.style.fontFamily}
            onChange={(value) => updateStyle("fontFamily", value)}
            renderOption={renderFontOption}
          />
          <SelectField
            label="Font weight"
            options={weightOptions(config.style.fontFamily)}
            value={String(config.style.fontWeight)}
            onChange={(value) => updateStyle("fontWeight", Number(value))}
          />
          <SelectField
            label="Secondary font"
            options={FONT_SELECT_OPTIONS}
            value={config.style.accentFontFamily}
            onChange={(value) => updateStyle("accentFontFamily", value)}
            renderOption={renderFontOption}
          />
          <SelectField
            label="Secondary weight"
            options={weightOptions(config.style.accentFontFamily)}
            value={String(config.style.accentFontWeight)}
            onChange={(value) => updateStyle("accentFontWeight", Number(value))}
          />
        </div>
        <ColorField
          label="Font color"
          value={config.style.color}
          options={OVERLAY_COLORS}
          onChange={(color) => updateStyle("color", color)}
        />
      </EditorSection>

      <EditorSection title="Size and timing">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <SliderField
            label="Size"
            unit="%"
            value={Math.round(config.size)}
            min={0}
            max={80}
            defaultValue={TITLE_OVERLAY_DEFAULTS.size}
            onChange={(value) => update("size", value)}
          />
          <SliderField
            label="Position Y"
            unit="%"
            value={Math.round(config.positionY)}
            min={0}
            max={80}
            defaultValue={TITLE_OVERLAY_DEFAULTS.positionY}
            onChange={(value) => update("positionY", value)}
          />
        </div>
        {config.fullVideo ? null : (
          <SliderField
            label="Duration"
            unit="s"
            value={config.duration}
            min={0}
            max={6}
            step={0.1}
            defaultValue={TITLE_OVERLAY_DEFAULTS.duration}
            onChange={(value) => update("duration", value)}
          />
        )}
        <SwitchRow
          label="Show for full video"
          checked={config.fullVideo}
          onCheckedChange={(checked) => update("fullVideo", checked)}
        />
        <SwitchRow
          label="Animation"
          checked={config.animation}
          onCheckedChange={(checked) => update("animation", checked)}
        />
      </EditorSection>
    </div>
  );
}

/** The theme's name drawn in its style. */
function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: TitleTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const { style } = theme;
  const box: React.CSSProperties = style.accentBackgroundColor
    ? {
        backgroundColor: style.accentBackgroundColor,
        padding: "0 0.18em",
        borderRadius: "0.14em",
      }
    : style.backgroundColor
      ? {
          backgroundColor: style.backgroundColor,
          padding: "0.1em 0.45em",
          borderRadius: style.pill ? 9999 : "0.22em",
        }
      : {};

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${theme.name} theme`}
      onClick={onSelect}
      className={cn(
        "relative flex h-[88px] min-w-0 items-center justify-center rounded-lg bg-[#4B5563] px-2 outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-foreground hover:ring-foreground",
      )}
    >
      <span
        aria-hidden
        className="whitespace-nowrap"
        style={{
          fontFamily: getFontFamily(style.fontFamily),
          fontWeight: style.fontWeight,
          fontSize: 20,
          lineHeight: 1.2,
          letterSpacing: style.letterSpacing ? `${style.letterSpacing}em` : undefined,
          textTransform: style.textTransform,
          color: style.color,
          textShadow: style.shadow,
          ...(style.strokeColor && style.strokeWidth
            ? {
                WebkitTextStroke: `${style.strokeWidth}em ${style.strokeColor}`,
                paintOrder: "stroke fill",
              }
            : {}),
          ...box,
        }}
      >
        {theme.name}
      </span>
      {NEW_THEMES.has(theme.id) ? (
        <span className="absolute -top-2 right-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-600 dark:bg-sky-500/20 dark:text-sky-300">
          New
        </span>
      ) : null}
    </button>
  );
}

// Themes Submagic marks as new.
const NEW_THEMES = new Set(["pierre", "neo", "sam"]);

// Underlines for highlighted words in the editor, as in the caption list.
const HIGHLIGHT_UNDERLINE: Record<TitleHighlight, string> = {
  1: "#F64F46",
  2: "#E8B04A",
  3: "#3F83F8",
};

const TITLE_HIGHLIGHTS: { value: TitleHighlight | undefined; label: string; key: string }[] = [
  { value: undefined, label: "None", key: "n" },
  { value: 1, label: "Main", key: "h" },
  { value: 2, label: "Second", key: "j" },
  { value: 3, label: "Third", key: "k" },
];

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 [&_svg]:size-[18px]"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface FlatWord {
  text: string;
  level?: TitleHighlight;
  /** A line break follows this word. */
  break: boolean;
}

const flatten = (text: string): FlatWord[] =>
  parseTitle(text).flatMap((line, l, lines) =>
    line.map((word, w) => ({
      text: word.text,
      level: word.level,
      break: w === line.length - 1 && l < lines.length - 1,
    })),
  );

function unflatten(words: FlatWord[]): string {
  const lines: TitleWord[][] = [[]];
  words.forEach((word, i) => {
    if (!word.text.trim()) return;
    lines[lines.length - 1].push({ text: word.text.trim(), level: word.level, accent: word.level === 3 });
    if (word.break && i < words.length - 1) lines.push([]);
  });
  return serializeTitle(lines.filter((line) => line.length));
}

/** The hook as a line of words, edited in place like the caption list. */
function TitleWords({
  text,
  onChange,
  canGenerate,
}: {
  text: string;
  onChange: (text: string) => void;
  canGenerate: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const words = flatten(text);
  const set = (next: FlatWord[]) => onChange(unflatten(next));
  const at = (i: number, patch: Partial<FlatWord>) =>
    set(words.map((word, j) => (j === i ? { ...word, ...patch } : word)));

  if (!words.length) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) onChange(draft.trim());
          setDraft("");
        }}
      >
        <Input
          aria-label="Hook title"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canGenerate ? "Write a hook and press Enter, or Regenerate" : "Write a hook and press Enter"}
        />
      </form>
    );
  }

  return (
    <div className="group flex flex-wrap items-center text-base leading-5 text-[#212224] dark:text-foreground">
      {words.map((word, i) => (
        <span key={`${i}-${word.text}`} className="contents">
          <Popover open={open === i} onOpenChange={(next) => setOpen(next ? i : null)}>
            <PopoverTrigger
              nativeButton={false}
              render={
                <span
                  role="textbox"
                  aria-label={`Word "${word.text}"`}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(event) => {
                    const next = (event.currentTarget.textContent ?? "").trim();
                    if (next === word.text) return;
                    set(next ? words.map((w, j) => (j === i ? { ...w, text: next } : w)) : words.filter((_, j) => j !== i));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                      return;
                    }
                    if (!(event.metaKey || event.ctrlKey)) return;
                    const key = event.key.toLowerCase();
                    const highlight = TITLE_HIGHLIGHTS.find((h) => h.key === key);
                    if (highlight) {
                      event.preventDefault();
                      at(i, { level: highlight.value });
                    } else if (key === "b" && i < words.length - 1) {
                      event.preventDefault();
                      at(i, { break: !word.break });
                    }
                  }}
                  className="relative mx-0.5 inline-flex min-h-7 items-center rounded-[4px] border border-transparent px-0.5 outline-none transition-colors duration-200 hover:border-[#3F83F8] focus:border-[#3F83F8] data-[popup-open]:border-[#3F83F8]"
                />
              }
            >
              {word.text}
              {word.level ? (
                <span
                  aria-hidden
                  contentEditable={false}
                  className="pointer-events-none absolute bottom-[0.1em] left-0 h-0.5 w-full shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                  style={{ background: HIGHLIGHT_UNDERLINE[word.level] }}
                />
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} initialFocus={false} className="w-64 gap-3 p-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Highlight color</span>
                <div role="group" aria-label="Highlight color" className="grid grid-cols-4 gap-1">
                  {TITLE_HIGHLIGHTS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      title={`⌘${option.key.toUpperCase()}`}
                      aria-pressed={word.level === option.value}
                      onClick={() => at(i, { level: option.value })}
                      className="flex h-8 items-center justify-center gap-1 rounded-md border text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                    >
                      {option.value ? (
                        <span
                          aria-hidden
                          className="h-0.5 w-2.5 rounded"
                          style={{ background: HIGHLIGHT_UNDERLINE[option.value] }}
                        />
                      ) : null}
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Third uses the secondary font.</p>
              </div>
              <div className="-mx-1 grid border-t pt-1">
                {i < words.length - 1 ? (
                  <TitleAction keys="⌘B" onClick={() => at(i, { break: !word.break })}>
                    <KeyReturn />
                    {word.break ? "Remove line break" : "Add line break"}
                  </TitleAction>
                ) : null}
                <TitleAction
                  keys=""
                  onClick={() => {
                    set([...words.slice(0, i + 1), { text: "word", break: false }, ...words.slice(i + 1)]);
                    setOpen(i + 1);
                  }}
                >
                  <Plus />
                  Add word
                </TitleAction>
                <TitleAction
                  keys=""
                  destructive
                  onClick={() => {
                    set(words.filter((_, j) => j !== i));
                    setOpen(null);
                  }}
                >
                  <Trash />
                  Remove word
                </TitleAction>
              </div>
            </PopoverContent>
          </Popover>
          {word.break && i < words.length - 1 ? (
            <button
              type="button"
              aria-label="Remove line break"
              title="Remove line break"
              onClick={() => at(i, { break: false })}
              className="mr-1 inline-flex items-center text-[#9CA3AF] outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <KeyReturn className="size-4" />
            </button>
          ) : null}
        </span>
      ))}
      <button
        type="button"
        aria-label="Add a word"
        onClick={() => {
          set([...words, { text: "word", break: false }]);
          setOpen(words.length);
        }}
        className="ml-0.5 inline-flex size-6 items-center justify-center rounded-md text-[#A9A9AE] opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function TitleAction({
  keys,
  destructive,
  onClick,
  children,
}: {
  keys: string;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0",
        destructive ? "text-destructive" : "[&_svg]:text-muted-foreground",
      )}
    >
      {children}
      {keys ? <span className="ml-auto text-xs text-muted-foreground">{keys}</span> : null}
    </button>
  );
}
