"use client";

import { useState, useCallback } from "react";
import { GenerateButton } from "@/components/ui/generate-button";
import { ShineBorder } from "@/components/ui/shine-border";
import {
  ParamControl,
  CountSelect,
  type ParamConfig,
} from "@/components/generator/param-control";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";

// ─── Params ──────────────────────────────────────────────────────────────────

const aspectRatioParam: ParamConfig = {
  key: "aspect_ratio",
  label: "Aspect Ratio",
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

const styleParam: ParamConfig = {
  key: "style_mode",
  label: "Style",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "ugc", label: "UGC" },
    { value: "casual_daylight", label: "Casual Daylight" },
    { value: "cozy_indoor", label: "Cozy Indoor" },
    { value: "low_light_intimate", label: "Low Light Intimate" },
    { value: "raw_flash", label: "Raw Flash" },
    { value: "golden_hour", label: "Golden Hour" },
    { value: "moody_night", label: "Moody Night" },
    { value: "car_selfie", label: "Car Selfie" },
    { value: "mirror_selfie", label: "Mirror Selfie" },
    { value: "luxury_influencer", label: "Luxury Influencer" },
    { value: "cinematic", label: "Cinematic" },
    { value: "travel_content", label: "Travel Content" },
    { value: "beauty_closeup", label: "Beauty Closeup" },
    { value: "party_night_out", label: "Party Night Out" },
  ],
};

const cameraAngleParam: ParamConfig = {
  key: "camera_angle",
  label: "Camera Angle",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "pov", label: "POV" },
    { value: "portrait", label: "Portrait" },
    { value: "full-body", label: "Full Body" },
    { value: "close-up", label: "Close Up" },
    { value: "side-profile", label: "Side Profile" },
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
      const age = 18 + i;
      return { value: String(age), label: String(age) };
    }),
  ],
};

const allParams: ParamConfig[] = [
  aspectRatioParam,
  styleParam,
  cameraAngleParam,
  ageParam,
];

// ─── Component ───────────────────────────────────────────────────────────────

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
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const getParam = useCallback(
    (param: ParamConfig) => paramValues[param.key] ?? param.defaultValue,
    [paramValues],
  );

  const setParam = useCallback((key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canSubmit = !!prompt.trim() && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const isSet = (val: string) => val && val !== "auto";
    const styleMode = getParam(styleParam);
    const cameraAngle = getParam(cameraAngleParam);
    const age = getParam(ageParam);

    setSubmitting(true);
    try {
      await onSubmit({
        prompt: prompt.trim(),
        aspectRatio: getParam(aspectRatioParam),
        cameraAngle: isSet(cameraAngle) ? cameraAngle : undefined,
        styleMode: isSet(styleMode) ? styleMode : undefined,
        age: isSet(age) ? Number(age) : undefined,
        count,
      });
      setPrompt("");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, getParam, onSubmit, prompt, count]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className={BOTTOM_PROMPT_DOCK_CLASS}>
      <div className="w-full max-w-[768px] rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md pointer-events-auto">
        <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />

        {/* Settings toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-3 pt-2.5 pb-1">
          {allParams.map((param) => (
            <ParamControl
              key={param.key}
              param={param}
              value={getParam(param)}
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

        {/* Prompt */}
        <div className="px-4 pt-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the influencer you want to create..."
            rows={3}
            disabled={submitting}
            aria-label="Influencer prompt"
            className="w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50 max-h-[200px]"
          />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <div className="ml-auto flex shrink-0 items-center">
            <GenerateButton
              credits={count * 10}
              disabled={!canSubmit}
              submitting={submitting}
              onClick={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
