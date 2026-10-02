import fs from "fs";
import path from "path";
import { Input, BufferSource, ALL_FORMATS } from "mediabunny";
import { downloadFromStorageUrl } from "./supabase-storage";

const TEMP_DIR = path.join(process.cwd(), "temp");

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

export async function downloadAudioToTemp(
  url: string,
  fileName: string,
): Promise<string> {
  ensureTempDir();
  const filePath = path.join(TEMP_DIR, fileName);

  const buffer = await downloadFromStorageUrl(url);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Probe an audio file's duration with mediabunny (pure JS — safe to call from
 * the Express API, which has no ffmpeg; format detected by content, not name).
 */
export async function getAudioDurationSeconds(
  filePath: string,
): Promise<number> {
  // BufferSource, not FilePathSource: mediabunny's CommonJS bundle ships with
  // its Node fs shim disabled, so FilePathSource throws outside ESM/bundlers.
  const buffer = fs.readFileSync(filePath);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BufferSource(buffer),
  });
  try {
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}

/**
 * Mix a vocal track over an instrumental with ffmpeg. Trigger.dev workers
 * ONLY — the `ffmpeg()` build extension provides the binary there; the
 * Express API host has no ffmpeg and must never call this.
 */
export function mixAudioTracks(
  instrumentalPath: string,
  vocalPath: string,
  outputPath: string,
): Promise<void> {
  // Lazy require keeps fluent-ffmpeg out of the Express process entirely —
  // controllers import this module for the credit helpers above.
  const { ffmpeg } =
    require("./ffmpeg-config") as typeof import("./ffmpeg-config");
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(instrumentalPath)
      .input(vocalPath)
      .complexFilter([
        // Duck BGM — Mureka tracks are mastered loud; vocals need headroom.
        "[0:a]volume=0.32[inst]",
        // Normalize + compress + boost the spoken vocal so it sits on top of the beat.
        "[1:a]highpass=f=90,acompressor=threshold=-20dB:ratio=4:attack=5:release=80:makeup=4,volume=2.8[voc]",
        "[inst][voc]amix=inputs=2:duration=first:dropout_transition=3:normalize=0[aout]",
      ])
      .outputOptions(["-map", "[aout]"])
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .save(outputPath)
      .on("end", () => resolve())
      .on("error", reject);
  });
}

export function cleanupTempFiles(...paths: string[]) {
  for (const filePath of paths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

/** Credits for voice conversion — ~10 credits per started minute. */
export function voiceConversionCredits(durationSeconds: number): number {
  const minutes = Math.max(durationSeconds / 60, 1 / 60);
  return Math.max(1, Math.ceil(minutes * 10));
}

/** Extra credits for mixing cloned vocals onto BGM. */
export const MUSIC_VOICE_CLONE_MIX_CREDITS = 2;
