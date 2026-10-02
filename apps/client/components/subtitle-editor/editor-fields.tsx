"use client";

import { useId } from "react";
import { ArrowCounterClockwise, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Swatches offered for title and watermark text. */
export const OVERLAY_COLORS = [
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
] as const;

/** One titled block inside an editor tab. */
export function EditorSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Small muted label used above a control. */
export function FieldCaption({
  id,
  htmlFor,
  children,
}: {
  id?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      id={id}
      htmlFor={htmlFor}
      className="text-xs font-medium text-muted-foreground"
    >
      {children}
    </Label>
  );
}

export function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted px-3 py-2.5">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SliderField({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Shows a reset button while the value differs from it. */
  defaultValue?: number;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  const canReset = defaultValue !== undefined && value !== defaultValue;

  return (
    <div className="space-y-2.5">
      <div className="flex h-6 items-center justify-between gap-2">
        <span
          id={labelId}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums">
            {value}
            {unit}
          </span>
          {canReset ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Reset ${label.toLowerCase()}`}
              onClick={() => onChange(defaultValue)}
            >
              <ArrowCounterClockwise />
            </Button>
          ) : null}
        </div>
      </div>
      <Slider
        aria-labelledby={labelId}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => {
          const v = Array.isArray(next) ? next[0] : next;
          if (typeof v === "number" && Number.isFinite(v)) onChange(v);
        }}
      />
    </div>
  );
}

/** Preset colour swatches plus a custom colour picker. */
export function ColorField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (color: string) => void;
}) {
  const labelId = useId();
  const isCustom = !options.some(
    (option) => option.toLowerCase() === value.toLowerCase(),
  );

  return (
    <div className="space-y-2">
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-2"
      >
        {options.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={`${label} ${color}`}
              aria-pressed={selected}
              onClick={() => onChange(color)}
              className={cn(
                "size-7 rounded-full border border-foreground/15 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50",
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
        <label
          className={cn(
            "relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-foreground/30 text-muted-foreground transition-colors hover:text-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            isCustom && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          )}
          style={isCustom ? { backgroundColor: value } : undefined}
        >
          {isCustom ? null : <Plus className="size-3.5" />}
          <input
            type="color"
            aria-label={`Custom ${label.toLowerCase()}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

/** Single-choice option tiles. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      value={[value]}
      onValueChange={(next) => {
        // Pressing the active tile would clear the group; keep it selected.
        const picked = next[0];
        if (picked) onChange(picked as T);
      }}
      className={cn("w-full items-stretch", className)}
    >
      {children}
    </ToggleGroup>
  );
}

export function ChoiceItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupItem
      value={value}
      className={cn(
        "h-auto min-h-9 min-w-0 text-muted-foreground aria-pressed:border-foreground/40 aria-pressed:bg-muted aria-pressed:text-foreground",
        className,
      )}
    >
      {children}
    </ToggleGroupItem>
  );
}
