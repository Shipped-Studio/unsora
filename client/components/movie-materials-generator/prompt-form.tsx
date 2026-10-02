"use client";

import { useState, useCallback, useMemo } from "react";
import {
  UserCircle,
  UserRectangle,
  ListBullets,
  MapPin,
  FilmStrip,
  Palette,
  GridFour,
  Rows,
  Plus,
  ImageSquare,
} from "@phosphor-icons/react";
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
import type { IconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";

// ─── Mode configs ────────────────────────────────────────────────────────────

type ModeKey =
  | "face"
  | "wide-body"
  | "sheet"
  | "location"
  | "first-frame"
  | "style-collage"
  | "multishot-2x4"
  | "multishot-1x4";

interface ModeConfig {
  label: string;
  icon: ComponentType<IconProps>;
  description: string;
  placeholder: string;
  media: UploadField[];
  params: ParamConfig[];
  defaultRatio: string;
}

const cinematographyParam: ParamConfig = {
  key: "cinematography",
  label: "Cinematography",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "realistic", label: "Realistic" },
    { value: "cartoon", label: "Cartoon" },
    { value: "fantasy", label: "Fantasy" },
  ],
};

const aspectRatioParam: Omit<ParamConfig, "defaultValue"> = {
  key: "aspect-ratio",
  label: "Aspect Ratio",
  type: "aspect",
  options: [
    { value: "auto", label: "Auto" },
    { value: "1:1", label: "1:1" },
    { value: "9:16", label: "9:16" },
    { value: "16:9", label: "16:9" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ],
};

const resolutionParam: ParamConfig = {
  key: "resolution",
  label: "Resolution",
  type: "select",
  defaultValue: "2k",
  options: [
    { value: "1k", label: "1k" },
    { value: "2k", label: "2k" },
    { value: "4k", label: "4k" },
  ],
};

function imageField(key: string, label: string, max = 1): UploadField {
  return { key, label, accept: "image/*", max, icon: ImageSquare };
}

const modes: Record<ModeKey, ModeConfig> = {
  face: {
    label: "Character Face Reference",
    icon: UserCircle,
    description: "Generate a character face with age, gender and style control",
    placeholder: "Describe your character face reference...",
    defaultRatio: "3:4",
    media: [
      imageField("face-inspiration", "Face Inspiration"),
      imageField("style-collage", "Style Collage"),
    ],
    params: [
      {
        key: "age",
        label: "Age",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "child", label: "Child" },
          { value: "teen", label: "Teen" },
          { value: "adult", label: "Adult" },
          { value: "elderly", label: "Elderly" },
        ],
      },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
          { value: "neutral", label: "Neutral" },
        ],
      },
      cinematographyParam,
    ],
  },
  "wide-body": {
    label: "Character Wide-Body Reference",
    icon: UserRectangle,
    description: "Full body character with outfit and pose",
    placeholder: "Describe the character's body, outfit, and pose...",
    defaultRatio: "3:4",
    media: [
      imageField("face-ref", "Face Ref"),
      imageField("outfit-inspiration", "Outfit / Body"),
      imageField("style-collage", "Style Collage"),
    ],
    params: [cinematographyParam],
  },
  sheet: {
    label: "Character Sheet",
    icon: ListBullets,
    description: "Multi-angle character turnaround sheet",
    placeholder: "Describe the character sheet you want to generate...",
    defaultRatio: "16:9",
    media: [
      imageField("face-ref", "Face Ref"),
      imageField("wide-body-ref", "Wide-Body Ref"),
    ],
    params: [cinematographyParam],
  },
  location: {
    label: "Location Reference",
    icon: MapPin,
    description: "Generate a scene or environment reference",
    placeholder: "Describe the location, environment, and mood...",
    defaultRatio: "16:9",
    media: [
      imageField("location-inspiration", "Location"),
      imageField("style-collage", "Style Collage"),
    ],
    params: [cinematographyParam],
  },
  "first-frame": {
    label: "Video First Frame",
    icon: FilmStrip,
    description: "Compose the opening frame for a video shot",
    placeholder: "Describe the first frame composition...",
    defaultRatio: "16:9",
    media: [
      imageField("character-refs", "Characters"),
      imageField("location-ref", "Location"),
      imageField("style-collage", "Style Collage"),
    ],
    params: [
      cinematographyParam,
      {
        key: "camera-angle",
        label: "Camera Angle",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "eye-level", label: "Eye Level" },
          { value: "low-angle", label: "Low Angle" },
          { value: "high-angle", label: "High Angle" },
          { value: "dutch-angle", label: "Dutch Angle" },
          { value: "birds-eye", label: "Bird's Eye" },
          { value: "worms-eye", label: "Worm's Eye" },
          { value: "over-shoulder", label: "Over the Shoulder" },
        ],
      },
    ],
  },
  "style-collage": {
    label: "Style Reference Collage",
    icon: Palette,
    description: "Create a mood board collage for visual style",
    placeholder: "Describe the visual style, mood, and aesthetic...",
    defaultRatio: "16:9",
    media: [imageField("inspiration-images", "Inspiration", 3)],
    params: [
      cinematographyParam,
      {
        key: "color-palette",
        label: "Color Palette",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "warm", label: "Warm" },
          { value: "cool", label: "Cool" },
          { value: "muted", label: "Muted" },
          { value: "vibrant", label: "Vibrant" },
          { value: "monochrome", label: "Monochrome" },
          { value: "pastel", label: "Pastel" },
          { value: "neon", label: "Neon" },
        ],
      },
      {
        key: "lighting-mood",
        label: "Lighting",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "natural", label: "Natural" },
          { value: "golden-hour", label: "Golden Hour" },
          { value: "blue-hour", label: "Blue Hour" },
          { value: "neon-lit", label: "Neon Lit" },
          { value: "studio", label: "Studio" },
          { value: "dramatic", label: "Dramatic" },
          { value: "low-key", label: "Low Key" },
          { value: "high-key", label: "High Key" },
        ],
      },
      {
        key: "era-vibe",
        label: "Era / Vibe",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "modern", label: "Modern" },
          { value: "retro-70s", label: "Retro 70s" },
          { value: "80s-synth", label: "80s Synth" },
          { value: "90s-grunge", label: "90s Grunge" },
          { value: "noir", label: "Noir" },
          { value: "victorian", label: "Victorian" },
          { value: "futuristic", label: "Futuristic" },
          { value: "analog-film", label: "Analog Film" },
        ],
      },
    ],
  },
  "multishot-2x4": {
    label: "Multishot Board (2×4)",
    icon: GridFour,
    description: "Generate an 8-panel shot grid for storyboarding",
    placeholder: "Describe the scene sequence for the 2×4 board...",
    defaultRatio: "16:9",
    media: [
      imageField("character-refs", "Characters"),
      imageField("location-ref", "Location"),
      imageField("style-collage", "Style Collage"),
    ],
    params: [cinematographyParam],
  },
  "multishot-1x4": {
    label: "Multishot Board (1×4)",
    icon: Rows,
    description: "Generate a 4-panel horizontal shot strip",
    placeholder: "Describe the scene sequence for the 1×4 strip...",
    defaultRatio: "16:9",
    media: [
      imageField("character-refs", "Characters"),
      imageField("location-ref", "Location"),
      imageField("style-collage", "Style Collage"),
    ],
    params: [cinematographyParam],
  },
};

const modeKeys = Object.keys(modes) as ModeKey[];

const MODE_PICKER_ITEMS = modeKeys.map((key) => ({
  key,
  label: modes[key].label,
  sublabel: modes[key].description,
  icon: modes[key].icon,
}));

const RESOLUTION_CREDITS: Record<string, number> = {
  "1k": 5,
  "2k": 10,
  "4k": 20,
};

function getDefaults(mode: ModeConfig): Record<string, string> {
  return {
    ...Object.fromEntries(mode.params.map((p) => [p.key, p.defaultValue])),
    "aspect-ratio": mode.defaultRatio,
    resolution: resolutionParam.defaultValue,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MovieMaterialsSubmitPayload {
  prompt: string;
  mode: string;
  params: Record<string, string>;
  ratio: string;
  resolution: string;
  referenceImageUrls: string[];
  count: number;
}

export function MoviePromptForm({
  onSubmit,
}: {
  onSubmit: (payload: MovieMaterialsSubmitPayload) => Promise<string | null>;
}) {
  const [activeMode, setActiveMode] = useState<ModeKey>("face");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [paramsByMode, setParamsByMode] = useState<
    Partial<Record<ModeKey, Record<string, string>>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);

  const config = modes[activeMode];
  const params = paramsByMode[activeMode] ?? getDefaults(config);

  const {
    attachments: allAttachments,
    libraryField,
    setLibraryField,
    addAssets,
    removeAttachment,
    clearAttachments,
    routeFiles,
    uploadingCount,
    fileCounts,
    readyUrls,
  } = useMediaAttachments(config.media);

  // Attachments persist across mode switches but only the active mode's
  // fields are shown and submitted.
  const visibleAttachments = useMemo(() => {
    const keys = new Set(config.media.map((f) => f.key));
    return allAttachments.filter((a) => keys.has(a.fieldKey));
  }, [config.media, allAttachments]);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParamsByMode((prev) => ({
        ...prev,
        [activeMode]: {
          ...(prev[activeMode] ?? getDefaults(modes[activeMode])),
          [key]: value,
        },
      }));
    },
    [activeMode],
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
  const resolution = params.resolution ?? "2k";
  const credits = (RESOLUTION_CREDITS[resolution] ?? 5) * count;
  const canSubmit = !!prompt.trim() && uploadingCount === 0 && !submitting;

  const toolbarParams: ParamConfig[] = useMemo(
    () => [
      ...config.params,
      { ...aspectRatioParam, defaultValue: config.defaultRatio },
      resolutionParam,
    ],
    [config],
  );

  // ── generate ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const urls = readyUrls();
    const referenceImageUrls = config.media.flatMap((f) => urls[f.key] ?? []);

    const modeParams: Record<string, string> = {};
    for (const p of config.params) {
      modeParams[p.key] = params[p.key] ?? p.defaultValue;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        prompt: prompt.trim(),
        mode: activeMode,
        params: modeParams,
        ratio: params["aspect-ratio"] ?? config.defaultRatio,
        resolution,
        referenceImageUrls,
        count,
      });
      setPrompt("");
      clearAttachments();
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    readyUrls,
    config,
    params,
    prompt,
    activeMode,
    resolution,
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
        <AttachmentStrip
          attachments={visibleAttachments}
          fieldLabel={(key) =>
            config.media.find((f) => f.key === key)?.label ?? key
          }
          onRemove={removeAttachment}
        />

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
              heading="Mode"
              headingIcon={FilmStrip}
              items={MODE_PICKER_ITEMS}
              activeKey={activeMode}
              disabled={submitting}
              columns={2}
              onSelect={(key) => setActiveMode(key as ModeKey)}
            />

            <div className="mx-1 h-4 w-px bg-border/60" />

            {toolbarParams.map((param) => (
              <ParamControl
                key={`${activeMode}-${param.key}`}
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
              placeholder={config.placeholder}
              rows={3}
              disabled={submitting}
              aria-label="Movie material prompt"
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
                  {visibleAttachments.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {visibleAttachments.length}
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
                  fields={config.media}
                  attachments={visibleAttachments}
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
                credits={credits}
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
