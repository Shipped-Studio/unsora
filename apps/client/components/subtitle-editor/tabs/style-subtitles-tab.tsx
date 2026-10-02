"use client";

import { Button } from "@/components/ui/button";
import {
  StylePresetsGrid,
  type SubtitleStylePreset,
} from "@/components/subtitle-editor/style-presets";
import {
  EditorSection,
  SliderField,
} from "@/components/subtitle-editor/editor-fields";

export interface SizePositionValues {
  fontSize: number;
  yAxis: number;
  xAxis: number;
  width: number;
  /** Kept for saved projects; the renderer doesn't use it. */
  height: number;
}

export const SIZE_POSITION_DEFAULTS: SizePositionValues = {
  fontSize: 43,
  yAxis: 20,
  xAxis: 0,
  width: 610,
  height: 200,
};

const FIELDS: {
  key: Exclude<keyof SizePositionValues, "height">;
  label: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  { key: "fontSize", label: "Font size", unit: "px", min: 8, max: 120 },
  { key: "yAxis", label: "Vertical position", unit: "%", min: -50, max: 50 },
  { key: "xAxis", label: "Horizontal position", unit: "%", min: -50, max: 50 },
  { key: "width", label: "Line width", unit: "px", min: 100, max: 1920 },
];

interface StyleSubtitlesTabProps {
  selectedPresetId: string;
  onSelectPreset: (preset: SubtitleStylePreset) => void;
  sizePosition: SizePositionValues;
  onSizePositionChange: (values: SizePositionValues) => void;
}

export function StyleSubtitlesTab({
  selectedPresetId,
  onSelectPreset,
  sizePosition,
  onSizePositionChange,
}: StyleSubtitlesTabProps) {
  const isDefault = FIELDS.every(
    ({ key }) => sizePosition[key] === SIZE_POSITION_DEFAULTS[key],
  );

  return (
    <div className="space-y-8">
      <EditorSection title="Preset">
        <StylePresetsGrid
          selectedPresetId={selectedPresetId}
          onSelectPreset={onSelectPreset}
        />
      </EditorSection>

      <EditorSection
        title="Size and position"
        actions={
          <Button
            variant="ghost"
            disabled={isDefault}
            onClick={() =>
              onSizePositionChange({
                ...SIZE_POSITION_DEFAULTS,
                height: sizePosition.height,
              })
            }
          >
            Reset
          </Button>
        }
      >
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {FIELDS.map(({ key, label, unit, min, max }) => (
            <SliderField
              key={key}
              label={label}
              unit={unit}
              value={sizePosition[key] ?? SIZE_POSITION_DEFAULTS[key]}
              min={min}
              max={max}
              defaultValue={SIZE_POSITION_DEFAULTS[key]}
              onChange={(value) =>
                onSizePositionChange({ ...sizePosition, [key]: value })
              }
            />
          ))}
        </div>
      </EditorSection>
    </div>
  );
}
