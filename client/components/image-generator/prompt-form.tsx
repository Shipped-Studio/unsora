"use client";

import { useState, useCallback, useMemo } from "react";
import { ImageSquare } from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import { ParamControl, CountSelect } from "@/components/generator/param-control";
import { ModelPicker } from "@/components/generator/model-picker";
import { LibraryPicker } from "@/components/generator/library-picker";
import { AttachmentStrip } from "@/components/generator/attachment-strip";
import { useMediaAttachments } from "@/components/generator/use-media-attachments";
import type { UploadField } from "@/components/generator/attachments";
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
  MODEL_PICKER_ITEMS,
  getDefaults,
  type ModelKey,
} from "./model-configs";

export interface ImageGenerationSubmitParams {
  prompt: string;
  model: string;
  ratio: string;
  resolution?: string;
  quality?: string;
  images?: string[];
  count: number;
}

export function ImagePromptForm({
  onSubmit,
}: {
  onSubmit: (params: ImageGenerationSubmitParams) => Promise<unknown>;
}) {
  const [model, setModel] = useState<ModelKey>("nano-banana-2");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [paramsByModel, setParamsByModel] = useState<
    Partial<Record<ModelKey, Record<string, string>>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const config = MODEL_CONFIGS[model];
  const params = paramsByModel[model] ?? getDefaults(config);

  const uploadFields: UploadField[] = useMemo(
    () => [
      {
        key: "images",
        label: "References",
        accept: "image/*",
        max: config.maxImages,
        icon: ImageSquare,
      },
    ],
    [config.maxImages],
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
  } = useMediaAttachments(uploadFields);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParamsByModel((prev) => ({
        ...prev,
        [model]: {
          ...(prev[model] ?? getDefaults(MODEL_CONFIGS[model])),
          [key]: value,
        },
      }));
    },
    [model],
  );

  const credits = config.credits(params) * count;
  const canSubmit = !!prompt.trim() && uploadingCount === 0 && !submitting;

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

  return (
    <ComposerDock onFiles={routeFiles}>
      <AttachmentStrip attachments={visibleAttachments} onRemove={removeAttachment} />

      <ComposerCard>
        <ComposerToolbar>
          <ModelPicker
            label="Model"
            items={MODEL_PICKER_ITEMS}
            activeKey={model}
            disabled={submitting}
            onSelect={(key) => setModel(key as ModelKey)}
          />
          <ComposerDivider />
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
        </ComposerToolbar>

        <ComposerPrompt
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void handleSubmit()}
          placeholder="Describe the image"
          label="Image prompt"
          disabled={submitting}
        />

        <ComposerFooter
          start={
            <AddMediaButton
              label="References"
              fields={uploadFields}
              attachments={visibleAttachments}
              disabled={submitting}
              onPick={setLibraryField}
              onRemove={removeAttachment}
              onFiles={routeFiles}
            />
          }
          end={
            <>
              <UploadingNote count={uploadingCount} />
              <GenerateButton
                credits={credits}
                disabled={!canSubmit}
                submitting={submitting}
                onClick={handleSubmit}
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
