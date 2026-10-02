"use client";

import { useState, useCallback } from "react";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  ParamControl,
  CountSelect,
  type ParamConfig,
} from "@/components/generator/param-control";
import {
  ComposerCard,
  ComposerDock,
  ComposerFooter,
  ComposerPrompt,
  ComposerToolbar,
} from "@/components/generator/prompt-composer";

/**
 * Influencer photos are GPT Image 2 at 2K. Keep in sync with CREDIT_COST in
 * server/src/controllers/influencer-studio.controller.ts.
 */
export const INFLUENCER_CREDITS_PER_IMAGE = 4;

export const aspectRatioParam: ParamConfig = {
  key: "aspect_ratio",
  label: "Aspect ratio",
  type: "aspect",
  defaultValue: "9:16",
  options: [
    { value: "1:1", label: "1:1" },
    { value: "9:16", label: "9:16" },
    { value: "16:9", label: "16:9" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ],
};

export const styleParam: ParamConfig = {
  key: "style_mode",
  label: "Style",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "ugc", label: "UGC" },
    { value: "casual_daylight", label: "Casual daylight" },
    { value: "cozy_indoor", label: "Cozy indoor" },
    { value: "low_light_intimate", label: "Low light" },
    { value: "raw_flash", label: "Raw flash" },
    { value: "golden_hour", label: "Golden hour" },
    { value: "moody_night", label: "Moody night" },
    { value: "car_selfie", label: "Car selfie" },
    { value: "mirror_selfie", label: "Mirror selfie" },
    { value: "luxury_influencer", label: "Luxury" },
    { value: "cinematic", label: "Film look" },
    { value: "travel_content", label: "Travel" },
    { value: "beauty_closeup", label: "Beauty close-up" },
    { value: "party_night_out", label: "Night out" },
  ],
};

export const cameraAngleParam: ParamConfig = {
  key: "camera_angle",
  label: "Camera angle",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "pov", label: "POV" },
    { value: "portrait", label: "Portrait" },
    { value: "full-body", label: "Full body" },
    { value: "close-up", label: "Close-up" },
    { value: "side-profile", label: "Side profile" },
  ],
};

const ageParam: ParamConfig = {
  key: "age",
  label: "Age",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    ...Array.from({ length: 53 }, (_, i) => {
      const age = String(18 + i);
      return { value: age, label: age };
    }),
  ],
};

const PARAMS: ParamConfig[] = [
  aspectRatioParam,
  styleParam,
  cameraAngleParam,
  ageParam,
];

export interface InfluencerSubmitPayload {
  prompt: string;
  aspectRatio: string;
  cameraAngle?: string;
  styleMode?: string;
  age?: number;
  count: number;
}

export function InfluencerPromptForm({
  onSubmit,
}: {
  onSubmit: (payload: InfluencerSubmitPayload) => Promise<string[] | null>;
}) {
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(2);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const get = useCallback(
    (param: ParamConfig) => values[param.key] ?? param.defaultValue,
    [values],
  );

  const canSubmit = !!prompt.trim() && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const chosen = (value: string) => (value && value !== "auto" ? value : undefined);
    const age = chosen(get(ageParam));

    setSubmitting(true);
    try {
      const ids = await onSubmit({
        prompt: prompt.trim(),
        aspectRatio: get(aspectRatioParam),
        cameraAngle: chosen(get(cameraAngleParam)),
        styleMode: chosen(get(styleParam)),
        age: age ? Number(age) : undefined,
        count,
      });
      if (ids) setPrompt("");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, get, onSubmit, prompt, count]);

  return (
    <ComposerDock>
      <ComposerCard>
        <ComposerToolbar>
          {PARAMS.map((param) => (
            <ParamControl
              key={param.key}
              param={param}
              value={get(param)}
              disabled={submitting}
              onChange={(v) => setValues((prev) => ({ ...prev, [param.key]: v }))}
            />
          ))}
          <CountSelect
            value={count}
            noun="photo"
            disabled={submitting}
            onChange={setCount}
          />
        </ComposerToolbar>

        <ComposerPrompt
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void handleSubmit()}
          placeholder="Describe the person"
          label="Influencer prompt"
          disabled={submitting}
        />

        <ComposerFooter
          end={
            <GenerateButton
              credits={count * INFLUENCER_CREDITS_PER_IMAGE}
              disabled={!canSubmit}
              submitting={submitting}
              onClick={handleSubmit}
            />
          }
        />
      </ComposerCard>
    </ComposerDock>
  );
}
