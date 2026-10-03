"use client";

import { useRef, useState } from "react";
import { UploadSimple, Waveform } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  ToolSidebarBody,
  ToolSidebarFooter,
} from "@/components/generator/tool-layout";
import { GenerateButton } from "@/components/ui/generate-button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { VoiceSelector } from "@/components/voice-generator/voice-selector";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";

export interface VoiceConversionPayload {
  voice_id: string;
  source_url: string;
}

const CREDITS = 10;

export function VoiceChangerForm({
  onSubmit,
}: {
  onSubmit: (payload: VoiceConversionPayload) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voiceId, setVoiceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !submitting && !uploading && Boolean(sourceUrl) && voiceId.length > 0;

  async function handleUpload(file: File) {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      toast.error("Choose an audio or video file, like MP3, WAV or MP4.");
      return;
    }

    setUploading(true);
    try {
      const signed = await getSignedUploadUrl(file.name, file.type);
      if (!signed.success || !signed.uploadUrl) {
        throw new Error(signed.error || "Upload failed.");
      }
      const result = await uploadToSignedUrl(file, signed);
      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed.");
      }
      setSourceUrl(result.blobUrl);
      setSourceFileName(file.name);
    } catch (err) {
      toast.error(
        `Couldn't upload ${file.name}. ${err instanceof Error ? err.message : "Try again."}`,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !sourceUrl) return;
    setSubmitting(true);
    try {
      await onSubmit({ voice_id: voiceId, source_url: sourceUrl });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToolSidebarBody>
        <div className="space-y-2">
          <Label htmlFor="voice-changer-source">Recording</Label>
          <button
            id="voice-changer-source"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || submitting}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Spinner className="text-muted-foreground" />
                <span className="text-sm">Uploading</span>
              </>
            ) : sourceFileName ? (
              <>
                <Waveform className="size-5 text-muted-foreground" />
                <span className="max-w-full truncate text-sm font-medium">
                  {sourceFileName}
                </span>
                <span className="text-xs text-muted-foreground">
                  Click to replace
                </span>
              </>
            ) : (
              <>
                <UploadSimple className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Upload audio or video
                </span>
                <span className="text-xs text-muted-foreground">
                  MP3, WAV, M4A or MP4, up to 5 minutes
                </span>
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

        <VoiceSelector
          value={voiceId}
          onChange={setVoiceId}
          disabled={submitting}
          label="New voice"
          clonesOnly
        />
      </ToolSidebarBody>

      <ToolSidebarFooter>
        <GenerateButton
          label="Change voice"
          credits={CREDITS}
          disabled={!canSubmit}
          submitting={submitting}
          submitState={uploading ? "uploading" : undefined}
          onClick={handleSubmit}
          className="w-full"
        />
      </ToolSidebarFooter>
    </>
  );
}
