"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export interface TitleOverlayConfig {
  enabled: boolean;
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  xAxis: number;
  yAxis: number;
  width: number;
}

export const TITLE_OVERLAY_DEFAULTS: TitleOverlayConfig = {
  enabled: true,
  text: "",
  fontSize: 48,
  fontWeight: 700,
  color: "#ffffff",
  xAxis: 0,
  yAxis: 0,
  width: 90,
};

const COLOR_OPTIONS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const FONT_WEIGHT_OPTIONS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Black", value: 900 },
];

function SliderField({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}) {
  const [localValue, setLocalValue] = useState([value]);

  const handleChange = (val: number | readonly number[]) => {
    const arr = Array.isArray(val) ? [...val] : [val];
    setLocalValue(arr);
    onChange(arr[0]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-xs tabular-nums">
          {localValue[0]}
          {unit}
        </span>
      </div>
      <Slider
        value={localValue}
        min={min}
        max={max}
        step={step ?? 1}
        onValueChange={handleChange}
      />
    </div>
  );
}

interface EditTitleTabProps {
  config: TitleOverlayConfig;
  onChange: (config: TitleOverlayConfig) => void;
}

export function EditTitleTab({ config, onChange }: EditTitleTabProps) {
  const update = <K extends keyof TitleOverlayConfig>(
    key: K,
    value: TitleOverlayConfig[K],
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">Show Title</label>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => update("enabled", v)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Title Text
        </label>
        <Input
          value={config.text}
          onChange={(e) => update("text", e.target.value)}
          placeholder="Enter title text..."
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => update("color", c)}
              className="size-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor:
                  config.color === c ? "var(--color-primary)" : "transparent",
              }}
            />
          ))}
          <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
            <input
              type="color"
              value={config.color}
              onChange={(e) => update("color", e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <span className="text-[10px] text-muted-foreground">+</span>
          </label>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          Font Weight
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FONT_WEIGHT_OPTIONS.map((fw) => (
            <button
              key={fw.value}
              onClick={() => update("fontWeight", fw.value)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                config.fontWeight === fw.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {fw.label}
            </button>
          ))}
        </div>
      </div>

      <SliderField
        label="Font Size"
        unit="px"
        value={config.fontSize}
        min={12}
        max={120}
        onChange={(v) => update("fontSize", v)}
      />

      <SliderField
        label="X Position"
        unit="%"
        value={config.xAxis}
        min={-50}
        max={50}
        onChange={(v) => update("xAxis", v)}
      />

      <SliderField
        label="Y Position"
        unit="%"
        value={config.yAxis}
        min={-50}
        max={50}
        onChange={(v) => update("yAxis", v)}
      />

      <SliderField
        label="Width"
        unit="%"
        value={config.width}
        min={10}
        max={100}
        onChange={(v) => update("width", v)}
      />
    </div>
  );
}
