"use client";

import { useState, useCallback, useMemo } from "react";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  ParamControl,
  CountSelect,
  type ParamConfig,
} from "@/components/generator/param-control";
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
  MODES,
  MODE_KEYS,
  RESOLUTION_CREDITS,
  aspectRatioParam,
  resolutionParam,
  type ModeConfig,
  type ModeKey,
} from "./modes";

const MODE_PICKER_ITEMS = MODE_KEYS.map((key) => ({
  key,
  label: MODES[key].label,
  sublabel: MODES[key].description,
  icon: MODES[key].icon,
}));

function getDefaults(mode: ModeConfig): Record<string, string> {
  return {
    ...Object.fromEntries(mode.params.map((p) => [p.key, p.defaultValue])),
    "aspect-ratio": mode.defaultRatio,
    resolution: resolutionParam.defaultValue,
  };
}

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
  onSubmit: (payload: MovieMaterialsSubmitPayload) => Promise<unknown>;
}) {
  const [activeMode, setActiveMode] = useState<ModeKey>("face");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [paramsByMode, setParamsByMode] = useState<
    Partial<Record<ModeKey, Record<string, string>>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const config = MODES[activeMode];
  const params = paramsByMode[activeMode] ?? getDefaults(config);

  // Attachments persist across mode switches; only the active mode's fields
  // are shown and submitted.
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
  } = useMediaAttachments(config.media);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParamsByMode((prev) => ({
        ...prev,
        [activeMode]: {
          ...(prev[activeMode] ?? getDefaults(MODES[activeMode])),
          [key]: value,
        },
      }));
    },
    [activeMode],
  );

  const resolution = params.resolution ?? resolutionParam.defaultValue;
  const credits = (RESOLUTION_CREDITS[resolution] ?? RESOLUTION_CREDITS["2k"]) * count;
  const canSubmit = !!prompt.trim() && uploadingCount === 0 && !submitting;

  const toolbarParams: ParamConfig[] = useMemo(
    () => [
      ...config.params,
      { ...aspectRatioParam, defaultValue: config.defaultRatio },
      resolutionParam,
    ],
    [config],
  );

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

  return (
    <ComposerDock onFiles={routeFiles}>
      <AttachmentStrip
        attachments={visibleAttachments}
        fieldLabel={(key) =>
          config.media.find((f) => f.key === key)?.label ?? ""
        }
        onRemove={removeAttachment}
      />

      <ComposerCard>
        <ComposerToolbar>
          <ModelPicker
            label="Mode"
            items={MODE_PICKER_ITEMS}
            activeKey={activeMode}
            disabled={submitting}
            columns={2}
            onSelect={(key) => setActiveMode(key as ModeKey)}
          />
          <ComposerDivider />
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
        </ComposerToolbar>

        <ComposerPrompt
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void handleSubmit()}
          placeholder={config.placeholder}
          label="Movie material prompt"
          disabled={submitting}
        />

        <ComposerFooter
          start={
            <AddMediaButton
              label="References"
              fields={config.media}
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
