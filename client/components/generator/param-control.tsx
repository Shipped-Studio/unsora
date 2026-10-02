"use client";

import { CaretDown, Timer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParamOption {
  value: string;
  label: string;
}

/**
 * How a parameter is rendered in the toolbar:
 * - "select"   → dropdown (e.g. generation mode, style)
 * - "duration" → popover with a slider, trigger shows "10s"
 * - "aspect"   → dropdown of aspect ratios
 * - "toggle"   → on/off button; options[0] is "on", options[1] is "off"
 */
export type ParamType = "select" | "duration" | "aspect" | "toggle";

export interface ParamConfig {
  key: string;
  label: string;
  type: ParamType;
  options: ParamOption[];
  defaultValue: string;
  /** When true, the trigger shows only the value (no "Label: " prefix). */
  hideLabel?: boolean;
}

export const GHOST_TRIGGER_CLASS =
  "h-8 text-xs gap-1 px-2 font-normal text-muted-foreground hover:text-foreground";

// ─── Duration slider ─────────────────────────────────────────────────────────

export function parseDuration(value: string): number {
  return parseInt(value.replace("s", ""));
}

function computeSliderStep(values: number[]): number {
  if (values.length < 2) return 1;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return values
    .slice(1)
    .reduce(
      (s, v, i) => gcd(s, Math.abs(v - values[i])),
      Math.abs(values[1] - values[0]),
    );
}

export function DurationSlider({
  options,
  value,
  onChange,
}: {
  options: ParamOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const nums = options.map((o) => parseDuration(o.value));
  const minVal = Math.min(...nums);
  const maxVal = Math.max(...nums);
  const step = computeSliderStep(nums);
  const currentNum = parseDuration(value);

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">
        Duration {currentNum}s
      </span>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {minVal}s
        </span>
        <Slider
          value={[currentNum]}
          min={minVal}
          max={maxVal}
          step={step}
          onValueChange={(v) => {
            const val = Array.isArray(v) ? v[0] : v;
            const opt = options.find((o) => parseDuration(o.value) === val);
            if (opt) onChange(opt.value);
          }}
        />
        <span className="text-xs tabular-nums text-muted-foreground">
          {maxVal}s
        </span>
      </div>
    </div>
  );
}

// ─── Toolbar param control ───────────────────────────────────────────────────

export function ParamControl({
  param,
  value,
  disabled,
  onChange,
}: {
  param: ParamConfig;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  switch (param.type) {
    case "select": {
      const valueLabel =
        param.options.find((o) => o.value === value)?.label ?? value;
      // Bare "Auto" is ambiguous when several selects sit side by side
      const display =
        value === "auto" ? `${param.label}: ${valueLabel}` : valueLabel;
      return (
        <Select
          value={value}
          onValueChange={(v) => v != null && onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger variant="ghost" className={GHOST_TRIGGER_CLASS}>
            <span className="truncate">{display}</span>
          </SelectTrigger>
          <SelectContent>
            {param.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "duration":
      return (
        <Popover>
          <PopoverTrigger>
            <Button
              variant="ghost"
              disabled={disabled}
              className={GHOST_TRIGGER_CLASS}
            >
              <Timer className="size-3.5" />
              {parseDuration(value)}s
              <CaretDown className="size-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72"
            side="top"
            align="start"
            sideOffset={8}
          >
            <DurationSlider
              options={param.options}
              value={value}
              onChange={onChange}
            />
          </PopoverContent>
        </Popover>
      );

    case "aspect": {
      const valueLabel =
        param.options.find((o) => o.value === value)?.label ?? value;
      return (
        <Select
          value={value}
          onValueChange={(v) => v != null && onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger variant="ghost" className={GHOST_TRIGGER_CLASS}>
            <span className="truncate">
              {param.hideLabel ? valueLabel : `${param.label}: ${valueLabel}`}
            </span>
          </SelectTrigger>
          <SelectContent>
            {param.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "toggle": {
      const [onOpt, offOpt] = param.options;
      const isOn = value === onOpt.value;
      return (
        <label
          className={cn(
            "group/field flex cursor-pointer items-center gap-2 px-2 text-xs font-medium transition-colors",
            disabled && "cursor-not-allowed opacity-50",
            isOn ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Checkbox
            checked={isOn}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange(checked ? onOpt.value : offOpt.value)
            }
          />
          {param.label}
        </label>
      );
    }
  }
}

// ─── Count select ────────────────────────────────────────────────────────────

export function CountSelect({
  value,
  max = 10,
  noun,
  disabled,
  onChange,
}: {
  value: number;
  max?: number;
  noun: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => v != null && onChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger variant="ghost" className={GHOST_TRIGGER_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <SelectItem key={n} value={String(n)} className="text-xs">
            {n} {noun}
            {n > 1 ? "s" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
