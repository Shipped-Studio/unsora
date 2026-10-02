"use client";

import { useCallback, useRef, useState } from "react";
import { Info, Microphone, UploadSimple } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  VOICE_CLONE_RECORDING_TIPS,
  VOICE_CLONE_SAMPLE_SCRIPT,
} from "@/constant/voice-clone-script";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";
import { toast } from "sonner";

interface VoiceCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloneCreditCost: number;
  maxClones: number;
  currentCloneCount: number;
  onCreate: (params: {
    name: string;
    description?: string;
    sample_url: string;
  }) => Promise<void>;
}

export function VoiceCloneDialog({
  open,
  onOpenChange,
  cloneCreditCost,
  maxClones,
  currentCloneCount,
  onCreate,
}: VoiceCloneDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [sampleFileName, setSampleFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const atLimit = currentCloneCount >= maxClones;
  const canSubmit =
    !submitting &&
    !uploading &&
    !atLimit &&
    name.trim().length > 0 &&
    Boolean(sampleUrl);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setSampleUrl(null);
    setSampleFileName(null);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const isAudio =
      file.type.startsWith("audio/") || file.type.startsWith("video/");
    if (!isAudio) {
      toast.error("Upload an audio or video sample (MP3, WAV, M4A, etc.)");
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
      setSampleUrl(result.blobUrl);
      setSampleFileName(file.name);
      toast.success("Sample uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !sampleUrl) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        sample_url: sampleUrl,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    sampleUrl,
    onCreate,
    name,
    description,
    reset,
    onOpenChange,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clone your voice</DialogTitle>
          <DialogDescription>
            Upload 30 seconds to 2 minutes of clear speech. Powered by ElevenLabs
            Instant Voice Cloning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">Voice name</Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My voice"
              disabled={submitting || atLimit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-description">Description (optional)</Label>
            <Textarea
              id="clone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Warm, conversational tone"
              rows={2}
              disabled={submitting || atLimit}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Audio sample</Label>
              <Popover>
                <PopoverTrigger>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="View sample script for voice cloning"
                  >
                    <Info className="size-3.5" weight="fill" />
                    Sample script
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="left"
                  className="w-[min(100vw-2rem,22rem)] max-h-80 overflow-y-auto"
                >
                  <PopoverHeader>
                    <PopoverTitle>Sample script to read</PopoverTitle>
                    <PopoverDescription>
                      Read this aloud while recording for the best clone quality.
                    </PopoverDescription>
                  </PopoverHeader>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {VOICE_CLONE_RECORDING_TIPS.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-foreground">
                    {VOICE_CLONE_SAMPLE_SCRIPT}
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting || atLimit}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {uploading ? (
                <span className="text-sm">Uploading…</span>
              ) : sampleFileName ? (
                <>
                  <Microphone className="size-5 text-primary" weight="duotone" />
                  <span className="text-sm font-medium text-foreground">
                    {sampleFileName}
                  </span>
                  <span className="text-xs">Tap to replace</span>
                </>
              ) : (
                <>
                  <UploadSimple className="size-5" />
                  <span className="text-sm">Upload audio sample</span>
                  <span className="text-xs">MP3, WAV, M4A, or short video</span>
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

          {atLimit && (
            <p className="text-xs text-destructive">
              You&apos;ve reached the limit of {maxClones} cloned voices. Delete
              one to add another.
            </p>
          )}

          <GenerateButton
            disabled={!canSubmit}
            onClick={handleSubmit}
            submitting={submitting}
            credits={cloneCreditCost}
            label="Create voice clone"
            className="w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
