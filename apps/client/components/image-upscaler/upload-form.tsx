"use client";

import { useRef, useState } from "react";
import { UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { MEDIA_ICON_BUTTON_CLASS } from "@/components/generator/result-tile";
import {
  ToolSidebarBody,
  ToolSidebarFooter,
} from "@/components/generator/tool-layout";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { GenerateButton } from "@/components/ui/generate-button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useImageManager, type ManagedImage } from "@/hooks/use-image-manager";

const MAX_FILES = 20;
const ACCEPTED_TYPES = "image/jpeg,image/jpg,image/png,image/webp";

const RESOLUTIONS = [
  { value: "2k", label: "2K", credits: 2 },
  { value: "4k", label: "4K", credits: 3 },
  { value: "8k", label: "8K", credits: 5 },
] as const;

type Resolution = (typeof RESOLUTIONS)[number]["value"];

export interface ImageUpscaleInput {
  imageUrl: string;
  originalName: string;
  resolution: Resolution;
}

export function ImageUpscalerForm({
  onSubmit,
}: {
  /** Resolves true when every image was queued; the form is then cleared. */
  onSubmit: (items: ImageUpscaleInput[]) => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("4k");
  const { images, handleFiles, removeImage, clearAll } =
    useImageManager(MAX_FILES);

  const selected = RESOLUTIONS.find((r) => r.value === resolution)!;
  const ready = images.filter((img) => img.uploadStatus === "completed");
  const uploading = images.some(
    (img) => img.uploadStatus === "uploading" || img.uploadStatus === "pending",
  );
  const canSubmit =
    ready.length > 0 && ready.length === images.length && !submitting;
  const isFull = images.length >= MAX_FILES;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(
        ready
          .filter((img) => img.blobUrl)
          .map((img) => ({
            imageUrl: img.blobUrl!,
            originalName: img.name,
            resolution,
          })),
      );
      if (ok) clearAll();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToolSidebarBody>
        <section className="space-y-3">
          <div className="flex h-6 items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Images</h2>
            {images.length > 0 ? (
              <Button variant="ghost" size="xs" onClick={clearAll}>
                Clear all
              </Button>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isFull || submitting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length > 0) {
                void handleFiles(event.dataTransfer.files);
              }
            }}
            data-dragging={dragging || undefined}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-dragging:border-ring data-dragging:bg-muted"
          >
            <UploadSimple className="mb-1 size-5 text-muted-foreground" />
            <span className="text-sm font-medium">
              Drop images or click to browse
            </span>
            <span className="text-xs text-muted-foreground">
              JPEG, PNG or WebP, up to 20 MB each
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {images.length} of {MAX_FILES} added
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {images.length > 0 ? (
            <ul className="grid grid-cols-4 gap-2">
              {images.map((img) => (
                <QueuedImage
                  key={img.id}
                  image={img}
                  onRemove={() => removeImage(img.id)}
                />
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Output resolution</h2>
          <RadioGroup
            value={resolution}
            onValueChange={(value) => setResolution(value as Resolution)}
            className="grid-cols-3 gap-2"
          >
            {RESOLUTIONS.map((option) => (
              <FieldLabel
                key={option.value}
                htmlFor={`resolution-${option.value}`}
              >
                <Field orientation="horizontal" className="gap-2">
                  <FieldContent>
                    <FieldTitle>{option.label}</FieldTitle>
                    <FieldDescription className="text-xs tabular-nums">
                      {option.credits} credits
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem
                    value={option.value}
                    id={`resolution-${option.value}`}
                  />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </section>
      </ToolSidebarBody>

      <ToolSidebarFooter>
        <GenerateButton
          label={images.length > 1 ? `Upscale ${images.length} images` : "Upscale"}
          credits={
            images.length > 0 ? images.length * selected.credits : undefined
          }
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

function QueuedImage({
  image,
  onRemove,
}: {
  image: ManagedImage;
  onRemove: () => void;
}) {
  const failed = image.uploadStatus === "failed";
  const busy =
    image.uploadStatus === "uploading" || image.uploadStatus === "pending";

  return (
    <li
      className="relative aspect-square overflow-hidden rounded-lg bg-muted"
      title={failed ? image.uploadError : image.name}
    >
      <img
        src={image.previewUrl}
        alt={image.name}
        className="size-full object-cover"
      />

      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center bg-scrim/50 text-2xs font-medium text-media-foreground tabular-nums">
          {image.uploadStatus === "uploading" ? (
            `${image.uploadProgress}%`
          ) : (
            <Spinner className="size-3.5" />
          )}
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <WarningCircle className="size-5 text-destructive" />
          <span className="sr-only">Upload failed</span>
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn("absolute top-1 right-1", MEDIA_ICON_BUTTON_CLASS)}
        aria-label={`Remove ${image.name}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  );
}
