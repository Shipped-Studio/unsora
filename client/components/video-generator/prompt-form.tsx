"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VideoGenerationSubmitParams } from "@/hooks/use-video-generation";
import { ParamControl, CountSelect } from "@/components/generator/param-control";
import { ModelPicker } from "@/components/generator/model-picker";
import { LibraryPicker } from "@/components/generator/library-picker";
import { AttachmentStrip } from "@/components/generator/attachment-strip";
import { useMediaAttachments } from "@/components/generator/use-media-attachments";
import {
  AddMediaButton,
  ComposerCard,
  ComposerDivider,
  ComposerDock,
  ComposerFooter,
  ComposerPrompt,
  ComposerToolbar,
  UploadingNote,
} from "@/components/generator/prompt-composer";
import {
  MODEL_CONFIGS,
  MODEL_KEYS,
  getVisibleUploadFields,
  getDefaultParams,
  type ModelKey,
} from "./forms/model-configs";
import { MentionEditor, type MentionFile } from "./forms/mention-editor";

const PROMPT_WARN_AT = 1400;
const PROMPT_STRONG_WARN_AT = 1600;

const MODEL_PICKER_ITEMS = MODEL_KEYS.map((key) => {
  const m = MODEL_CONFIGS[key];
  return {
    key,
    label: m.label,
    sublabel: m.provider,
    title: `${m.description}. ${m.priceHint}`,
    iconSrc: m.icon,
  };
});

/** Attachments are kept per model, so field keys carry the model as a prefix. */
const scoped = (model: ModelKey, key: string) => `${model}:${key}`;
const unscoped = (key: string) => key.slice(key.indexOf(":") + 1);

interface VideoPromptFormProps {
  onSubmit: (params: VideoGenerationSubmitParams) => Promise<string | null>;
}

export function VideoPromptForm({ onSubmit }: VideoPromptFormProps) {
  const [activeModel, setActiveModel] = useState<ModelKey>("seedance");
  // The prompt is shared across models so switching doesn't lose it.
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [paramsByModel, setParamsByModel] = useState<
    Partial<Record<ModelKey, Record<string, string>>>
  >({});
  const [countByModel, setCountByModel] = useState<
    Partial<Record<ModelKey, number>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const config = MODEL_CONFIGS[activeModel];
  const params = useMemo(
    () => paramsByModel[activeModel] ?? getDefaultParams(config),
    [paramsByModel, activeModel, config],
  );
  const count = countByModel[activeModel] ?? 1;

  const visibleFields = useMemo(
    () =>
      getVisibleUploadFields(config, params).map((f) => ({
        ...f,
        key: scoped(activeModel, f.key),
      })),
    [config, params, activeModel],
  );

  const {
    visibleAttachments,
    libraryField,
    setLibraryField,
    addAssets,
    removeAttachment,
    clearAttachments,
    routeFiles,
    uploadingCount,
    fileCounts,
    readyUrls,
  } = useMediaAttachments(visibleFields);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParamsByModel((prev) => ({
        ...prev,
        [activeModel]: {
          ...(prev[activeModel] ?? getDefaultParams(MODEL_CONFIGS[activeModel])),
          [key]: value,
        },
      }));
    },
    [activeModel],
  );

  // Counts per unscoped field key, for the model's credit formula.
  const creditFileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of visibleAttachments) {
      if (a.status === "error") continue;
      const key = unscoped(a.fieldKey);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [visibleAttachments]);

  const credits = config.calculateCredits(params, creditFileCounts) * count;
  const canSubmit = !!prompt.trim() && uploadingCount === 0 && !submitting;

  const mentionFiles: MentionFile[] = useMemo(() => {
    const perKind: Record<string, number> = {};
    return visibleAttachments
      .filter((a) => a.status !== "error")
      .map((a) => {
        const n = (perKind[a.kind] = (perKind[a.kind] ?? 0) + 1);
        return {
          id: a.id,
          label: `${a.kind}_file_${n}`,
          preview: a.objectUrl,
          kind: a.kind,
        };
      });
  }, [visibleAttachments]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || submitting) return;
    if (uploadingCount > 0) {
      toast.error("Wait for your files to finish uploading.");
      return;
    }

    const uploads: Record<string, string[]> = {};
    for (const [key, urls] of Object.entries(readyUrls())) {
      uploads[unscoped(key)] = urls;
    }

    const submitParams = config.buildSubmitParams({
      model: activeModel,
      prompt: prompt.trim(),
      negativePrompt: config.supportsNegativePrompt ? negativePrompt.trim() : "",
      count,
      params,
      uploads,
    });

    setSubmitting(true);
    try {
      const id = await onSubmit(submitParams);
      if (id) {
        setPrompt("");
        setNegativePrompt("");
        setShowNegativePrompt(false);
        clearAttachments(
          config.uploadFields.map((f) => scoped(activeModel, f.key)),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    prompt,
    negativePrompt,
    submitting,
    uploadingCount,
    readyUrls,
    config,
    activeModel,
    count,
    params,
    onSubmit,
    clearAttachments,
  ]);

  const submitIfReady = () => {
    if (canSubmit) void handleGenerate();
  };

  const promptLength = prompt.trim().length;
  const lengthNote =
    promptLength > PROMPT_STRONG_WARN_AT
      ? "Very long prompts often time out. Shorten it if you can."
      : promptLength > PROMPT_WARN_AT
        ? "Long prompts take longer and can time out."
        : null;

  return (
    <ComposerDock onFiles={visibleFields.length > 0 ? routeFiles : undefined}>
      <AttachmentStrip
        attachments={visibleAttachments}
        fieldLabel={(key) =>
          visibleFields.find((f) => f.key === key)?.label ?? ""
        }
        onRemove={removeAttachment}
      />

      <ComposerCard>
        <ComposerToolbar>
          <ModelPicker
            label="Model"
            items={MODEL_PICKER_ITEMS}
            activeKey={activeModel}
            disabled={submitting}
            onSelect={(key) => setActiveModel(key as ModelKey)}
          />
          <ComposerDivider />
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
            value={count}
            noun="video"
            disabled={submitting}
            onChange={(n) =>
              setCountByModel((prev) => ({ ...prev, [activeModel]: n }))
            }
          />
          {config.supportsNegativePrompt && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              aria-pressed={showNegativePrompt}
              onClick={() => setShowNegativePrompt((v) => !v)}
              className={cn(
                "text-xs font-normal text-muted-foreground hover:text-foreground",
                showNegativePrompt && "text-foreground",
              )}
            >
              Negative prompt
            </Button>
          )}
        </ComposerToolbar>

        {config.fileMentions ? (
          <MentionEditor
            editorId={`${activeModel}-prompt-editor`}
            value={prompt}
            placeholder={config.placeholder}
            label="Video prompt"
            disabled={submitting}
            files={mentionFiles}
            onChange={setPrompt}
            onSubmitShortcut={submitIfReady}
          />
        ) : (
          <ComposerPrompt
            value={prompt}
            onChange={setPrompt}
            onSubmit={submitIfReady}
            placeholder={config.placeholder}
            label="Video prompt"
            disabled={submitting}
          />
        )}

        {config.supportsNegativePrompt && showNegativePrompt && (
          <div className="relative px-3 pb-2">
            <Textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="What to leave out of the video"
              aria-label="Negative prompt"
              disabled={submitting}
              className="min-h-14 resize-none pr-9 text-sm"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove negative prompt"
              className="absolute top-1.5 right-4.5"
              onClick={() => {
                setShowNegativePrompt(false);
                setNegativePrompt("");
              }}
            >
              <X />
            </Button>
          </div>
        )}

        {lengthNote && (
          <p
            className={cn(
              "px-4 pb-2 text-xs",
              promptLength > PROMPT_STRONG_WARN_AT
                ? "text-warning"
                : "text-muted-foreground",
            )}
          >
            <span className="tabular-nums">
              {promptLength.toLocaleString()} characters.
            </span>{" "}
            {lengthNote}
          </p>
        )}

        <ComposerFooter
          start={
            visibleFields.length > 0 ? (
              <AddMediaButton
                fields={visibleFields}
                attachments={visibleAttachments}
                showArrows
                disabled={submitting}
                onPick={setLibraryField}
                onRemove={removeAttachment}
                onFiles={routeFiles}
              />
            ) : null
          }
          end={
            <>
              <UploadingNote count={uploadingCount} />
              <GenerateButton
                credits={credits}
                disabled={!canSubmit}
                submitting={submitting}
                onClick={handleGenerate}
              />
            </>
          }
        />
      </ComposerCard>

      <LibraryPicker
        field={libraryField}
        fileCounts={fileCounts}
        onSelect={addAssets}
        onClose={() => setLibraryField(null)}
      />
    </ComposerDock>
  );
}
