"use client";

import { useState, useCallback, useMemo } from "react";
import { Plus, ImageSquare } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import {
  ParamControl,
  CountSelect,
  type ParamConfig,
} from "@/components/generator/param-control";
import { ModelPicker } from "@/components/generator/model-picker";
import { MediaSlots } from "@/components/generator/media-slots";
import { LibraryPicker } from "@/components/generator/library-picker";
import { AttachmentStrip } from "@/components/generator/attachment-strip";
import { useMediaAttachments } from "@/components/generator/use-media-attachments";
import type { UploadField } from "@/components/generator/attachments";

// ─── Model configs ───────────────────────────────────────────────────────────

type ModelKey =
  | "nano-banana-2"
  | "nano-banana-pro"
  | "seedream-v5-lite"
  | "gpt-image-1.5"
  | "gpt-image-2";

const NANO_RATIOS: ParamConfig = {
  key: "ratio",
  label: "Aspect Ratio",
  type: "aspect",
  defaultValue: "1:1",
  options: [
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ],
};

const RESOLUTION: ParamConfig = {
  key: "resolution",
  label: "Resolution",
  type: "select",
  defaultValue: "2k",
  options: [
    { value: "1k", label: "1K" },
    { value: "2k", label: "2K" },
    { value: "4k", label: "4K" },
  ],
};

interface ImageModelConfig {
  key: ModelKey;
  label: string;
  provider: string;
  icon: string;
  badge?: "Popular" | "New";
  description: string;
  priceHint: string;
  maxImages: number;
  params: ParamConfig[];
  credits(params: Record<string, string>): number;
}

const MODEL_CONFIGS: Record<ModelKey, ImageModelConfig> = {
  "nano-banana-2": {
    key: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "Google",
    icon: "/models/google.svg",
    badge: "Popular",
    description: "Fast, high-quality image generation and editing",
    priceHint: "from 2 credits",
    maxImages: 20,
    params: [NANO_RATIOS, RESOLUTION],
    // Keep in sync with server/src/config/models/nano-banana-2.ts.
    credits: (params) => {
      const res = params.resolution ?? "2k";
      return res === "4k" ? 6 : res === "2k" ? 3 : 2;
    },
  },
  "nano-banana-pro": {
    key: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "Google",
    icon: "/models/google.svg",
    description: "Highest-fidelity Nano Banana with 4K output",
    priceHint: "from 5 credits",
    maxImages: 20,
    params: [NANO_RATIOS, RESOLUTION],
    // Keep in sync with server/src/config/models/nano-banana-pro.ts.
    credits: (params) => ((params.resolution ?? "2k") === "4k" ? 8 : 5),
  },
  "seedream-v5-lite": {
    key: "seedream-v5-lite",
    label: "Seedream v5 Lite",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    description: "Versatile generation with wide aspect ratio support",
    priceHint: "2 credits",
    maxImages: 14,
    params: [
      {
        key: "ratio",
        label: "Aspect Ratio",
        type: "aspect",
        defaultValue: "1:1",
        options: [
          { value: "1:1", label: "1:1" },
          { value: "4:3", label: "4:3" },
          { value: "3:4", label: "3:4" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "2:3", label: "2:3" },
          { value: "3:2", label: "3:2" },
          { value: "21:9", label: "21:9" },
        ],
      },
      {
        key: "resolution",
        label: "Quality",
        type: "select",
        defaultValue: "basic",
        options: [
          { value: "basic", label: "Basic (2K)" },
          { value: "high", label: "High (3K)" },
        ],
      },
    ],
    // $0.035 flat regardless of quality → same price for basic and high.
    // Keep in sync with server/src/config/models/seedream-v5-lite.ts.
    credits: () => 2,
  },
  "gpt-image-1.5": {
    key: "gpt-image-1.5",
    label: "GPT Image 1.5",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    description: "OpenAI image model with strong prompt following",
    priceHint: "2 credits",
    maxImages: 20,
    params: [
      {
        key: "ratio",
        label: "Aspect Ratio",
        type: "aspect",
        defaultValue: "1:1",
        options: [
          { value: "1:1", label: "1:1" },
          { value: "2:3", label: "2:3" },
          { value: "3:2", label: "3:2" },
        ],
      },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        defaultValue: "medium",
        options: [
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
      },
    ],
    // $0.05 flat across all sizes → same price regardless of quality.
    // Keep in sync with server/src/config/models/gpt-image-1.5.ts.
    credits: () => 2,
  },
  "gpt-image-2": {
    key: "gpt-image-2",
    label: "GPT Image 2",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    badge: "New",
    description: "Latest OpenAI image model with 4K output",
    priceHint: "from 3 credits",
    maxImages: 16,
    params: [
      {
        key: "ratio",
        label: "Aspect Ratio",
        type: "aspect",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "1:1", label: "1:1" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "4:3", label: "4:3" },
          { value: "3:4", label: "3:4" },
          { value: "3:2", label: "3:2" },
          { value: "2:3", label: "2:3" },
          { value: "4:5", label: "4:5" },
          { value: "5:4", label: "5:4" },
          { value: "21:9", label: "21:9" },
        ],
      },
      RESOLUTION,
    ],
    // Image generation → 20% target margin (1K→3, 2K→4, 4K→6).
    // Keep in sync with server/src/config/models/gpt-image-2.ts.
    credits: (params) => {
      const res = params.resolution ?? "2k";
      return res === "4k" ? 6 : res === "2k" ? 4 : 3;
    },
  },
};

const MODEL_KEYS = Object.keys(MODEL_CONFIGS) as ModelKey[];

const MODEL_PICKER_ITEMS = MODEL_KEYS.map((key) => {
  const m = MODEL_CONFIGS[key];
  return {
    key,
    label: m.label,
    sublabel: m.provider,
    title: `${m.description} · ${m.priceHint}`,
    badge: m.badge,
    iconSrc: m.icon,
  };
});

function getDefaults(config: ImageModelConfig): Record<string, string> {
  return Object.fromEntries(
    config.params.map((p) => [p.key, p.defaultValue]),
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface ImageGenerationSubmitParams {
  prompt: string;
  model: string;
  ratio: string;
  resolution?: string;
  quality?: string;
  nsfwChecker?: boolean;
  images?: string[];
  count: number;
}

export function ImagePromptForm({
  onSubmit,
}: {
  onSubmit: (params: ImageGenerationSubmitParams) => Promise<string | null>;
}) {
  const [model, setModel] = useState<ModelKey>("nano-banana-2");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [paramsByModel, setParamsByModel] = useState<
    Partial<Record<ModelKey, Record<string, string>>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);

  const config = MODEL_CONFIGS[model];
  const params = paramsByModel[model] ?? getDefaults(config);

  const uploadFields: UploadField[] = useMemo(
    () => [
      {
        key: "images",
        label: "Reference",
        accept: "image/*",
        max: config.maxImages,
        icon: ImageSquare,
      },
    ],
    [config.maxImages],
  );

  const {
    attachments,
    libraryField,
    setLibraryField,
    addFiles,
    addAssets,
    removeAttachment,
    clearAttachments,
    routeFiles,
    uploadingCount,
    fileCounts,
    readyUrls,
  } = useMediaAttachments(uploadFields);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParamsByModel((prev) => ({
        ...prev,
        [model]: { ...(prev[model] ?? getDefaults(MODEL_CONFIGS[model])), [key]: value },
      }));
    },
    [model],
  );

  // ── drag-and-drop / paste ──────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggingOver(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      routeFiles(Array.from(e.dataTransfer.files));
    }
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length === 0) return;
    e.preventDefault();
    routeFiles(files);
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const creditCost = config.credits(params) * count;
  const canSubmit = !!prompt.trim() && uploadingCount === 0 && !submitting;

  // ── generate ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const imageUrls = (readyUrls().images ?? []).slice(0, config.maxImages);

    const payload: ImageGenerationSubmitParams = {
      prompt: prompt.trim(),
      model,
      ratio: params.ratio ?? "1:1",
      count,
    };
    if (model === "gpt-image-1.5") {
      payload.quality = params.quality ?? "medium";
    } else {
      payload.resolution = params.resolution ?? "2k";
    }
    if (imageUrls.length) payload.images = imageUrls;

    setSubmitting(true);
    try {
      await onSubmit(payload);
      setPrompt("");
      clearAttachments();
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    readyUrls,
    config.maxImages,
    prompt,
    model,
    params,
    count,
    onSubmit,
    clearAttachments,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={BOTTOM_PROMPT_DOCK_CLASS}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-full max-w-[768px] flex flex-col gap-2 pointer-events-auto">
        <AttachmentStrip attachments={attachments} onRemove={removeAttachment} />

        <div
          className={cn(
            "rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md transition-colors",
            draggingOver && "border-primary/60 bg-primary/5",
          )}
          onPaste={handlePaste}
        >
          <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />

          {/* Settings toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 px-3 pt-2.5 pb-1">
            <ModelPicker
              heading="Image"
              headingIcon={ImageSquare}
              items={MODEL_PICKER_ITEMS}
              activeKey={model}
              disabled={submitting}
              onSelect={(key) => setModel(key as ModelKey)}
            />

            <div className="mx-1 h-4 w-px bg-border/60" />

            {config.params.map((param) => (
              <ParamControl
                key={`${model}-${param.key}`}
                param={param}
                value={params[param.key] ?? param.defaultValue}
                disabled={submitting}
                onChange={(v) => setParam(param.key, v)}
              />
            ))}

            <CountSelect
              value={count}
              noun="image"
              disabled={submitting}
              onChange={setCount}
            />
          </div>

          {draggingOver && (
            <p className="px-4 pb-1 text-xs font-medium text-primary">
              Drop images here to attach
            </p>
          )}

          {/* Prompt */}
          <div className="px-4 pt-1">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the image you want to create..."
              rows={3}
              disabled={submitting}
              aria-label="Image prompt"
              className="w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50 max-h-[200px]"
            />
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 px-3 pb-3 pt-1">
            <Popover open={slotsOpen} onOpenChange={setSlotsOpen}>
              <PopoverTrigger>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Add reference images"
                  disabled={submitting}
                  className="relative size-9 shrink-0 rounded-lg bg-transparent text-muted-foreground"
                >
                  <Plus className="size-4" />
                  {attachments.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {attachments.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto rounded-2xl p-0"
                side="top"
                align="start"
                sideOffset={10}
              >
                <MediaSlots
                  fields={uploadFields}
                  attachments={attachments}
                  onPick={setLibraryField}
                  onRemove={removeAttachment}
                />
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {uploadingCount > 0 && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Uploading {uploadingCount} file
                  {uploadingCount > 1 ? "s" : ""}…
                </span>
              )}
              <GenerateButton
                credits={creditCost}
                disabled={!canSubmit}
                submitting={submitting}
                onClick={handleSubmit}
              />
            </div>
          </div>
        </div>
      </div>

      <LibraryPicker
        field={libraryField}
        fileCounts={fileCounts}
        onSelect={addAssets}
        onClose={() => setLibraryField(null)}
      />
    </div>
  );
}
