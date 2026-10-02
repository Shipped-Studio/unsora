"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ImageSquare, VideoCamera } from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import { ParamControl, type ParamConfig } from "@/components/generator/param-control";
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

export const MOTION_MODELS = [
  { value: "kling_mc_3.0_pro", label: "Kling 3.0 Pro", resolution: "1080p" },
  { value: "kling_mc_3.0_std", label: "Kling 3.0 Standard", resolution: "720p" },
  { value: "kling_mc_2.6_pro", label: "Kling 2.6 Pro", resolution: "1080p" },
] as const;

export function motionModelLabel(model?: string | null) {
  if (!model) return null;
  return MOTION_MODELS.find((m) => m.value === model)?.label ?? model;
}

/**
 * The server bills every motion control run at the 10 second tier. Keep in
 * sync with calculateMotionControlCredits in
 * server/src/controllers/motion-control.controller.ts.
 */
export const MOTION_CONTROL_CREDITS = 148;

const MODEL_ITEMS = MOTION_MODELS.map((m) => ({
  key: m.value,
  label: m.label,
  sublabel: `Kling, ${m.resolution}`,
  iconSrc: "/models/kling.svg",
}));

const MOTION_FIELD: UploadField = {
  key: "motion",
  label: "Motion video",
  accept: "video/*",
  max: 1,
  icon: VideoCamera,
};
const CHARACTER_FIELD: UploadField = {
  key: "character",
  label: "Character image",
  accept: "image/*",
  max: 1,
  icon: ImageSquare,
};
const FIELDS = [MOTION_FIELD, CHARACTER_FIELD];

const orientationParam: ParamConfig = {
  key: "orientation",
  label: "Orientation",
  type: "select",
  defaultValue: "video",
  options: [
    { value: "video", label: "Orientation from video" },
    { value: "image", label: "Orientation from image" },
  ],
};

const soundParam: ParamConfig = {
  key: "keep_sound",
  label: "Keep audio",
  type: "toggle",
  defaultValue: "on",
  options: [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ],
};

export interface MotionSubmitParams {
  model: string;
  prompt: string;
  motion_video_url: string;
  character_image_url: string;
  resolution: string;
  keep_sound: boolean;
  character_orientation: "video" | "image";
}

export function MotionUploadForm({
  onSubmit,
}: {
  onSubmit: (params: MotionSubmitParams) => Promise<string | null>;
}) {
  const [model, setModel] = useState<string>(MOTION_MODELS[0].value);
  const [prompt, setPrompt] = useState("");
  const [orientation, setOrientation] = useState(orientationParam.defaultValue);
  const [keepSound, setKeepSound] = useState(soundParam.defaultValue);
  const [submitting, setSubmitting] = useState(false);

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
  } = useMediaAttachments(FIELDS);

  const urls = readyUrls();
  const motionUrl = urls[MOTION_FIELD.key]?.[0];
  const characterUrl = urls[CHARACTER_FIELD.key]?.[0];
  const selectedModel =
    MOTION_MODELS.find((m) => m.value === model) ?? MOTION_MODELS[0];

  const canSubmit =
    !!motionUrl && !!characterUrl && uploadingCount === 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!motionUrl || !characterUrl) {
      toast.error("Add a motion video and a character image.");
      return;
    }
    if (uploadingCount > 0) {
      toast.error("Wait for your files to finish uploading.");
      return;
    }

    setSubmitting(true);
    try {
      const id = await onSubmit({
        model,
        prompt: prompt.trim(),
        motion_video_url: motionUrl,
        character_image_url: characterUrl,
        resolution: selectedModel.resolution,
        keep_sound: keepSound === "on",
        character_orientation: orientation === "image" ? "image" : "video",
      });
      if (id) {
        setPrompt("");
        clearAttachments();
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    motionUrl,
    characterUrl,
    uploadingCount,
    onSubmit,
    model,
    prompt,
    selectedModel.resolution,
    keepSound,
    orientation,
    clearAttachments,
  ]);

  const missing = [
    !motionUrl && "a motion video",
    !characterUrl && "a character image",
  ].filter(Boolean);

  return (
    <ComposerDock onFiles={routeFiles}>
      <AttachmentStrip
        attachments={visibleAttachments}
        fieldLabel={(key) => FIELDS.find((f) => f.key === key)?.label ?? ""}
        onRemove={removeAttachment}
      />

      <ComposerCard>
        <ComposerToolbar>
          <ModelPicker
            label="Model"
            items={MODEL_ITEMS}
            activeKey={model}
            disabled={submitting}
            onSelect={setModel}
          />
          <ComposerDivider />
          <ParamControl
            param={orientationParam}
            value={orientation}
            disabled={submitting}
            onChange={setOrientation}
          />
          <ParamControl
            param={soundParam}
            value={keepSound}
            disabled={submitting}
            onChange={setKeepSound}
          />
        </ComposerToolbar>

        <ComposerPrompt
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void handleSubmit()}
          placeholder="Describe the motion or scene (optional)"
          label="Motion control prompt"
          disabled={submitting}
        />

        <ComposerFooter
          start={
            <>
              <AddMediaButton
                label="Video and image"
                fields={FIELDS}
                attachments={visibleAttachments}
                disabled={submitting}
                onPick={setLibraryField}
                onRemove={removeAttachment}
                onFiles={routeFiles}
              />
              {missing.length > 0 && uploadingCount === 0 && (
                <span className="hidden truncate text-xs text-muted-foreground md:inline">
                  Needs {missing.join(" and ")}
                </span>
              )}
            </>
          }
          end={
            <>
              <UploadingNote count={uploadingCount} />
              <GenerateButton
                credits={MOTION_CONTROL_CREDITS}
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
