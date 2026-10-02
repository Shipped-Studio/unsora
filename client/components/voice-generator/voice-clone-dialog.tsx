"use client";

import { useRef, useState } from "react";
import { Info, Microphone, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GenerateButton } from "@/components/ui/generate-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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

  function reset() {
    setName("");
    setDescription("");
    setSampleUrl(null);
    setSampleFileName(null);
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      toast.error("Choose an audio or video file, like MP3, WAV or M4A.");
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
      setSampleUrl(result.blobUrl);
      setSampleFileName(file.name);
    } catch (err) {
      toast.error(
        `Couldn't upload the sample. ${err instanceof Error ? err.message : "Try again."}`,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
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
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't clone the voice. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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
          <DialogTitle>Clone a voice</DialogTitle>
          <DialogDescription>
            Upload 30 seconds to 2 minutes of clear speech from one speaker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">Name</Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My voice"
              disabled={submitting || atLimit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-description">
              Description
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            </Label>
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
              <Label htmlFor="clone-sample">Sample</Label>
              <Popover>
                <PopoverTrigger
                  render={<Button type="button" variant="ghost" size="xs" />}
                >
                  <Info />
                  What to read
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="max-h-80 w-[min(100vw-2rem,22rem)] overflow-y-auto"
                >
                  <PopoverHeader>
                    <PopoverTitle>Script to read</PopoverTitle>
                    <PopoverDescription>
                      Read this aloud in a quiet room.
                    </PopoverDescription>
                  </PopoverHeader>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {VOICE_CLONE_RECORDING_TIPS.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                  <p className="rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {VOICE_CLONE_SAMPLE_SCRIPT}
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <button
              id="clone-sample"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting || atLimit}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Spinner className="text-muted-foreground" />
                  <span className="text-sm">Uploading</span>
                </>
              ) : sampleFileName ? (
                <>
                  <Microphone className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{sampleFileName}</span>
                  <span className="text-xs text-muted-foreground">
                    Click to replace
                  </span>
                </>
              ) : (
                <>
                  <UploadSimple className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Upload a sample</span>
                  <span className="text-xs text-muted-foreground">
                    MP3, WAV, M4A or a short video
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

          {atLimit ? (
            <p className="text-xs text-destructive">
              You have {maxClones} cloned voices, the maximum. Delete one to add
              another.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <GenerateButton
            label="Clone voice"
            credits={cloneCreditCost}
            disabled={!canSubmit}
            submitting={submitting}
            submitState={uploading ? "uploading" : undefined}
            onClick={handleSubmit}
            className="w-full sm:w-auto"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
