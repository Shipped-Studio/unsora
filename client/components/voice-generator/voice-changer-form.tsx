"use client";

import { useState, useRef, useCallback } from "react";
import { UploadSimple, Waveform } from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import { Label } from "@/components/ui/label";
import { VoiceSelector } from "@/components/voice-generator/voice-selector";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";
import { toast } from "sonner";

export interface VoiceConversionPayload {
  voice_id: string;
  source_url: string;
}

interface VoiceChangerFormProps {
  onSubmit: (payload: VoiceConversionPayload) => Promise<void>;
  isSubmitting?: boolean;
  creditEstimate?: number;
}

export function VoiceChangerForm({
  onSubmit,
  isSubmitting = false,
  creditEstimate = 10,
}: VoiceChangerFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voiceId, setVoiceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canSubmit =
    !isSubmitting && !uploading && Boolean(sourceUrl) && voiceId.length > 0;

  const handleUpload = useCallback(async (file: File) => {
    const isAudio =
      file.type.startsWith("audio/") || file.type.startsWith("video/");
    if (!isAudio) {
      toast.error("Upload an audio or video file");
      return;
    }

    setUploading(true);
    try {
      const signed = await getSignedUploadUrl(file.name, file.type);
      if (!signed.success || !signed.uploadUrl) {
        throw new Error(signed.error || "Failed to get upload URL");
      }
      const result = await uploadToSignedUrl(file, signed);
      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed");
      }
      setSourceUrl(result.blobUrl);
      setSourceFileName(file.name);
      toast.success("Audio uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !sourceUrl) return;
    await onSubmit({ voice_id: voiceId, source_url: sourceUrl });
  }, [canSubmit, sourceUrl, voiceId, onSubmit]);

  return (
    <div className="flex w-full flex-col border-b bg-card p-4 sm:p-5 lg:h-full lg:min-h-0 lg:w-95 lg:shrink-0 lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="mb-4 flex shrink-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waveform className="size-5" weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Voice changer
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Transform any recording into one of your cloned voices with ElevenLabs
            speech-to-speech. Max 5 minutes.
          </p>
        </div>
      </div>

      <div className="mb-4 shrink-0 space-y-2">
        <Label className="text-xs">Source audio</Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isSubmitting}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          {uploading ? (
            <span className="text-sm">Uploading…</span>
          ) : sourceFileName ? (
            <>
              <UploadSimple className="size-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {sourceFileName}
              </span>
              <span className="text-xs">Tap to replace</span>
            </>
          ) : (
            <>
              <UploadSimple className="size-5" />
              <span className="text-sm">Upload audio or video</span>
              <span className="text-xs">MP3, WAV, M4A, MP4 (up to 5 min)</span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mb-4 shrink-0">
        <VoiceSelector
          value={voiceId}
          onChange={setVoiceId}
          disabled={isSubmitting}
          label="Target cloned voice"
          clonesOnly
        />
      </div>

      <GenerateButton
        disabled={!canSubmit}
        onClick={handleSubmit}
        submitting={isSubmitting}
        credits={creditEstimate}
        label="Change voice"
        className="mt-auto w-full shrink-0"
      />
    </div>
  );
}
