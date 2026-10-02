"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ArrowsOutSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import {
  StylePresetsGrid,
  type SubtitleStylePreset,
} from "@/components/subtitle-editor/style-presets";

export interface SizePositionValues {
  fontSize: number;
  yAxis: number;
  xAxis: number;
  width: number;
  height: number;
}

export const SIZE_POSITION_DEFAULTS: SizePositionValues = {
  fontSize: 43,
  yAxis: 20,
  xAxis: 0,
  width: 610,
  height: 200,
};

const FIELD_CONFIG = [
  {
    key: "fontSize" as const,
    label: "Font Size",
    unit: "px",
    min: 8,
    max: 120,
  },
  { key: "yAxis" as const, label: "Y Axis", unit: "%", min: -50, max: 50 },
  { key: "xAxis" as const, label: "X Axis", unit: "%", min: -50, max: 50 },
  { key: "width" as const, label: "Width", unit: "px", min: 100, max: 1920 },
  { key: "height" as const, label: "Height", unit: "px", min: 50, max: 1080 },
] as const;

function SizePositionField({
  label,
  unit,
  value,
  min,
  max,
  onValueChange,
  onReset,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (val: number) => void;
  onReset: () => void;
}) {
  const [localValue, setLocalValue] = useState([value]);

  const handleChange = (val: number | readonly number[]) => {
    const arr = Array.isArray(val) ? [...val] : [val];
    setLocalValue(arr);
    onValueChange(arr[0]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums">
            {localValue[0]}
            {unit}
          </span>
          <button
            onClick={() => {
              onReset();
              setLocalValue([value]);
            }}
            className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowCounterClockwise className="size-3" />
          </button>
        </div>
      </div>
      <Slider
        value={localValue}
        min={min}
        max={max}
        step={1}
        onValueChange={handleChange}
        className="h-2!"
      />
    </div>
  );
}

function SizePositionPopover({
  values,
  onChange,
}: {
  values: SizePositionValues;
  onChange: (values: SizePositionValues) => void;
}) {
  const updateField = (key: keyof SizePositionValues, val: number) => {
    if (typeof val !== "number" || !isFinite(val)) return;
    onChange({ ...values, [key]: val });
  };

  const resetField = (key: keyof SizePositionValues) => {
    onChange({ ...values, [key]: SIZE_POSITION_DEFAULTS[key] });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" />
        }
      >
        <ArrowsOutSimple className="size-3.5" />
        Edit Size & Position
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-64 p-3"
      >
        <div className="space-y-3">
          {FIELD_CONFIG.map(({ key, label, unit, min, max }) => (
            <SizePositionField
              key={key}
              label={label}
              unit={unit}
              value={values[key] ?? SIZE_POSITION_DEFAULTS[key]}
              min={min}
              max={max}
              onValueChange={(val) => updateField(key, val)}
              onReset={() => resetField(key)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface StyleSubtitlesTabProps {
  selectedPresetId: string | null;
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
  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <SizePositionPopover
          values={sizePosition}
          onChange={onSizePositionChange}
        />
      </div>
      <StylePresetsGrid
        selectedPreset={selectedPresetId}
        onSelectPreset={onSelectPreset}
      />
    </div>
  );
}
