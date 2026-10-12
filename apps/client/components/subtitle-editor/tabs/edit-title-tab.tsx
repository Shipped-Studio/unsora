"use client";

import { useId, useState } from "react";
import {
  ClockCounterClockwise,
  KeyReturn,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ChoiceGroup,
  ChoiceItem,
  ColorField,
  EditorSection,
  FONT_SELECT_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  FieldCaption,
  OVERLAY_COLORS,
  SelectField,
  SliderField,
  SwitchRow,
  renderFontOption,
} from "@/components/subtitle-editor/editor-fields";
import {
  TITLE_OVERLAY_DEFAULTS,
  parseTitle,
  type TitleOverlayConfig,
  type TitleStyle,
  type TitleWord,
} from "@/components/subtitle-editor/title-overlay";
import {
  TITLE_THEMES,
  type TitleTheme,
} from "@/components/subtitle-editor/title-themes";
import { cn } from "@/lib/utils";
import { getFontFamily } from "@/remotion/fonts";

const MAX_HISTORY = 10;

/** Writes lines back as text, grouping neighbouring accent words: `*a b*`. */
function serializeTitle(lines: TitleWord[][]): string {
  return lines
    .map((line) => {
      const parts: string[] = [];
      let accent: string[] = [];
      const flush = () => {
        if (accent.length) parts.push(`*${accent.join(" ")}*`);
        accent = [];
      };
      for (const word of line) {
        if (word.accent) accent.push(word.text);
        else {
          flush();
          parts.push(word.text);
        }
      }
      flush();
      return parts.join(" ");
    })
    .join("\n");
}

interface EditTitleTabProps {
  config: TitleOverlayConfig;
  onChange: (config: TitleOverlayConfig) => void;
  /** Resolves to a new hook, or null if it failed (the caller reports why). */
  onGenerate: (previousHooks: string[]) => Promise<string | null>;
  /** False until the video has a transcript to write a hook from. */
  canGenerate: boolean;
}

export function EditTitleTab({
  config,
  onChange,
  onGenerate,
  canGenerate,
}: EditTitleTabProps) {
  const textId = useId();
  const [isGenerating, setIsGenerating] = useState(false);

  const update = <K extends keyof TitleOverlayConfig>(
    key: K,
    value: TitleOverlayConfig[K],
  ) => onChange({ ...config, [key]: value });

  const updateStyle = <K extends keyof TitleStyle>(
    key: K,
    value: TitleStyle[K],
  ) => onChange({ ...config, style: { ...config.style, [key]: value } });

  const lines = parseTitle(config.text);

  const toggleAccent = (lineIndex: number, wordIndex: number) => {
    const next = lines.map((line, l) =>
      line.map((word, w) =>
        l === lineIndex && w === wordIndex
          ? { ...word, accent: !word.accent }
          : word,
      ),
    );
    update("text", serializeTitle(next));
  };

  const generate = async () => {
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
    <div className="space-y-8">
      <EditorSection
        title="Hook title"
        description="Shown at the start of the video to make viewers keep watching."
        actions={
          <>
            <HistoryPopover
              history={config.history}
              onPick={(hook) => update("text", hook)}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear title"
              disabled={!config.text}
              onClick={() => update("text", "")}
            >
              <Trash />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canGenerate || isGenerating}
              onClick={generate}
            >
              {isGenerating ? <Spinner /> : <Sparkle />}
              {config.text ? "Rewrite with AI" : "Write with AI"}
            </Button>
          </>
        }
      >
        <SwitchRow
          label="Show hook title"
          checked={config.enabled}
          onCheckedChange={(checked) => update("enabled", checked)}
        />
        <div className="space-y-2">
          <FieldCaption htmlFor={textId}>Text</FieldCaption>
          <Textarea
            id={textId}
            rows={2}
            value={config.text}
            onChange={(event) => update("text", event.target.value)}
            placeholder={
              canGenerate
                ? "Write a hook, or let AI write one from your video"
                : "Write a hook"
            }
          />
        </div>
        {lines.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Tap words to give them the accent style
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {lines.map((line, lineIndex) => (
                <div key={lineIndex} className="contents">
                  {lineIndex > 0 ? (
                    <KeyReturn
                      aria-label="Line break"
                      className="size-4 text-muted-foreground"
                    />
                  ) : null}
                  {line.map((word, wordIndex) => (
                    <button
                      key={wordIndex}
                      type="button"
                      aria-pressed={word.accent}
                      onClick={() => toggleAccent(lineIndex, wordIndex)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        word.accent
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-foreground hover:bg-muted",
                      )}
                    >
                      {word.text}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </EditorSection>

      <EditorSection title="Theme">
        <div
          role="group"
          aria-label="Title themes"
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
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

      <EditorSection title="Font">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <SelectField
            label="Font"
            options={FONT_SELECT_OPTIONS}
            value={config.style.fontFamily}
            onChange={(value) => updateStyle("fontFamily", value)}
            renderOption={renderFontOption}
          />
          <SelectField
            label="Weight"
            options={FONT_WEIGHT_OPTIONS}
            value={String(config.style.fontWeight)}
            onChange={(value) => updateStyle("fontWeight", Number(value))}
          />
          <SelectField
            label="Accent font"
            options={FONT_SELECT_OPTIONS}
            value={config.style.accentFontFamily}
            onChange={(value) => updateStyle("accentFontFamily", value)}
            renderOption={renderFontOption}
          />
          <SelectField
            label="Accent weight"
            options={FONT_WEIGHT_OPTIONS}
            value={String(config.style.accentFontWeight)}
            onChange={(value) => updateStyle("accentFontWeight", Number(value))}
          />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Case
          </span>
          <ChoiceGroup
            label="Letter case"
            value={config.style.textTransform}
            onChange={(value) => updateStyle("textTransform", value)}
            className="grid grid-cols-2"
          >
            <ChoiceItem value="none">As typed</ChoiceItem>
            <ChoiceItem value="uppercase">UPPERCASE</ChoiceItem>
          </ChoiceGroup>
        </div>
        <ColorField
          label="Text color"
          value={config.style.color}
          options={OVERLAY_COLORS}
          onChange={(color) => updateStyle("color", color)}
        />
        <ColorField
          label="Accent color"
          value={config.style.accentColor}
          options={OVERLAY_COLORS}
          onChange={(color) => updateStyle("accentColor", color)}
        />
      </EditorSection>

      <EditorSection title="Size and position">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <SliderField
            label="Size"
            unit="%"
            value={config.size}
            min={3}
            max={15}
            step={0.5}
            defaultValue={TITLE_OVERLAY_DEFAULTS.size}
            onChange={(value) => update("size", value)}
          />
          <SliderField
            label="Width"
            unit="%"
            value={config.width}
            min={10}
            max={100}
            defaultValue={TITLE_OVERLAY_DEFAULTS.width}
            onChange={(value) => update("width", value)}
          />
          <SliderField
            label="Horizontal position"
            unit="%"
            value={config.positionX}
            min={0}
            max={100}
            defaultValue={TITLE_OVERLAY_DEFAULTS.positionX}
            onChange={(value) => update("positionX", value)}
          />
          <SliderField
            label="Vertical position"
            unit="%"
            value={config.positionY}
            min={0}
            max={100}
            defaultValue={TITLE_OVERLAY_DEFAULTS.positionY}
            onChange={(value) => update("positionY", value)}
          />
        </div>
      </EditorSection>

      <EditorSection title="Timing and animation">
        <SwitchRow
          label="Show for the whole video"
          checked={config.fullVideo}
          onCheckedChange={(checked) => update("fullVideo", checked)}
        />
        {config.fullVideo ? null : (
          <SliderField
            label="Duration"
            unit="s"
            value={config.duration}
            min={1}
            max={10}
            step={0.5}
            defaultValue={TITLE_OVERLAY_DEFAULTS.duration}
            onChange={(value) => update("duration", value)}
          />
        )}
        <SwitchRow
          label="Animate in"
          checked={config.animation}
          onCheckedChange={(checked) => update("animation", checked)}
        />
      </EditorSection>
    </div>
  );
}

function HistoryPopover({
  history,
  onPick,
}: {
  history: string[];
  onPick: (hook: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Earlier hooks"
            disabled={history.length === 0}
          />
        }
      >
        <ClockCounterClockwise />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Earlier hooks</PopoverTitle>
        </PopoverHeader>
        <ul className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto">
          {history.map((hook) => (
            <li key={hook}>
              <button
                type="button"
                onClick={() => {
                  onPick(hook);
                  setOpen(false);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm whitespace-pre-line outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {hook.replace(/\*/g, "")}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** The theme's name drawn in its accent style. */
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
        "flex h-14 min-w-0 items-center justify-center overflow-hidden rounded-lg bg-slate-600 px-2 outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-foreground hover:ring-foreground",
      )}
    >
      <span
        aria-hidden
        className="whitespace-nowrap"
        style={{
          fontFamily: getFontFamily(style.accentFontFamily),
          fontWeight: style.accentFontWeight,
          fontSize: 18 * (style.accentScale ?? 1),
          lineHeight: 1.2,
          textTransform: style.textTransform,
          color: style.accentColor,
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
    </button>
  );
}
