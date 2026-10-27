"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FloppyDisk, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  CAPTION_LAYOUT_LIMITS,
  type CaptionLayout,
} from "@/components/subtitle-editor/caption-layout";
import {
  BROLL_LAYOUTS,
  CAPTION_ANIMATIONS,
  CAPTION_PLACEMENT_LIMITS,
  EMPHASIS_ANIMATIONS,
  TEMPLATE_CAPTION_ANIMATIONS,
  TEMPLATE_WORD_ANIMATIONS,
  WORD_ANIMATIONS,
  ZOOM_STYLES,
  presetLayout,
  type BrollLayout,
  type CaptionAnimation,
  type CaptionPlacement,
  type EmphasisAnimation,
  type ShadowSize,
  type StrokeSize,
  type WordAnimation,
  type ZoomStyle,
} from "@/components/subtitle-editor/caption-style";
import {
  ChoiceGroup,
  ChoiceItem,
  ColorField,
  EditorSection,
  FONT_SELECT_OPTIONS,
  OVERLAY_COLORS,
  SelectField,
  SliderField,
  SwitchRow,
  renderFontOption,
  type SelectOption,
} from "@/components/subtitle-editor/editor-fields";
import { failureMessage } from "@/components/subtitle-editor/format";
import type { SubtitleStylePreset } from "@/components/subtitle-editor/style-presets";
import type { PreviewStyleConfig } from "@/components/subtitle-editor/tabs/preview-style-tab";
import { uploadFileToStorage } from "@/lib/storage-client";
import {
  CUSTOM_FONT_PREFIX,
  customFontLabel,
  fontWeights,
} from "@/remotion/fonts";
import { IconButton } from "@/components/subtitle-editor/icon-button";

const FONT_FILE_TYPES = ".ttf,.otf,.woff,.woff2";
const COLORS_WITH_NONE = ["transparent", ...OVERLAY_COLORS];
const DEFAULT_EMPHASIS = {
  color: "#ffffff",
  background: "transparent",
  animation: "default" as EmphasisAnimation,
};

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

/** Menu options, plus a template's own value when it isn't in the menu. */
function menu(
  list: readonly { value: string; label: string }[],
  extra: readonly { value: string; label: string }[],
  current: string,
): SelectOption[] {
  const options = list.map(({ value, label }) => ({ value, label }));
  if (options.some((o) => o.value === current)) return options;
  const own = extra.find((o) => o.value === current);
  return own ? [...options, { value: own.value, label: own.label }] : options;
}

interface CustomizePresetPanelProps {
  preset: SubtitleStylePreset;
  onChange: (preset: SubtitleStylePreset) => void;
  /** The template as it was before customizing, for Reset. */
  original: SubtitleStylePreset | null;
  onBack: () => void;
  /** Resolves true once saved. */
  onSaveAsNew: (name: string) => Promise<boolean>;
  placement: CaptionPlacement;
  onPlacementChange: (placement: CaptionPlacement) => void;
  previewStyle: PreviewStyleConfig;
  onPreviewStyleChange: (config: PreviewStyleConfig) => void;
}

/** A template's Basic and Advanced settings, as in Submagic's Style tab. */
export function CustomizePresetPanel({
  preset,
  onChange,
  original,
  onBack,
  onSaveAsNew,
  placement,
  onPlacementChange,
  previewStyle,
  onPreviewStyleChange,
}: CustomizePresetPanelProps) {
  const update = <K extends keyof SubtitleStylePreset>(
    key: K,
    value: SubtitleStylePreset[K],
  ) => onChange({ ...preset, [key]: value });
  const layout = presetLayout(preset);
  const updateLayout = (patch: Partial<CaptionLayout>) =>
    onChange({ ...preset, layout: { ...layout, ...patch } });
  const emphasis = preset.emphasis ?? DEFAULT_EMPHASIS;
  const updateEmphasis = (patch: Partial<typeof emphasis>) =>
    update("emphasis", { ...emphasis, ...patch });

  const [section, setSection] = useState<"basic" | "advanced">("basic");

  const isOriginal =
    !original ||
    JSON.stringify({ ...original, id: "", name: "" }) ===
      JSON.stringify({ ...preset, id: "", name: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <IconButton variant="outline" label="Back to templates" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {preset.name}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={isOriginal}
          onClick={() => original && onChange(original)}
        >
          Reset
        </Button>
        <SaveAsNewPopover defaultName={preset.name} onSave={onSaveAsNew} />
      </div>

      {/* A toggle, not nested tabs: those would take the editor menu's styles. */}
      <ChoiceGroup
        label="Settings"
        value={section}
        onChange={setSection}
        className="grid grid-cols-2"
      >
        <ChoiceItem value="basic">Basic</ChoiceItem>
        <ChoiceItem value="advanced">Advanced</ChoiceItem>
      </ChoiceGroup>

      {section === "basic" ? (
        <div className="space-y-8">
          <SliderField
            label="Nb words displayed"
            unit=""
            value={layout.wordsPerCaption}
            min={CAPTION_LAYOUT_LIMITS.wordsPerCaption.min}
            max={CAPTION_LAYOUT_LIMITS.wordsPerCaption.max}
            onChange={(value) => updateLayout({ wordsPerCaption: value })}
          />

          <FontSection
            preset={preset}
            onChange={onChange}
            size={placement.size}
            onSizeChange={(size) => onPlacementChange({ ...placement, size })}
          />

          <EditorSection title="Position">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <SliderField
                label="Vertical"
                unit="%"
                value={Math.round(placement.y)}
                min={CAPTION_PLACEMENT_LIMITS.y.min}
                max={CAPTION_PLACEMENT_LIMITS.y.max}
                defaultValue={preset.position?.y}
                onChange={(y) => onPlacementChange({ ...placement, y })}
              />
              <SliderField
                label="Horizontal"
                unit="%"
                value={Math.round(placement.x)}
                min={CAPTION_PLACEMENT_LIMITS.x.min}
                max={CAPTION_PLACEMENT_LIMITS.x.max}
                defaultValue={preset.position?.x}
                onChange={(x) => onPlacementChange({ ...placement, x })}
              />
            </div>
          </EditorSection>

          <EditorSection title="Colors">
            <ColorField
              label="Font"
              value={preset.color}
              options={OVERLAY_COLORS}
              onChange={(color) => update("color", color)}
            />
            {preset.backgroundColor ? (
              <ColorField
                label="Caption background"
                value={preset.backgroundColor}
                options={COLORS_WITH_NONE}
                onChange={(color) =>
                  update("backgroundColor", color === "transparent" ? undefined : color)
                }
              />
            ) : null}
            <SwitchRow
              label="Keyword highlights"
              checked={Boolean(preset.keywordColors)}
              onCheckedChange={(checked) =>
                update(
                  "keywordColors",
                  checked
                    ? (original?.keywordColors ?? ["#2bf82a", "#fdfa14", "#f01916"])
                    : undefined,
                )
              }
            />
            {preset.keywordColors ? (
              <div className="space-y-5 rounded-xl border p-3">
                {(["Main", "Second", "Third"] as const).map((label, i) => (
                  <ColorField
                    key={label}
                    label={label}
                    value={preset.keywordColors![i]}
                    options={OVERLAY_COLORS}
                    onChange={(color) => {
                      const next = [...preset.keywordColors!] as [
                        string,
                        string,
                        string,
                      ];
                      next[i] = color;
                      update("keywordColors", next);
                    }}
                  />
                ))}
              </div>
            ) : null}
            <ColorField
              label="Emphasized font"
              value={emphasis.color}
              options={OVERLAY_COLORS}
              onChange={(color) => updateEmphasis({ color })}
            />
            <ColorField
              label="Emphasized background"
              value={emphasis.background}
              options={COLORS_WITH_NONE}
              onChange={(background) => updateEmphasis({ background })}
            />
          </EditorSection>
        </div>
      ) : (
        <div className="space-y-8">
          <EditorSection title="Stroke">
            <SwitchRow
              label="Stroke"
              checked={Boolean(preset.strokeColor && (preset.stroke || preset.strokeWidth))}
              onCheckedChange={(checked) =>
                onChange({
                  ...preset,
                  strokeColor: checked ? (preset.strokeColor ?? "#000000") : undefined,
                  stroke: checked ? (preset.stroke ?? "thin") : undefined,
                  strokeWidth: undefined,
                })
              }
            />
            {preset.strokeColor && (preset.stroke || preset.strokeWidth) ? (
              <>
                <SizeChoice<StrokeSize>
                  label="Weight"
                  value={preset.stroke ?? "medium"}
                  options={[
                    ["thin", "Thin"],
                    ["medium", "Medium"],
                    ["large", "Large"],
                  ]}
                  onChange={(stroke) =>
                    onChange({ ...preset, stroke, strokeWidth: undefined })
                  }
                />
                <ColorField
                  label="Color"
                  value={preset.strokeColor}
                  options={OVERLAY_COLORS}
                  onChange={(color) => update("strokeColor", color)}
                />
              </>
            ) : null}
          </EditorSection>

          <EditorSection title="Shadow">
            <SwitchRow
              label="Shadow"
              checked={Boolean(preset.shadowSize || preset.shadow)}
              onCheckedChange={(checked) =>
                onChange({
                  ...preset,
                  shadowSize: checked ? (preset.shadowSize ?? "small") : undefined,
                  shadowColor: checked ? (preset.shadowColor ?? "#000000") : undefined,
                  shadow: undefined,
                })
              }
            />
            {preset.shadowSize || preset.shadow ? (
              <>
                <SizeChoice<ShadowSize>
                  label="Size"
                  value={preset.shadowSize ?? "small"}
                  options={[
                    ["small", "Small"],
                    ["medium", "Medium"],
                    ["large", "Large"],
                  ]}
                  onChange={(shadowSize) =>
                    onChange({
                      ...preset,
                      shadowSize,
                      shadowColor: preset.shadowColor ?? "#000000",
                      shadow: undefined,
                    })
                  }
                />
                <ColorField
                  label="Color"
                  value={preset.shadowColor ?? "#000000"}
                  options={OVERLAY_COLORS}
                  onChange={(color) =>
                    onChange({
                      ...preset,
                      shadowColor: color,
                      shadowSize: preset.shadowSize ?? "small",
                      shadow: undefined,
                    })
                  }
                />
              </>
            ) : null}
          </EditorSection>

          <EditorSection title="Emojis">
            <SwitchRow
              label="Emojis"
              checked={Boolean(preset.emojis)}
              onCheckedChange={(checked) =>
                update(
                  "emojis",
                  checked
                    ? (original?.emojis ?? { position: "auto", animate: false, entrance: "bounce-in" })
                    : undefined,
                )
              }
            />
            {preset.emojis ? (
              <>
                <ChoiceGroup
                  label="Emoji position"
                  value={preset.emojis.position}
                  onChange={(position) =>
                    update("emojis", { ...preset.emojis!, position })
                  }
                  className="grid grid-cols-2"
                >
                  <ChoiceItem value="auto">Auto</ChoiceItem>
                  <ChoiceItem value="top">Top</ChoiceItem>
                </ChoiceGroup>
                <SwitchRow
                  label="Animate"
                  checked={preset.emojis.animate}
                  onCheckedChange={(animate) =>
                    update("emojis", { ...preset.emojis!, animate })
                  }
                />
              </>
            ) : null}
          </EditorSection>

          <EditorSection title="Caption lines">
            <SwitchRow
              label="Line break"
              checked={layout.breakLines}
              onCheckedChange={(breakLines) => updateLayout({ breakLines })}
            />
            <SwitchRow
              label="Punctuation"
              checked={Boolean(preset.showPunctuation)}
              onCheckedChange={(checked) => update("showPunctuation", checked)}
            />
            <SwitchRow
              label="Display when silences"
              checked={preset.keepThroughSilences !== false}
              onCheckedChange={(checked) =>
                update("keepThroughSilences", checked)
              }
            />
          </EditorSection>

          <EditorSection title="Emphasized text">
            <SelectField
              label="Animation"
              options={menu(
                EMPHASIS_ANIMATIONS,
                [
                  { value: "cinematic", label: "Cinematic" },
                  { value: "drawer", label: "Drawer" },
                ],
                emphasis.animation,
              )}
              value={emphasis.animation}
              onChange={(value) =>
                updateEmphasis({ animation: value as EmphasisAnimation })
              }
            />
            <ColorField
              label="Font color"
              value={emphasis.color}
              options={OVERLAY_COLORS}
              onChange={(color) => updateEmphasis({ color })}
            />
            <ColorField
              label="Background color"
              value={emphasis.background}
              options={COLORS_WITH_NONE}
              onChange={(background) => updateEmphasis({ background })}
            />
          </EditorSection>

          <EditorSection title="Animations">
            <SwitchRow
              label="Animations"
              checked={Boolean(preset.animation)}
              onCheckedChange={(checked) =>
                update(
                  "animation",
                  checked
                    ? (original?.animation ?? {
                        caption: "none",
                        word: "none",
                        variants: Boolean(preset.variants),
                      })
                    : undefined,
                )
              }
            />
            {preset.animation ? (
              <>
                <SelectField
                  label="Caption animation"
                  options={menu(
                    CAPTION_ANIMATIONS,
                    TEMPLATE_CAPTION_ANIMATIONS,
                    preset.animation.caption,
                  )}
                  value={preset.animation.caption}
                  onChange={(value) =>
                    update("animation", {
                      ...preset.animation!,
                      caption: value as CaptionAnimation,
                    })
                  }
                />
                <SelectField
                  label="Word animation"
                  options={menu(
                    WORD_ANIMATIONS,
                    TEMPLATE_WORD_ANIMATIONS,
                    preset.animation.word,
                  )}
                  value={preset.animation.word}
                  onChange={(value) =>
                    update("animation", {
                      ...preset.animation!,
                      word: value as WordAnimation,
                    })
                  }
                />
                <SwitchRow
                  label="Animation variants"
                  checked={preset.animation.variants && Boolean(preset.variants)}
                  onCheckedChange={(variants) =>
                    update("animation", { ...preset.animation!, variants })
                  }
                />
              </>
            ) : null}
          </EditorSection>

          <EditorSection title="B-roll">
            <SelectField
              label="Default layout"
              options={BROLL_LAYOUTS.map(({ value, label }) => ({ value, label }))}
              value={previewStyle.brollLayout ?? "random"}
              onChange={(value) =>
                onPreviewStyleChange({
                  ...previewStyle,
                  brollLayout: value as BrollLayout,
                })
              }
            />
          </EditorSection>

          <EditorSection title="Zoom">
            <SelectField
              label="Zoom"
              options={ZOOM_STYLES.map(({ value, label }) => ({ value, label }))}
              value={previewStyle.zoom ?? "none"}
              onChange={(value) =>
                onPreviewStyleChange({ ...previewStyle, zoom: value as ZoomStyle })
              }
            />
          </EditorSection>

          <EditorSection title="Video background">
            <ColorField
              label="Color"
              value={previewStyle.backgroundColor}
              options={OVERLAY_COLORS}
              onChange={(backgroundColor) =>
                onPreviewStyleChange({ ...previewStyle, backgroundColor })
              }
            />
          </EditorSection>
        </div>
      )}
    </div>
  );
}

function FontSection({
  preset,
  onChange,
  size,
  onSizeChange,
}: {
  preset: SubtitleStylePreset;
  onChange: (preset: SubtitleStylePreset) => void;
  size: number;
  onSizeChange: (size: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const known = FONT_SELECT_OPTIONS.some((o) => o.value === preset.fontFamily);
  const fontOptions = known
    ? FONT_SELECT_OPTIONS
    : [
        {
          value: preset.fontFamily,
          label: preset.fontFamily.startsWith(CUSTOM_FONT_PREFIX)
            ? customFontLabel(preset.fontFamily)
            : preset.fontFamily,
        },
        ...FONT_SELECT_OPTIONS,
      ];
  const weights = fontWeights(preset.fontFamily);
  const weightOptions = weights.map((weight) => ({
    value: String(weight),
    label: WEIGHT_LABELS[weight] ?? String(weight),
  }));

  const changeFont = (fontFamily: string) => {
    const available = fontWeights(fontFamily);
    // Keep the weight when the font has it, else the nearest it does have.
    const fontWeight = available.includes(preset.fontWeight)
      ? preset.fontWeight
      : available.reduce((a, b) =>
          Math.abs(b - preset.fontWeight) < Math.abs(a - preset.fontWeight) ? b : a,
        );
    onChange({ ...preset, fontFamily, fontWeight });
  };

  const upload = async (file: File) => {
    setIsUploading(true);
    const result = await uploadFileToStorage(file);
    setIsUploading(false);
    if (!result.success || !result.blobUrl) {
      toast.error(failureMessage("upload the font", result.error));
      return;
    }
    onChange({ ...preset, fontFamily: `${CUSTOM_FONT_PREFIX}${result.blobUrl}` });
    toast.success("Font uploaded");
  };

  return (
    <EditorSection
      title="Font"
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept={FONT_FILE_TYPES}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
          >
            {isUploading ? <Spinner /> : <UploadSimple />}
            {isUploading ? "Uploading…" : "Upload custom font"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <SelectField
          label="Family"
          options={fontOptions}
          value={preset.fontFamily}
          onChange={changeFont}
          renderOption={renderFontOption}
        />
        <SelectField
          label="Weight"
          options={weightOptions}
          value={String(preset.fontWeight)}
          onChange={(value) => onChange({ ...preset, fontWeight: Number(value) })}
        />
      </div>
      <SliderField
        label="Size"
        unit="px"
        value={Math.round(size)}
        min={CAPTION_PLACEMENT_LIMITS.size.min}
        max={CAPTION_PLACEMENT_LIMITS.size.max}
        defaultValue={preset.fontSize}
        onChange={onSizeChange}
      />
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Case</span>
        <ChoiceGroup
          label="Letter case"
          value={preset.textTransform}
          onChange={(textTransform) => onChange({ ...preset, textTransform })}
          className="grid grid-cols-3"
        >
          <ChoiceItem value="none">Aa</ChoiceItem>
          <ChoiceItem value="uppercase">AA</ChoiceItem>
          <ChoiceItem value="lowercase">aa</ChoiceItem>
        </ChoiceGroup>
      </div>
    </EditorSection>
  );
}

function SizeChoice<T extends string>({
  label,
  value,
  options: choices,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ChoiceGroup
        label={label}
        value={value}
        onChange={onChange}
        className="grid grid-cols-3"
      >
        {choices.map(([choice, text]) => (
          <ChoiceItem key={choice} value={choice}>
            {text}
          </ChoiceItem>
        ))}
      </ChoiceGroup>
    </div>
  );
}

function SaveAsNewPopover({
  defaultName,
  onSave,
}: {
  defaultName: string;
  onSave: (name: string) => Promise<boolean>;
}) {
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = name.trim();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setName(defaultName);
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button size="sm" />}>
        <FloppyDisk />
        Save as new
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72">
        <PopoverHeader>
          <PopoverTitle>Save as a new theme</PopoverTitle>
        </PopoverHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!trimmed) return;
            setIsSaving(true);
            const saved = await onSave(trimmed);
            setIsSaving(false);
            if (saved) setOpen(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              maxLength={40}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSaving || !trimmed}
          >
            {isSaving ? <Spinner /> : null}
            {isSaving ? "Saving…" : "Save theme"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
