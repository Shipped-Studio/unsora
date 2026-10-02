"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { TextAa, Image as ImageIcon } from "@phosphor-icons/react";
import { uploadFileToStorage } from "@/lib/storage-client";

export interface WatermarkOverlayConfig {
  enabled: boolean;
  type: "text" | "image";
  text: string;
  imageUrl: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
}

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const WATERMARK_OVERLAY_DEFAULTS: WatermarkOverlayConfig = {
  enabled: true,
  type: "text",
  text: "",
  imageUrl: "",
  fontSize: 36,
  color: "#ffffff",
  opacity: 50,
  position: "bottom-right",
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

const POSITIONS: WatermarkPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
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

function formatPositionLabel(pos: string) {
  return pos
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface EditWatermarkTabProps {
  config: WatermarkOverlayConfig;
  onChange: (config: WatermarkOverlayConfig) => void;
}

export function EditWatermarkTab({ config, onChange }: EditWatermarkTabProps) {
  const [isUploading, setIsUploading] = useState(false);

  const update = <K extends keyof WatermarkOverlayConfig>(
    key: K,
    value: WatermarkOverlayConfig[K],
  ) => {
    onChange({ ...config, [key]: value });
  };

  // Upload to storage so the URL survives reloads and is reachable by the
  // Remotion Lambda render (a browser blob: URL is neither).
  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadFileToStorage(file);
      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed");
      }
      update("imageUrl", result.blobUrl);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">Show Watermark</label>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => update("enabled", v)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Watermark Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "text" as const, label: "Text", icon: TextAa },
            { value: "image" as const, label: "Image", icon: ImageIcon },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => update("type", t.value)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                config.type === t.value
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {config.type === "text" ? (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Watermark Text
            </label>
            <Input
              value={config.text}
              onChange={(e) => update("text", e.target.value)}
              placeholder="e.g. @yourusername"
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
                      config.color === c
                        ? "var(--color-primary)"
                        : "transparent",
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

          <SliderField
            label="Font Size"
            unit="px"
            value={config.fontSize}
            min={12}
            max={80}
            onChange={(v) => update("fontSize", v)}
          />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <ImageIcon
            className="mx-auto size-8 text-muted-foreground/40"
            weight="thin"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Upload a logo or image for your watermark
          </p>
          <label
            className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs ${
              isUploading
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {isUploading && <Spinner className="size-3.5" />}
            {isUploading ? "Uploading..." : "Upload Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void handleImageUpload(file);
              }}
            />
          </label>
          {config.imageUrl && (
            <div className="mt-3">
              <img
                src={config.imageUrl}
                alt="Watermark preview"
                className="mx-auto max-h-16 max-w-[120px] rounded object-contain"
              />
            </div>
          )}
        </div>
      )}

      <SliderField
        label="Opacity"
        unit="%"
        value={config.opacity}
        min={10}
        max={100}
        onChange={(v) => update("opacity", v)}
      />

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          Position
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => update("position", pos)}
              className={`rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                config.position === pos
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {formatPositionLabel(pos)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
