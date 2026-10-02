"use client";

import { useState } from "react";
import { VideoJobForm } from "@/components/subtitle-remover/video-job-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const MAX_FILES = 10;

export const UPSCALE_MODELS = [
  { value: "standard", label: "Standard", description: "10 credits per video" },
  {
    value: "ultra-1080p",
    label: "Ultra 1080p",
    description: "6 to 16 credits, by length",
  },
  {
    value: "ultra-4k",
    label: "Ultra 4K",
    description: "22 to 64 credits, by length",
  },
] as const;

export type UpscaleModel = (typeof UPSCALE_MODELS)[number]["value"];

/**
 * Mirrors the server's pricing in server/src/config/models/video-upscaler.ts.
 * The server assumes 15 seconds when the length is unknown.
 */
function upscaleCredits(model: UpscaleModel, duration?: number) {
  const seconds = duration && duration > 0 ? duration : 15;
  const tier = (costs: [number, number, number]) =>
    seconds <= 5 ? costs[0] : seconds <= 10 ? costs[1] : costs[2];
  if (model === "ultra-1080p") return tier([6, 11, 16]);
  if (model === "ultra-4k") return tier([22, 43, 64]);
  return 10;
}

export function upscaleModelLabel(model?: string | null) {
  return UPSCALE_MODELS.find((m) => m.value === model)?.label ?? model ?? null;
}

export interface VideoUpscaleInput {
  videoUrl: string;
  originalName: string;
  model: UpscaleModel;
  duration?: number;
}

export function VideoUpscalerForm({
  onSubmit,
}: {
  onSubmit: (videos: VideoUpscaleInput[]) => Promise<boolean>;
}) {
  const [model, setModel] = useState<UpscaleModel>("standard");

  return (
    <VideoJobForm
      action="process-video"
      maxFiles={MAX_FILES}
      hint="MP4, WebM or MOV, up to 25 seconds each"
      submitLabel="Upscale"
      credits={(videos) =>
        videos.reduce(
          (sum, video) => sum + upscaleCredits(model, video.duration),
          0,
        )
      }
      onSubmit={(videos) =>
        onSubmit(
          videos
            .filter((video) => video.storageBlobUrl)
            .map((video) => ({
              videoUrl: video.storageBlobUrl!,
              originalName: video.name,
              model,
              duration: video.duration,
            })),
        )
      }
      settings={
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Model</h2>
          <RadioGroup
            value={model}
            onValueChange={(value) => setModel(value as UpscaleModel)}
            className="gap-2"
          >
            {UPSCALE_MODELS.map((option) => (
              <FieldLabel key={option.value} htmlFor={`upscale-${option.value}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{option.label}</FieldTitle>
                    <FieldDescription className="text-xs">
                      {option.description}
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem
                    value={option.value}
                    id={`upscale-${option.value}`}
                  />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </section>
      }
    />
  );
}
