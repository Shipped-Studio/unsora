/**
 * Sync Eleven v3 voice preview clips into the configured Supabase bucket.
 *
 * For each voice in ELEVEN_V3_VOICE_PRESETS: skip if the preview already
 * exists in storage; otherwise pull the official sample from the public
 * ElevenLabs voice list, and fall back to generating a short sample through
 * WaveSpeed eleven-v3 (~$0.10/voice) for voices missing from that list.
 *
 * Usage: npm run build && node dist/scripts/sync-voice-previews.js
 * Env: SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET, WAVESPEED_API_KEY
 */
import dotenv from "dotenv";

dotenv.config();

import { ELEVEN_V3_VOICE_PRESETS } from "../src/config/models/voice";
import {
  getSupabasePublicUrl,
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "../src/lib/supabase-storage";
import { getWavespeedClient, WavespeedAPI } from "../src/lib/wavespeed-api";

const ELEVENLABS_VOICES_URL = "https://api.elevenlabs.io/v1/voices";

async function fetchElevenLabsPreviewUrls(): Promise<Map<string, string>> {
  const byFirstName = new Map<string, string>();
  try {
    const res = await fetch(ELEVENLABS_VOICES_URL);
    if (!res.ok) return byFirstName;
    const data = (await res.json()) as {
      voices?: { name?: string; preview_url?: string }[];
    };
    for (const voice of data.voices ?? []) {
      const first = voice.name?.split(" ")[0]?.replace(/-$/, "");
      if (first && voice.preview_url && !byFirstName.has(first)) {
        byFirstName.set(first, voice.preview_url);
      }
    }
  } catch (err) {
    console.warn("Could not fetch ElevenLabs voice list:", err);
  }
  return byFirstName;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateSampleViaWavespeed(voiceId: string): Promise<Buffer> {
  const client = getWavespeedClient();
  const { model, input } = WavespeedAPI.elevenV3TtsInput({
    endpoint: "elevenlabs/eleven-v3",
    text: `Hi, I'm ${voiceId}. This is a sample of my voice — use it to decide whether I'm the right fit for your script.`,
    voiceId,
  });
  const taskId = await client.submit(model, input);
  const result = await client.poll(taskId);
  if (result.status === "failed" || !result.outputs[0]) {
    throw new Error(result.error || "WaveSpeed preview generation failed");
  }
  return download(result.outputs[0]);
}

async function main() {
  if (!isSupabaseStorageConfigured()) {
    throw new Error("Supabase storage is not configured");
  }

  const officialPreviews = await fetchElevenLabsPreviewUrls();
  let uploaded = 0;
  let skipped = 0;

  for (const voice of ELEVEN_V3_VOICE_PRESETS) {
    const publicUrl = getSupabasePublicUrl(voice.previewPath);
    if (!publicUrl) throw new Error("No public URL — storage unconfigured");

    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      skipped++;
      continue;
    }

    const official = officialPreviews.get(voice.id);
    const buffer = official
      ? await download(official)
      : await generateSampleViaWavespeed(voice.id);

    await uploadBufferToSupabase(buffer, voice.previewPath, "audio/mpeg");
    console.log(
      `Uploaded ${voice.id} (${official ? "official sample" : "generated via WaveSpeed"})`,
    );
    uploaded++;
  }

  console.log(`Done — ${uploaded} uploaded, ${skipped} already present.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
