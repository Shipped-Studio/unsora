"use client";

import { useId, useState } from "react";
import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
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
  ChoiceGroup,
  ChoiceItem,
  ColorField,
  EditorSection,
  FONT_SELECT_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  OVERLAY_COLORS,
  SelectField,
  SliderField,
  SwitchRow,
  renderFontOption,
} from "@/components/subtitle-editor/editor-fields";
import type { SubtitleStylePreset } from "@/components/subtitle-editor/style-presets";

const DEFAULT_SHADOW = "0 2px 8px rgba(0,0,0,0.5)";
const DEFAULT_STROKE_WIDTH = 3;

interface CustomizePresetPanelProps {
  preset: SubtitleStylePreset;
  onChange: (preset: SubtitleStylePreset) => void;
  /** The preset as it was before customizing, for Reset. */
  original: SubtitleStylePreset | null;
  onBack: () => void;
  /** Resolves true once saved. */
  onSaveAsNew: (name: string) => Promise<boolean>;
}

export function CustomizePresetPanel({
  preset,
  onChange,
  original,
  onBack,
  onSaveAsNew,
}: CustomizePresetPanelProps) {
  const update = <K extends keyof SubtitleStylePreset>(
    key: K,
    value: SubtitleStylePreset[K],
  ) => onChange({ ...preset, [key]: value });

  const isOriginal =
    !original || JSON.stringify(original) === JSON.stringify(preset);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back to presets"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          Customize {preset.name}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={isOriginal}
          onClick={() => original && onChange(original)}
        >
          Reset
        </Button>
        <SaveAsNewPopover
          defaultName={`${preset.name} 2`}
          onSave={onSaveAsNew}
        />
      </div>

      <EditorSection title="Font">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <SelectField
            label="Family"
            options={FONT_SELECT_OPTIONS}
            value={preset.fontFamily}
            onChange={(value) => update("fontFamily", value)}
            renderOption={renderFontOption}
          />
          <SelectField
            label="Weight"
            options={FONT_WEIGHT_OPTIONS}
            value={String(preset.fontWeight)}
            onChange={(value) => update("fontWeight", Number(value))}
          />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Case
          </span>
          <ChoiceGroup
            label="Letter case"
            value={preset.textTransform}
            onChange={(value) => update("textTransform", value)}
            className="grid grid-cols-3"
          >
            <ChoiceItem value="none">Aa</ChoiceItem>
            <ChoiceItem value="uppercase">AA</ChoiceItem>
            <ChoiceItem value="lowercase">aa</ChoiceItem>
          </ChoiceGroup>
        </div>
        <SwitchRow
          label="Italic"
          checked={preset.fontStyle === "italic"}
          onCheckedChange={(checked) =>
            update("fontStyle", checked ? "italic" : "normal")
          }
        />
      </EditorSection>

      <EditorSection title="Colors">
        <ColorField
          label="Text"
          value={preset.color}
          options={OVERLAY_COLORS}
          onChange={(color) => update("color", color)}
        />
        <ColorField
          label="Spoken word"
          value={preset.highlightColor ?? preset.color}
          options={OVERLAY_COLORS}
          onChange={(color) => update("highlightColor", color)}
        />
        <SwitchRow
          label="Box behind the spoken word"
          checked={Boolean(preset.highlightBgColor)}
          onCheckedChange={(checked) =>
            update("highlightBgColor", checked ? "#ef4444" : undefined)
          }
        />
        {preset.highlightBgColor ? (
          <ColorField
            label="Spoken word box"
            value={preset.highlightBgColor}
            options={OVERLAY_COLORS}
            onChange={(color) => update("highlightBgColor", color)}
          />
        ) : null}
        <SwitchRow
          label="Box behind the line"
          checked={Boolean(preset.backgroundColor)}
          onCheckedChange={(checked) =>
            onChange({
              ...preset,
              backgroundColor: checked ? "rgba(0,0,0,0.7)" : undefined,
              backgroundPadding: checked
                ? (preset.backgroundPadding ?? 8)
                : preset.backgroundPadding,
            })
          }
        />
        {preset.backgroundColor ? (
          <ColorField
            label="Line box"
            value={preset.backgroundColor}
            options={OVERLAY_COLORS}
            onChange={(color) => update("backgroundColor", color)}
          />
        ) : null}
      </EditorSection>

      <EditorSection title="Outline and shadow">
        <SwitchRow
          label="Outline"
          checked={Boolean(preset.strokeColor && preset.strokeWidth)}
          onCheckedChange={(checked) =>
            onChange({
              ...preset,
              strokeColor: checked ? (preset.strokeColor ?? "#000000") : undefined,
              strokeWidth: checked
                ? preset.strokeWidth || DEFAULT_STROKE_WIDTH
                : undefined,
            })
          }
        />
        {preset.strokeColor && preset.strokeWidth ? (
          <>
            <ColorField
              label="Outline color"
              value={preset.strokeColor}
              options={OVERLAY_COLORS}
              onChange={(color) => update("strokeColor", color)}
            />
            <SliderField
              label="Outline width"
              unit="px"
              value={preset.strokeWidth}
              min={1}
              max={8}
              onChange={(value) => update("strokeWidth", value)}
            />
          </>
        ) : null}
        <SwitchRow
          label="Shadow"
          checked={Boolean(preset.shadow)}
          onCheckedChange={(checked) =>
            update("shadow", checked ? DEFAULT_SHADOW : undefined)
          }
        />
      </EditorSection>
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
          <PopoverTitle>Save as a new preset</PopoverTitle>
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
            {isSaving ? "Saving…" : "Save preset"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
