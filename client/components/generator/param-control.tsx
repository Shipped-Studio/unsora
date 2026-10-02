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
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface ParamOption {
  value: string;
  label: string;
}

/**
 * How a parameter renders in the composer toolbar:
 * - "select":   dropdown (generation mode, style)
 * - "duration": popover with a slider; the trigger shows "10s"
 * - "aspect":   dropdown of aspect ratios
 * - "toggle":   checkbox; options[0] is on, options[1] is off
 */
export type ParamType = "select" | "duration" | "aspect" | "toggle";

export interface ParamConfig {
  key: string;
  label: string;
  type: ParamType;
  options: ParamOption[];
  defaultValue: string;
  /** Show only the value on the trigger, without the "Label: " prefix. */
  hideLabel?: boolean;
}

export const GHOST_TRIGGER_CLASS =
  "h-8 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground";

export function parseDuration(value: string): number {
  return parseInt(value.replace("s", ""), 10);
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
    <div className="space-y-3">
      <p className="text-sm font-medium">
        Duration{" "}
        <span className="font-normal tabular-nums text-muted-foreground">
          {currentNum}s
        </span>
      </p>
      <div className="flex items-center gap-3">
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

function OptionSelect({
  param,
  value,
  display,
  disabled,
  onChange,
}: {
  param: ParamConfig;
  value: string;
  display: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v != null && onChange(v)}
      disabled={disabled}
    >
      <SelectTrigger
        variant="ghost"
        aria-label={param.label}
        className={GHOST_TRIGGER_CLASS}
      >
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
  const valueLabel =
    param.options.find((o) => o.value === value)?.label ?? value;

  switch (param.type) {
    case "select":
      return (
        <OptionSelect
          param={param}
          value={value}
          // A bare "Auto" is ambiguous when several selects sit side by side.
          display={
            value === "auto" ? `${param.label}: ${valueLabel}` : valueLabel
          }
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "aspect":
      return (
        <OptionSelect
          param={param}
          value={value}
          display={
            param.hideLabel ? valueLabel : `${param.label}: ${valueLabel}`
          }
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "duration":
      return (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                disabled={disabled}
                aria-label={`Duration: ${parseDuration(value)} seconds`}
                className={GHOST_TRIGGER_CLASS}
              />
            }
          >
            <Timer className="size-3.5" />
            <span className="tabular-nums">{parseDuration(value)}s</span>
            <CaretDown className="size-3" />
          </PopoverTrigger>
          <PopoverContent className="w-72" side="top" align="start" sideOffset={8}>
            <DurationSlider
              options={param.options}
              value={value}
              onChange={onChange}
            />
          </PopoverContent>
        </Popover>
      );

    case "toggle": {
      const [onOpt, offOpt] = param.options;
      const isOn = value === onOpt.value;
      return (
        <label
          className={cn(
            "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-xs transition-colors hover:bg-secondary",
            disabled && "pointer-events-none opacity-50",
            isOn ? "text-foreground" : "text-muted-foreground",
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

/** "1 video", "2 videos"... Number of outputs per submit. */
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
  const label = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => v != null && onChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger
        variant="ghost"
        aria-label="Number of results"
        className={GHOST_TRIGGER_CLASS}
      >
        <span className="tabular-nums">{label(value)}</span>
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <SelectItem key={n} value={String(n)} className="text-xs">
            {label(n)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
