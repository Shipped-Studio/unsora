"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";
import {
  PUBLIC_VIDEO_API,
  mapPublicStatusToGeneration,
} from "@/lib/public-video-api";

export type VideoGenerationStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveVideoGeneration {
  id: string;
  status: VideoGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  prompt: string;
  model: string;
  createdAt: string;
}

export interface VideoGenerationSubmitParams {
  model: string;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  aspectRatio: string;
  resolution?: string;
  sound?: boolean;
  mode?: string;
  image?: string;
  endImage?: string;
  referenceImages?: string[];
  startFrame?: string;
  endFrame?: string;
  audio?: string;
  count?: number;
  imageUrls?: string[];
  // Seedance-specific
  imageFiles?: string[];
  videoFiles?: string[];
  audioFiles?: string[];
  generateAudio?: boolean;
}

const POLL_INTERVAL_MS = 4_000;

const SEEDANCE_MODEL_MAP: Record<string, string> = {
  seedance: "seedance_2.0",
  "seedance-fast": "seedance_2.0_fast",
  "seedance-mini": "seedance_2.0_mini",
};

function buildPublicSeedancePayload(params: VideoGenerationSubmitParams) {
  const functionMode =
    params.mode === "first-last" ? "first_last_frames" : "omni_reference";

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    functionMode,
    ratio: params.aspectRatio,
    duration: params.duration ?? 5,
    generate_audio: params.generateAudio ?? false,
  };

  if (functionMode === "omni_reference") {
    if (params.imageFiles?.length) body.image_files = params.imageFiles;
    if (params.videoFiles?.length) body.video_files = params.videoFiles;
    if (params.audioFiles?.length) body.audio_files = params.audioFiles;
  } else {
    const filePaths: string[] = [];
    if (params.startFrame) filePaths.push(params.startFrame);
    if (params.endFrame) filePaths.push(params.endFrame);
    if (filePaths.length) body.filePaths = filePaths;
  }

  return body;
}

function buildSeedancePayload(params: VideoGenerationSubmitParams) {
  const functionMode =
    params.mode === "first-last" ? "first_last_frames" : "omni_reference";

  const dbModel = SEEDANCE_MODEL_MAP[params.model];
  if (!dbModel) {
    throw new Error(`Unknown Seedance model: ${params.model}`);
  }

  const body: Record<string, unknown> = {
    model: dbModel,
    prompt: params.prompt,
    functionMode,
    ratio: params.aspectRatio,
    duration: params.duration,
    resolution: "720p",
    generate_audio: params.generateAudio ?? false,
  };

  if (functionMode === "omni_reference") {
    if (params.imageFiles?.length) body.image_files = params.imageFiles;
    if (params.videoFiles?.length) body.video_files = params.videoFiles;
    if (params.audioFiles?.length) body.audio_files = params.audioFiles;
  } else {
    const filePaths: string[] = [];
    if (params.startFrame) filePaths.push(params.startFrame);
    if (params.endFrame) filePaths.push(params.endFrame);
    if (filePaths.length) body.filePaths = filePaths;
  }

  return body;
}

function buildVideoGenerationPayload(params: VideoGenerationSubmitParams) {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio,
  };

  if (params.duration) body.duration = params.duration;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.resolution) body.resolution = params.resolution;
  if (params.sound) body.sound = true;
  if (params.mode) body.mode = params.mode;
  if (params.imageUrls?.length) body.imageUrls = params.imageUrls;
  if (params.image) body.image = params.image;
  if (params.endImage) body.end_image = params.endImage;
  if (params.referenceImages?.length)
    body.reference_images = params.referenceImages;
  if (params.startFrame) body.start_frame = params.startFrame;
  if (params.endFrame) body.end_frame = params.endFrame;
  if (params.audio) body.audio = params.audio;

  return body;
}

export function useVideoGeneration() {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<
    ActiveVideoGeneration[]
  >([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  const stopPolling = useCallback((id: string) => {
    const timer = pollTimers.current.get(id);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(id);
    }
  }, []);

  const pollStatus = useCallback(
    (generationId: string, model: string) => {
      if (pollTimers.current.has(generationId)) return;

      const isSeedance20 = model === "seedance";
      const isSeedance = model in SEEDANCE_MODEL_MAP;
      const refreshPath = isSeedance20
        ? PUBLIC_VIDEO_API.status(generationId)
        : isSeedance
          ? `/api/generations/refresh/${generationId}`
          : `/api/video-generation/refresh/${generationId}`;

      const timer = setInterval(async () => {
        try {
          const res = await authFetch(refreshPath);
          if (!res.ok) return;

          const data = await res.json();

          if (isSeedance20 && data.data) {
            const mapped = mapPublicStatusToGeneration(data.data);
            setActiveGenerations((prev) =>
              prev.map((g) =>
                g.id === generationId
                  ? {
                      ...g,
                      status: mapped.status as VideoGenerationStatus,
                      error: mapped.error || undefined,
                      outputAsset: mapped.outputAsset || undefined,
                      thumbnailAsset: mapped.thumbnailAsset || undefined,
                    }
                  : g,
              ),
            );
            if (
              mapped.status === "COMPLETED" ||
              mapped.status === "FAILED"
            ) {
              stopPolling(generationId);
              if (mapped.status === "COMPLETED") {
                toast.success("Video generation complete!");
              } else {
                toast.error(
                  `Generation failed: ${mapped.error || "Unknown error"}`,
                );
              }
            }
            return;
          }

          const gen = data.generation;
          if (!gen) return;

          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId
                ? {
                    ...g,
                    status: gen.status as VideoGenerationStatus,
                    error: gen.error || undefined,
                    outputAsset: gen.outputAsset || undefined,
                    thumbnailAsset: gen.thumbnailAsset || undefined,
                  }
                : g,
            ),
          );

          if (gen.status === "COMPLETED" || gen.status === "FAILED") {
            stopPolling(generationId);
            if (gen.status === "COMPLETED") {
              toast.success("Video generation complete!");
            } else {
              toast.error(`Generation failed: ${gen.error || "Unknown error"}`);
            }
          }
        } catch {
          // network blip — keep polling
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(generationId, timer);
    },
    [authFetch, stopPolling],
  );

  const submitOne = useCallback(
    async (params: VideoGenerationSubmitParams): Promise<string | null> => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setActiveGenerations((prev) => [
        {
          id: tempId,
          status: "submitting",
          prompt: params.prompt,
          model: params.model,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      try {
        const isSeedance20 = params.model === "seedance";
        const isSeedance = params.model in SEEDANCE_MODEL_MAP;
        const endpoint = isSeedance20
          ? PUBLIC_VIDEO_API.create
          : isSeedance
            ? "/api/generations/create-video"
            : "/api/video-generation/create";
        const body = isSeedance20
          ? buildPublicSeedancePayload(params)
          : isSeedance
            ? buildSeedancePayload(params)
            : buildVideoGenerationPayload(params);

        const res = await authFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || "Failed to start generation";
          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === tempId
                ? { ...g, status: "FAILED" as const, error: errorMsg }
                : g,
            ),
          );
          toast.error(errorMsg);
          return null;
        }

        const realId = data.generation.id;
        setActiveGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? {
                  ...g,
                  id: realId,
                  status: data.generation.status as VideoGenerationStatus,
                }
              : g,
          ),
        );

        pollStatus(realId, params.model);
        return realId;
      } catch {
        setActiveGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? { ...g, status: "FAILED" as const, error: "Network error" }
              : g,
          ),
        );
        toast.error("Network error — please try again");
        return null;
      }
    },
    [authFetch, pollStatus],
  );

  const submit = useCallback(
    async (params: VideoGenerationSubmitParams) => {
      const count = params.count ?? 1;
      if (count <= 1) return submitOne(params);

      const results = await Promise.all(
        Array.from({ length: count }, () => submitOne(params)),
      );
      return results.find((id) => id !== null) ?? null;
    },
    [submitOne],
  );

  const dismiss = useCallback(
    (id: string) => {
      stopPolling(id);
      setActiveGenerations((prev) => prev.filter((g) => g.id !== id));
    },
    [stopPolling],
  );

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  return { activeGenerations, submit, dismiss };
}
