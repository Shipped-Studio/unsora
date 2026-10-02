"use client";

import { useRef, useCallback } from "react";
import { ImageSquare, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { useImageManager } from "@/hooks/use-image-manager";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";
import { useState } from "react";

const MAX_FILES = 20;
const ACCEPTED_TYPES = "image/jpeg,image/jpg,image/png,image/webp";

const RESOLUTION_OPTIONS = [
  { value: "2k", label: "2K", credits: 2 },
  { value: "4k", label: "4K", credits: 3 },
  { value: "8k", label: "8K", credits: 5 },
];

const cdnLoader = ({ src }: { src: string }) => src;

export interface BulkImageSubmitItem {
  imageUrl: string;
  originalName: string;
  resolution: string;
}

interface UploadFormProps {
  onSubmit: (items: BulkImageSubmitItem[]) => void;
  isSubmitting?: boolean;
}

export function ImageUpscalerForm({ onSubmit, isSubmitting }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const { images, handleFiles, removeImage, clearAll } =
    useImageManager(MAX_FILES);
  const [resolution, setResolution] = useState("4k");

  const selectedResolution = RESOLUTION_OPTIONS.find(
    (r) => r.value === resolution,
  )!;
  const allUploaded =
    images.length > 0 && images.every((img) => img.uploadStatus === "completed");
  const hasUploading = images.some((img) => img.uploadStatus === "uploading");
  const canSubmit = allUploaded && !isSubmitting && !hasUploading;
  const totalCredits = images.length * selectedResolution.credits;

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

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const payload = images
      .filter((img) => img.blobUrl)
      .map((img) => ({
        imageUrl: img.blobUrl!,
        originalName: img.name,
        resolution,
      }));
    onSubmit(payload);
    clearAll();
  }, [canSubmit, images, resolution, onSubmit, clearAll]);

  return (
    <div className="flex w-full flex-col border-b bg-card p-4 sm:p-5 lg:w-[420px] lg:shrink-0 lg:max-h-[calc(100vh-64px)] lg:border-b-0 lg:border-r">
      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "mb-5 rounded-xl border border-dashed border-border p-6 transition-colors",
          images.length >= MAX_FILES && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <ImageSquare className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">
            Drop images here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_FILES} files &middot; JPEG, PNG, WebP &middot; Max 20 MB
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            {images.length}/{MAX_FILES} added
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 gap-1.5 rounded-full text-xs"
            onClick={() => inputRef.current?.click()}
          >
            Browse
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Image list */}
      {images.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {images.length} image{images.length !== 1 && "s"}
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          </div>

          <div className="grid max-h-[280px] grid-cols-5 gap-1.5 overflow-y-auto">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-md bg-secondary"
              >
                <Image
                  loader={cdnLoader}
                  src={img.previewUrl}
                  alt={img.name}
                  fill
                  sizes="20vw"
                  className="object-cover"
                />
                {img.uploadStatus === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-[10px] font-bold text-white">
                      {img.uploadProgress}%
                    </span>
                  </div>
                )}
                {img.uploadStatus === "pending" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Spinner className="size-3 text-white" />
                  </div>
                )}
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-2.5" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution + Submit */}
      <div className="mt-auto flex flex-col gap-3">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Output Resolution
          </label>
          <div className="grid grid-cols-3 gap-2">
            {RESOLUTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setResolution(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl border py-3 text-center transition-colors",
                  resolution === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-foreground/20",
                )}
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {opt.credits} cr. each
                </span>
              </button>
            ))}
          </div>
        </div>

        <GenerateButton
          credits={totalCredits > 0 ? totalCredits : undefined}
          disabled={!canSubmit}
          onClick={handleSubmit}
          submitting={isSubmitting}
          label={
            images.length > 1
              ? `Upscale ${images.length} Images`
              : "Upscale Image"
          }
          className="w-full"
        />
      </div>
    </div>
  );
}
