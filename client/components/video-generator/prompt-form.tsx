"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Plus, X, Warning, VideoCamera } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { BOTTOM_PROMPT_DOCK_CLASS_COMPACT } from "@/lib/layout-classes";
import { uploadFileToStorage } from "@/lib/storage-client";
import { getCdnUrl } from "@/lib/video-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { type VideoGenerationSubmitParams } from "@/hooks/use-video-generation";
import { assetQueryKeys, type UnifiedAsset } from "@/hooks/use-all-assets";
import {
  ParamControl,
  CountSelect,
} from "@/components/generator/param-control";
import { ModelPicker } from "@/components/generator/model-picker";
import { MediaSlots } from "@/components/generator/media-slots";
import { LibraryPicker } from "@/components/generator/library-picker";
import { AttachmentStrip } from "@/components/generator/attachment-strip";
import {
  kindFromAccept,
  validateFile,
  type Attachment,
} from "@/components/generator/attachments";
import {
  MODEL_CONFIGS,
  MODEL_KEYS,
  getVisibleUploadFields,
  getDefaultParams,
  type ModelKey,
  type ModelConfig,
  type UploadFieldConfig,
} from "./forms/model-configs";
import { MentionEditor, type MentionFile } from "./forms/mention-editor";

// ─── constants ────────────────────────────────────────────────────────────────

const PROMPT_WARN_AT = 1400;
const PROMPT_STRONG_WARN_AT = 1600;

// ─── types ────────────────────────────────────────────────────────────────────

interface ModelFormState {
  paramValues: Record<string, string>;
  attachments: Attachment[];
  count: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function createModelState(config: ModelConfig): ModelFormState {
  return { paramValues: getDefaultParams(config), attachments: [], count: 1 };
}

function assetTypeFromMime(mime: string): "IMAGE" | "VIDEO" | "AUDIO" {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "IMAGE";
}

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

// ─── component ────────────────────────────────────────────────────────────────

interface VideoPromptFormProps {
  onSubmit: (params: VideoGenerationSubmitParams) => Promise<string | null>;
}

export function VideoPromptForm({ onSubmit }: VideoPromptFormProps) {
  const [activeModel, setActiveModel] = useState<ModelKey>("seedance");
  // Prompt is shared across models so switching doesn't lose your text
  const [prompt, setPrompt] = useState("");
  const [negativePromptText, setNegativePromptText] = useState("");
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [modelStates, setModelStates] = useState<
    Partial<Record<ModelKey, ModelFormState>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [libraryField, setLibraryField] = useState<UploadFieldConfig | null>(
    null,
  );

  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  const config = MODEL_CONFIGS[activeModel];
  const state = modelStates[activeModel] ?? createModelState(config);
  const params = state.paramValues;

  const visibleFields = useMemo(
    () => getVisibleUploadFields(config, params),
    [config, params],
  );
  const visibleAttachments = useMemo(() => {
    const keys = new Set(visibleFields.map((f) => f.key));
    return state.attachments.filter((a) => keys.has(a.fieldKey));
  }, [visibleFields, state.attachments]);

  // ── cleanup object URLs on unmount ─────────────────────────────────────────
  const allAttachmentsRef = useRef<Attachment[]>([]);
  allAttachmentsRef.current = Object.values(modelStates).flatMap(
    (s) => s?.attachments ?? [],
  );
  useEffect(() => {
    return () => {
      allAttachmentsRef.current.forEach((a) =>
        URL.revokeObjectURL(a.objectUrl),
      );
    };
  }, []);

  // ── state updates ──────────────────────────────────────────────────────────
  const updateModelState = useCallback(
    (model: ModelKey, updater: (prev: ModelFormState) => ModelFormState) => {
      setModelStates((prev) => ({
        ...prev,
        [model]: updater(prev[model] ?? createModelState(MODEL_CONFIGS[model])),
      }));
    },
    [],
  );

  const patchAttachment = useCallback(
    (model: ModelKey, id: string, patch: Partial<Attachment>) => {
      updateModelState(model, (s) => ({
        ...s,
        attachments: s.attachments.map((a) =>
          a.id === id ? { ...a, ...patch } : a,
        ),
      }));
    },
    [updateModelState],
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      updateModelState(activeModel, (s) => ({
        ...s,
        paramValues: { ...s.paramValues, [key]: value },
      }));
    },
    [activeModel, updateModelState],
  );

  const setCount = useCallback(
    (count: number) => {
      updateModelState(activeModel, (s) => ({ ...s, count }));
    },
    [activeModel, updateModelState],
  );

  // ── uploads (eager, with progress) ─────────────────────────────────────────
  /** Save an upload into the asset library so it's reusable everywhere. */
  const registerAsset = useCallback(
    (file: File, url: string) => {
      authFetch("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          url,
          mimeType: file.type,
          type: assetTypeFromMime(file.type),
          fileSize: file.size,
        }),
      })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: assetQueryKeys.all }),
        )
        .catch(() => {
          // Library registration is best-effort; the generation itself
          // only needs the blob URL.
        });
    },
    [authFetch, queryClient],
  );

  const addFiles = useCallback(
    (field: UploadFieldConfig, incoming: File[]) => {
      const model = activeModel;
      const current =
        modelStates[model] ?? createModelState(MODEL_CONFIGS[model]);
      const existing = current.attachments.filter(
        (a) => a.fieldKey === field.key,
      ).length;

      const available = field.max - existing;
      if (available <= 0) {
        toast.error(
          `${field.label}: you can attach up to ${field.max} file${field.max === 1 ? "" : "s"}.`,
        );
        return;
      }
      if (incoming.length > available) {
        toast.error(
          `${field.label}: only ${available} more file${available === 1 ? "" : "s"} can be added (max ${field.max}).`,
        );
      }

      const valid: File[] = [];
      for (const file of incoming.slice(0, available)) {
        const err = validateFile(file, field);
        if (err) toast.error(err);
        else valid.push(file);
      }
      if (valid.length === 0) return;

      const pending: Attachment[] = valid.map((file) => ({
        id: crypto.randomUUID(),
        fieldKey: field.key,
        fileName: file.name,
        kind: kindFromAccept(field.accept),
        objectUrl: URL.createObjectURL(file),
        url: null,
        status: "uploading" as const,
        progress: 0,
      }));

      updateModelState(model, (s) => ({
        ...s,
        attachments: [...s.attachments, ...pending],
      }));

      pending.forEach((entry, idx) => {
        const file = valid[idx];
        uploadFileToStorage(file, ({ percentage }) =>
          patchAttachment(model, entry.id, { progress: percentage }),
        )
          .then((result) => {
            if (result.success && result.blobUrl) {
              patchAttachment(model, entry.id, {
                url: result.blobUrl,
                status: "ready",
                progress: 100,
              });
              registerAsset(file, result.blobUrl);
            } else {
              patchAttachment(model, entry.id, { status: "error" });
              toast.error(`Failed to upload "${file.name}".`);
            }
          })
          .catch(() => {
            patchAttachment(model, entry.id, { status: "error" });
            toast.error(`Failed to upload "${file.name}".`);
          });
      });
    },
    [activeModel, modelStates, updateModelState, patchAttachment, registerAsset],
  );

  /** Attach already-uploaded assets picked from the media library. */
  const addAssetAttachments = useCallback(
    (field: UploadFieldConfig, assets: UnifiedAsset[]) => {
      const model = activeModel;
      const current =
        modelStates[model] ?? createModelState(MODEL_CONFIGS[model]);
      const existing = current.attachments.filter(
        (a) => a.fieldKey === field.key,
      ).length;
      const available = field.max - existing;
      const kind = kindFromAccept(field.accept);

      const usable = assets.filter((a) => a.outputUrl && a.mediaType === kind);
      if (usable.length < assets.length) {
        toast.error(`${field.label}: some selected items aren't ${kind}s.`);
      }
      if (usable.length > available) {
        toast.error(
          `${field.label}: only ${available} more file${available === 1 ? "" : "s"} can be added (max ${field.max}).`,
        );
      }

      const selected = usable.slice(0, Math.max(0, available));
      if (selected.length === 0) return;

      const newAtts: Attachment[] = selected.map((a) => ({
        id: crypto.randomUUID(),
        fieldKey: field.key,
        fileName: a.name || a.prompt || "Library asset",
        kind,
        objectUrl: getCdnUrl(a.outputUrl!),
        url: a.outputUrl!,
        status: "ready" as const,
        progress: 100,
      }));

      updateModelState(model, (s) => ({
        ...s,
        attachments: [...s.attachments, ...newAtts],
      }));
    },
    [activeModel, modelStates, updateModelState],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      updateModelState(activeModel, (s) => {
        const att = s.attachments.find((a) => a.id === id);
        if (att) URL.revokeObjectURL(att.objectUrl);
        return { ...s, attachments: s.attachments.filter((a) => a.id !== id) };
      });
    },
    [activeModel, updateModelState],
  );

  /** Route loose files (drop/paste) to the first visible field that accepts them. */
  const routeFiles = useCallback(
    (files: File[]) => {
      const counts: Record<string, number> = {};
      for (const f of visibleFields) {
        counts[f.key] = state.attachments.filter(
          (a) => a.fieldKey === f.key,
        ).length;
      }

      const byField = new Map<string, File[]>();
      for (const file of files) {
        const field = visibleFields.find(
          (f) =>
            file.type.startsWith(`${kindFromAccept(f.accept)}/`) &&
            (counts[f.key] ?? 0) < f.max,
        );
        if (!field) {
          toast.error(
            `No available slot for "${file.name}" on ${config.label}.`,
          );
          continue;
        }
        counts[field.key] += 1;
        byField.set(field.key, [...(byField.get(field.key) ?? []), file]);
      }

      for (const [key, fieldFiles] of byField) {
        const field = visibleFields.find((f) => f.key === key)!;
        addFiles(field, fieldFiles);
      }
    },
    [visibleFields, state.attachments, config.label, addFiles],
  );

  // ── drag-and-drop / paste ──────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files") && visibleFields.length > 0) {
      setDraggingOver(true);
    }
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
  const uploadingCount = visibleAttachments.filter(
    (a) => a.status === "uploading",
  ).length;

  const fileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of visibleAttachments) {
      if (a.status === "error") continue;
      counts[a.fieldKey] = (counts[a.fieldKey] ?? 0) + 1;
    }
    return counts;
  }, [visibleAttachments]);

  const credits = config.calculateCredits(params, fileCounts) * state.count;

  const canSubmit = !!prompt.trim() && uploadingCount === 0 && !submitting;

  const mentionFiles: MentionFile[] = useMemo(() => {
    const kindCounters: Record<string, number> = {};
    return visibleAttachments.map((a) => {
      const n = (kindCounters[a.kind] = (kindCounters[a.kind] ?? 0) + 1);
      return {
        id: a.id,
        label: `${a.kind}_file_${n}`,
        preview: a.objectUrl,
        kind: a.kind,
      };
    });
  }, [visibleAttachments]);

  // ── generate ───────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || submitting) return;
    if (uploadingCount > 0) {
      toast.error("Please wait for your files to finish uploading.");
      return;
    }

    const uploads: Record<string, string[]> = {};
    for (const a of visibleAttachments) {
      if (a.status === "ready" && a.url) {
        (uploads[a.fieldKey] ??= []).push(a.url);
      }
    }

    const submitParams = config.buildSubmitParams({
      model: activeModel,
      prompt: prompt.trim(),
      negativePrompt: config.supportsNegativePrompt
        ? negativePromptText.trim()
        : "",
      count: state.count,
      params,
      uploads,
    });

    setSubmitting(true);
    try {
      const id = await onSubmit(submitParams);
      if (id) {
        setPrompt("");
        setNegativePromptText("");
        setShowNegativePrompt(false);
        updateModelState(activeModel, (s) => {
          s.attachments.forEach((a) => URL.revokeObjectURL(a.objectUrl));
          return { ...s, attachments: [] };
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    prompt,
    negativePromptText,
    submitting,
    uploadingCount,
    visibleAttachments,
    config,
    activeModel,
    state.count,
    params,
    onSubmit,
    updateModelState,
  ]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) void handleGenerate();
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const promptLength = prompt.trim().length;
  const isStrongWarning = promptLength > PROMPT_STRONG_WARN_AT;
  const isWarning = promptLength > PROMPT_WARN_AT && !isStrongWarning;

  return (
    <div
      className={BOTTOM_PROMPT_DOCK_CLASS_COMPACT}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-full max-w-[768px] flex flex-col gap-2 pointer-events-auto">
        <AttachmentStrip
          attachments={visibleAttachments}
          fieldLabel={(key) =>
            config.uploadFields.find((f) => f.key === key)?.label ?? key
          }
          onRemove={removeAttachment}
        />

        {/* Main prompt card */}
        <div
          className={cn(
            "rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md transition-colors",
            draggingOver && "border-primary/60 bg-primary/5",
          )}
          onPaste={handlePaste}
        >
          <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />

          {/* Settings toolbar — controls rendered from the model config */}
          <div className="flex flex-wrap items-center gap-0.5 px-3 pt-2.5 pb-1">
            <ModelPicker
              heading="Video"
              headingIcon={VideoCamera}
              items={MODEL_PICKER_ITEMS}
              activeKey={activeModel}
              disabled={submitting}
              onSelect={(key) => setActiveModel(key as ModelKey)}
            />

            <div className="mx-1 h-4 w-px bg-border/60" />

            {config.params.map((param) => (
              <ParamControl
                key={`${activeModel}-${param.key}`}
                param={param}
                value={params[param.key] ?? param.defaultValue}
                disabled={submitting}
                onChange={(v) => setParam(param.key, v)}
              />
            ))}

            <CountSelect
              value={state.count}
              noun="video"
              disabled={submitting}
              onChange={setCount}
            />

            {config.supportsNegativePrompt && (
              <Button
                variant="ghost"
                disabled={submitting}
                onClick={() => setShowNegativePrompt((v) => !v)}
                className={cn(
                  "h-8 text-xs gap-1 px-2 font-normal text-muted-foreground hover:text-foreground",
                  showNegativePrompt && "text-foreground",
                )}
              >
                Negative prompt
              </Button>
            )}
          </div>

          {draggingOver && (
            <p className="px-4 pb-1 text-xs font-medium text-primary">
              Drop files here to attach
            </p>
          )}

          {/* Prompt */}
          <div className="px-4 pt-1">
            {config.fileMentions ? (
              <MentionEditor
                editorId={`${activeModel}-prompt-editor`}
                value={prompt}
                placeholder={config.placeholder}
                disabled={submitting}
                files={mentionFiles}
                onChange={setPrompt}
                onSubmitShortcut={() => {
                  if (canSubmit) void handleGenerate();
                }}
              />
            ) : (
              <textarea
                placeholder={config.placeholder}
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                disabled={submitting}
                aria-label="Video prompt"
                className="w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50 max-h-[200px]"
              />
            )}
          </div>

          {/* Negative prompt */}
          {config.supportsNegativePrompt && showNegativePrompt && (
            <div className="px-4 pb-1">
              <div className="relative">
                <textarea
                  placeholder="Describe what you don't want in the video..."
                  rows={2}
                  value={negativePromptText}
                  onChange={(e) => setNegativePromptText(e.target.value)}
                  disabled={submitting}
                  className="w-full resize-none rounded-lg bg-muted/50 px-3 py-2 pr-8 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
                />
                <button
                  onClick={() => setShowNegativePrompt(false)}
                  className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" weight="bold" />
                </button>
              </div>
            </div>
          )}

          {/* Prompt length warnings */}
          {(isWarning || isStrongWarning) && (
            <div
              className={cn(
                "mx-3 mb-1 flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                isStrongWarning
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400",
              )}
            >
              <Warning className="size-3.5 shrink-0 mt-0.5" weight="bold" />
              <div>
                <span className="font-semibold">
                  {promptLength.toLocaleString()}+ chars
                  {isStrongWarning && " — high timeout risk"}
                </span>
                <p className="mt-0.5 opacity-80">
                  {isStrongWarning
                    ? "Very long prompts are more likely to fail. Consider shortening."
                    : "Longer prompts can increase generation time and may time out."}
                </p>
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 px-3 pb-3 pt-1">
            {visibleFields.length > 0 && (
              <Popover open={slotsOpen} onOpenChange={setSlotsOpen}>
                <PopoverTrigger>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Add media"
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
                    fields={visibleFields}
                    attachments={visibleAttachments}
                    showArrows
                    onPick={(field) =>
                      setLibraryField(field as UploadFieldConfig)
                    }
                    onRemove={removeAttachment}
                  />
                </PopoverContent>
              </Popover>
            )}

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
                onClick={handleGenerate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Media library picker — reuse uploads & generations from anywhere */}
      <LibraryPicker
        field={libraryField}
        fileCounts={fileCounts}
        onSelect={(field, assets) =>
          addAssetAttachments(field as UploadFieldConfig, assets)
        }
        onClose={() => setLibraryField(null)}
      />
    </div>
  );
}
