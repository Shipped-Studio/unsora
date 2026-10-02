"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  ImageSquare,
  X,
  CheckCircle,
  CloudArrowUp,
  Link as LinkIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { getSignedUploadUrl, uploadToSignedUrl } from "@/lib/storage-client";
import { DUMMY_SOURCE_IMAGE_URL } from "@/components/skin-enhancer/dummy-data";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const ACCEPTED_TYPES = "image/jpeg,image/jpg,image/png,image/webp";
const MAX_FILE_SIZE_MB = 20;

export type SkinEnhancerSubmitState = "idle" | "uploading" | "submitting";

type UploadState = "idle" | "uploading" | "ready";

interface PendingImage {
  file: File;
  previewUrl: string;
  name: string;
}

export interface SkinEnhancerPayload {
  image: string;
  sharpen: number;
  smart_grain: number;
}

interface SkinEnhancerFormProps {
  onSubmit: (payload: SkinEnhancerPayload) => Promise<void>;
  isSubmitting?: boolean;
}

const cdnLoader = ({ src }: { src: string }) => src;

export function SkinEnhancerForm({
  onSubmit,
  isSubmitting = false,
}: SkinEnhancerFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [pending, setPending] = useState<PendingImage | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState(DUMMY_SOURCE_IMAGE_URL);
  const [sharpen, setSharpen] = useState([0]);
  const [smartGrain, setSmartGrain] = useState([2]);
  const effectiveImageUrl = (uploadedUrl ?? imageUrlInput.trim()) || "";
  const canSubmit =
    effectiveImageUrl.length > 0 &&
    uploadState !== "uploading" &&
    !isSubmitting;

  const resetFile = useCallback(() => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setUploadState("idle");
    setUploadProgress(0);
    setUploadedUrl(null);
  }, [pending]);

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_FILE_SIZE_MB} MB`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPending({ file, previewUrl, name: file.name });
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadedUrl(null);
    setImageUrlInput("");

    try {
      const signed = await getSignedUploadUrl(file.name, file.type);
      if (!signed.success || !signed.uploadUrl) {
        throw new Error(signed.error || "Failed to generate upload URL");
      }

      const result = await uploadToSignedUrl(file, signed, (progress) => {
        setUploadProgress(progress.percentage);
      });

      if (!result.success || !result.blobUrl) {
        throw new Error(result.error || "Upload failed");
      }

      setUploadedUrl(result.blobUrl);
      setUploadState("ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setUploadState("idle");
      setPending(null);
      URL.revokeObjectURL(previewUrl);
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList) => {
      const file = files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image (JPEG, PNG, or WebP)");
        return;
      }
      uploadFile(file);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dropRef.current?.classList.remove("border-primary", "bg-primary/5");
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add("border-primary", "bg-primary/5");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove("border-primary", "bg-primary/5");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    let image = effectiveImageUrl;
    try {
      const u = new URL(image);
      if (u.protocol !== "https:") {
        toast.error("Image URL must use HTTPS for Freepik.");
        return;
      }
      image = u.toString();
    } catch {
      toast.error("Enter a valid HTTPS image URL.");
      return;
    }

    const payload: SkinEnhancerPayload = {
      image,
      sharpen: sharpen[0] ?? 0,
      smart_grain: smartGrain[0] ?? 2,
    };

    await onSubmit(payload);
  }, [canSubmit, effectiveImageUrl, sharpen, smartGrain, onSubmit]);

  return (
    <div className="flex w-full flex-col border-b bg-card p-4 sm:p-5 lg:h-full lg:w-95 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Source image</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Public HTTPS URL or upload — passed to Freepik Skin Enhancer
          (Creative).
        </p>
      </div>

      {pending ? (
        <div className="relative mb-4 overflow-hidden rounded-xl border bg-muted/30">
          <div className="relative aspect-square w-full overflow-hidden">
            <Image
              loader={cdnLoader}
              src={pending.previewUrl}
              alt={pending.name}
              fill
              sizes="(min-width: 1024px) 380px, 100vw"
              className="object-contain"
            />
            {uploadState === "uploading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                <Spinner className="size-6 text-white" />
                <span className="text-xs font-medium text-white">
                  Uploading… {uploadProgress}%
                </span>
                <div className="h-1 w-32 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{pending.name}</p>
              <div className="mt-0.5 flex items-center gap-1">
                {uploadState === "uploading" && (
                  <>
                    <CloudArrowUp className="size-3 text-primary" />
                    <span className="text-[10px] text-muted-foreground">
                      Uploading…
                    </span>
                  </>
                )}
                {uploadState === "ready" && (
                  <>
                    <CheckCircle
                      className="size-3 text-success"
                      weight="fill"
                    />
                    <span className="text-[10px] text-success">Ready</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={resetFile}
              className="shrink-0 rounded-md p-1 text-muted-foreground/50 transition-all hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" weight="bold" />
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="mb-4 cursor-pointer rounded-xl border border-dashed border-border p-5 transition-colors hover:border-primary/50 hover:bg-primary/5"
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <ImageSquare className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Drop portrait here</p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WebP · max {MAX_FILE_SIZE_MB} MB
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 gap-1.5 rounded-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Browse files
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <div className="mb-4 space-y-2">
        <Label
          htmlFor="skin-image-url"
          className="text-xs text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <LinkIcon className="size-3.5" />
            Or paste HTTPS image URL
          </span>
        </Label>
        <Input
          id="skin-image-url"
          type="url"
          placeholder="https://example.com/portrait.jpg"
          value={imageUrlInput}
          onChange={(e) => {
            setImageUrlInput(e.target.value);
            if (e.target.value.trim()) resetFile();
          }}
          disabled={uploadState === "uploading" || isSubmitting}
          className="text-sm"
        />
      </div>

      <div className="mb-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Sharpen</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {sharpen[0]}
            </span>
          </div>
          <Slider
            value={sharpen}
            onValueChange={(v) => {
              const arr = Array.isArray(v) ? [...v] : [v];
              setSharpen(arr);
            }}
            min={0}
            max={100}
            step={1}
            disabled={isSubmitting}
            className="h-2!"
          />
          <p className="text-[10px] text-muted-foreground/80">
            0–100 · stronger edge detail
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Smart grain</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {smartGrain[0]}
            </span>
          </div>
          <Slider
            value={smartGrain}
            onValueChange={(v) => {
              const arr = Array.isArray(v) ? [...v] : [v];
              setSmartGrain(arr);
            }}
            min={0}
            max={100}
            step={1}
            disabled={isSubmitting}
            className="h-2!"
          />
          <p className="text-[10px] text-muted-foreground/80">
            0–100 · default 2 · natural film grain
          </p>
        </div>
      </div>

      <GenerateButton
        disabled={!canSubmit}
        onClick={handleSubmit}
        submitting={isSubmitting}
        submitState={
          uploadState === "uploading"
            ? "uploading"
            : isSubmitting
              ? "submitting"
              : "idle"
        }
        label="Enhance skin"
        className="w-full mt-auto"
      />
    </div>
  );
}
