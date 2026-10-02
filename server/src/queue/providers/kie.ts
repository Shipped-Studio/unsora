import { getKieClient } from "../../lib/kie-api";
import type { VideoModelConfig } from "../../config/models";
import type { VideoGenerationJobData } from "../video-generation.queue";

const VEO_GENERATE_URL = "https://api.kie.ai/api/v1/veo/generate";

export function buildKiePayload(
  data: VideoGenerationJobData,
  modelDef: VideoModelConfig,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    prompt: data.prompt,
    model: modelDef.dbModel,
    aspect_ratio: data.aspectRatio === "auto" ? "Auto" : data.aspectRatio,
  };

  if (data.mode) payload.generationType = data.mode;
  if (data.imageUrls?.length) payload.imageUrls = data.imageUrls;

  return payload;
}

interface VeoCreateResponse {
  code: number;
  msg: string;
  data: { taskId: string };
}

export async function submitKie(
  modelDef: VideoModelConfig,
  data: VideoGenerationJobData,
): Promise<string> {
  const payload = buildKiePayload(data, modelDef);
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY is not configured");

  const response = await fetch(VEO_GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Veo submit failed — HTTP ${response.status}: ${errorText}`);
  }

  const body: VeoCreateResponse = await response.json();

  if (body.code !== 200) {
    throw new Error(`Veo submit failed — API code ${body.code}: ${body.msg}`);
  }

  return body.data.taskId;
}

export async function pollKie(taskId: string) {
  return getKieClient().pollVeo(taskId);
}
