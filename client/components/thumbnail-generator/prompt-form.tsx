"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useSetCreditBalance } from "@/hooks/use-user-usage";
import { getThumbnailGenerationCreditCost } from "@/lib/thumb-maker-config";
import {
  Plus,
  GridFour,
  CaretDown,
  X,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { toast } from "sonner";
import { AddContextModal, type ContextItem } from "./add-context-modal";
import { TemplatesModal } from "./templates-modal";
import { TemplateStrip } from "./template-strip";
import type { ThumbnailTemplate } from "@/fake";
import { uploadFileToStorage } from "@/lib/storage-client";
import { cn } from "@/lib/utils";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { Button } from "../ui/button";
import { ShineBorder } from "../ui/shine-border";

// ─── constants ────────────────────────────────────────────────────────────────
const MAX_USER_IMAGES = 6;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
const PROMPT_MAX_CHARS = 1000;
const PROMPT_WARN_AT = 800;

// ─── types ────────────────────────────────────────────────────────────────────
interface UserImage {
  id: string;
  fileName: string;
  objectUrl: string;
  /** Set once storage returns the blob URL */
  url: string | null;
  status: "uploading" | "ready" | "error";
  progress: number;
}

export type ThumbPromptFormProps = {
  onGenerationsStarted?: (
    generations: { id: string; status: string }[],
    prompt: string,
  ) => void;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return `"${file.name}" is not an image.`;
  if (file.size > MAX_IMAGE_BYTES)
    return `"${file.name}" exceeds the 20 MB limit.`;
  return null;
}

// ─── component ────────────────────────────────────────────────────────────────
export function ThumbPromptForm({
  onGenerationsStarted,
}: ThumbPromptFormProps) {
  const { authFetch } = useAuthFetch();
  const setCreditBalance = useSetCreditBalance();

  // ── state ──────────────────────────────────────────────────────────────────
  const [userImages, setUserImages] = useState<UserImage[]>([]);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ThumbnailTemplate | null>(null);
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expression, setExpression] = useState("auto");
  const [submitting, setSubmitting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const [addContextOpen, setAddContextOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── cleanup object URLs on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      userImages.forEach((img) => URL.revokeObjectURL(img.objectUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── derived ────────────────────────────────────────────────────────────────
  const uploading = userImages.some((img) => img.status === "uploading");
  const hasReadyRefs = userImages.some(
    (img) => img.status === "ready" && !!img.url,
  );

  const canSubmit =
    (!!prompt.trim() ||
      contextItems.length > 0 ||
      !!selectedTemplate ||
      hasReadyRefs) &&
    !uploading &&
    !submitting;

  const creditCost = canSubmit ? getThumbnailGenerationCreditCost(quantity) : 0;

  // ── image upload ───────────────────────────────────────────────────────────
  const uploadImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Enforce cap
      const available = MAX_USER_IMAGES - userImages.length;
      if (available <= 0) {
        toast.error(
          `You can attach up to ${MAX_USER_IMAGES} reference images.`,
        );
        return;
      }
      const toProcess = fileArray.slice(0, available);
      if (fileArray.length > available) {
        toast.error(
          `Only ${available} more image${available === 1 ? "" : "s"} can be added (max ${MAX_USER_IMAGES}).`,
        );
      }

      // Validate each file
      const valid: File[] = [];
      for (const file of toProcess) {
        const err = validateImageFile(file);
        if (err) {
          toast.error(err);
        } else {
          valid.push(file);
        }
      }
      if (valid.length === 0) return;

      // Create pending entries
      const pending: UserImage[] = valid.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        objectUrl: URL.createObjectURL(file),
        url: null,
        status: "uploading" as const,
        progress: 0,
      }));
      setUserImages((prev) => [...prev, ...pending]);

      // Upload each in parallel
      await Promise.all(
        pending.map(async (entry, idx) => {
          const file = valid[idx];
          try {
            const result = await uploadFileToStorage(file, ({ percentage }) => {
              setUserImages((prev) =>
                prev.map((img) =>
                  img.id === entry.id ? { ...img, progress: percentage } : img,
                ),
              );
            });
            if (result.success && result.blobUrl) {
              setUserImages((prev) =>
                prev.map((img) =>
                  img.id === entry.id
                    ? {
                        ...img,
                        url: result.blobUrl!,
                        status: "ready",
                        progress: 100,
                      }
                    : img,
                ),
              );
            } else {
              setUserImages((prev) =>
                prev.map((img) =>
                  img.id === entry.id ? { ...img, status: "error" } : img,
                ),
              );
              toast.error(`Failed to upload "${file.name}".`);
            }
          } catch {
            setUserImages((prev) =>
              prev.map((img) =>
                img.id === entry.id ? { ...img, status: "error" } : img,
              ),
            );
            toast.error(`Failed to upload "${file.name}".`);
          }
        }),
      );
    },
    [userImages.length],
  );

  const removeUserImage = useCallback((id: string) => {
    setUserImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.objectUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // ── drag-and-drop ──────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggingOver(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) void uploadImages(files);
  };

  // ── paste-from-clipboard ───────────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItems = Array.from(e.clipboardData.items).filter((item) =>
      item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) void uploadImages(files);
  };

  // ── context ────────────────────────────────────────────────────────────────
  const handleAddContext = (item: ContextItem) => {
    setContextItems((prev) => [...prev, item]);
  };
  const handleRemoveContext = (id: string) => {
    setContextItems((prev) => prev.filter((c) => c.id !== id));
  };

  // ── templates (single selection) ───────────────────────────────────────────
  const handleSelectTemplate = (template: ThumbnailTemplate) => {
    setSelectedTemplate(template);
  };
  const handleRemoveTemplate = () => {
    setSelectedTemplate(null);
  };
  const handleImportAsTemplates = (items: ContextItem[]) => {
    const first = items.find((item) => item.thumbnail);
    if (!first?.thumbnail) return;
    setSelectedTemplate({
      id: `import-${Date.now()}`,
      src: first.thumbnail,
      title: first.label,
      creator: "YouTube Import",
      tags: [],
      category: "import",
    });
  };

  // ── generate ───────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (
      !prompt.trim() &&
      contextItems.length === 0 &&
      !selectedTemplate &&
      !userImages.some((img) => img.status === "ready" && img.url)
    ) {
      toast.error("Add a prompt, context, template, or reference image.");
      return;
    }
    if (uploading) {
      toast.error("Please wait for your images to finish uploading.");
      return;
    }

    const userRefUrls = userImages
      .filter((img) => img.status === "ready" && img.url)
      .map((img) => img.url!);

    const templateRefUrls = selectedTemplate ? [selectedTemplate.src] : [];
    const referenceImageUrls = [...userRefUrls, ...templateRefUrls];

    setSubmitting(true);
    try {
      const res = await authFetch("/api/thumbnails/create", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          referenceImageUrls,
          templateImageUrls: templateRefUrls,
          context: contextItems,
          channelStyle: "",
          expression,
          variations: quantity,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (typeof data?.creditsRemaining === "number") {
          setCreditBalance(data.creditsRemaining);
        }
        const msg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : `Generation failed (${res.status})`;
        toast.error(msg);
        return;
      }

      if (typeof data?.creditsRemaining === "number") {
        setCreditBalance(data.creditsRemaining);
      }

      toast.success(
        data.generations?.length > 1
          ? `${data.generations.length} thumbnail generations started!`
          : "Thumbnail generation started!",
      );
      setPrompt("");
      setUserImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.objectUrl));
        return [];
      });
      setContextItems([]);
      onGenerationsStarted?.(
        Array.isArray(data.generations) ? data.generations : [],
        prompt.trim(),
      );
    } catch {
      toast.error("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedTemplate,
    uploading,
    userImages,
    prompt,
    contextItems,
    expression,
    quantity,
    authFetch,
    onGenerationsStarted,
    setCreditBalance,
  ]);

  // Cmd/Ctrl+Enter submits
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) void handleGenerate();
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const promptLen = prompt.length;
  const showCharCount = promptLen >= PROMPT_WARN_AT;

  return (
    <>
      <div
        className={BOTTOM_PROMPT_DOCK_CLASS}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-full max-w-3xl flex flex-col gap-2 pointer-events-auto">
          {/* Reference template strip */}
          {selectedTemplate && (
            <TemplateStrip
              templates={[selectedTemplate]}
              onRemove={() => handleRemoveTemplate()}
            />
          )}

          {/* User reference images strip */}
          {userImages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {userImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative shrink-0 w-20 aspect-square overflow-hidden rounded-lg border shadow-sm bg-muted"
                >
                  {/* Preview */}
                  <Image
                    src={img.objectUrl}
                    alt={img.fileName}
                    fill
                    className={cn(
                      "object-cover transition-opacity",
                      img.status === "uploading" && "opacity-50",
                    )}
                    unoptimized
                  />

                  {/* Upload progress overlay */}
                  {img.status === "uploading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <SpinnerGap className="size-5 animate-spin text-white drop-shadow" />
                      <span className="text-[10px] font-semibold text-white drop-shadow">
                        {img.progress}%
                      </span>
                    </div>
                  )}

                  {/* Error indicator */}
                  {img.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/30">
                      <WarningCircle
                        className="size-5 text-destructive"
                        weight="fill"
                      />
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeUserImage(img.id)}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                    aria-label={`Remove ${img.fileName}`}
                  >
                    <X className="size-3" weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main prompt card */}
          <div
            className={cn(
              "rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md transition-colors",
              draggingOver && "border-primary/60 bg-primary/5",
            )}
          >
            <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />

            {/* Settings toolbar */}
            <div className="flex flex-wrap items-center px-4 pt-3 pb-1">
              <div className="flex flex-wrap items-center divide-x divide-border/60">
                <div className="pr-1">
                  <Select
                    value={expression}
                    onValueChange={(v) => v != null && setExpression(v)}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      variant="ghost"
                      className="h-8 text-xs gap-1 px-2 font-normal text-muted-foreground hover:text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto" className="text-xs">
                        Auto
                      </SelectItem>
                      <SelectItem value="neutral" className="text-xs">
                        Neutral
                      </SelectItem>
                      <SelectItem value="soft-smile" className="text-xs">
                        Soft Smile
                      </SelectItem>
                      <SelectItem value="big-smile" className="text-xs">
                        Big Smile
                      </SelectItem>
                      <SelectItem value="surprised">Surprised</SelectItem>
                      <SelectItem value="confused" className="text-xs">
                        Confused
                      </SelectItem>
                      <SelectItem value="worried" className="text-xs">
                        Worried
                      </SelectItem>
                      <SelectItem value="angry" className="text-xs">
                        Angry
                      </SelectItem>
                      <SelectItem value="sad" className="text-xs">
                        Sad
                      </SelectItem>
                      <SelectItem value="disgusted" className="text-xs">
                        Disgusted
                      </SelectItem>
                      <SelectItem value="determined" className="text-xs">
                        Determined
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="px-1">
                  <Select
                    value={String(quantity)}
                    onValueChange={(v) => v != null && setQuantity(Number(v))}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      variant="ghost"
                      className="h-8 text-xs gap-1 px-2 font-normal text-muted-foreground hover:text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="px-1">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setTemplatesOpen(true)}
                    className="h-8 text-xs gap-1 px-2 font-normal text-muted-foreground hover:text-foreground"
                  >
                    <GridFour className="size-3.5" weight="fill" />
                    Templates
                    {selectedTemplate && (
                      <span className="rounded-full bg-muted px-1 text-[10px] font-medium text-foreground">
                        1
                      </span>
                    )}
                    <CaretDown className="size-3 text-muted-foreground" />
                  </Button>
                </div>

                <div className="pl-1">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setAddContextOpen(true)}
                    className="h-8 text-xs gap-1 px-2 font-normal text-muted-foreground hover:text-foreground"
                  >
                    Add context
                    <CaretDown className="size-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Context chips */}
            {contextItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1">
                {contextItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-medium"
                  >
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt={item.label}
                        width={24}
                        height={24}
                        className="size-6 rounded object-cover"
                        unoptimized
                      />
                    ) : null}
                    <span className="max-w-20 truncate">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveContext(item.id)}
                      aria-label={`Remove context: ${item.label}`}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {draggingOver && (
              <p className="px-4 pb-1 text-xs font-medium text-primary">
                Drop image{userImages.length > 0 ? "s" : ""} here to add as
                reference
              </p>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2 px-4 pb-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void uploadImages(e.target.files);
                  e.target.value = "";
                }}
              />

              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Add reference images of yourself or your subject"
                    disabled={
                      userImages.length >= MAX_USER_IMAGES || submitting
                    }
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "size-9 shrink-0 rounded-lg bg-transparent text-muted-foreground",
                      uploading && "text-primary",
                    )}
                  >
                    {uploading ? (
                      <SpinnerGap className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {userImages.length >= MAX_USER_IMAGES
                    ? `Max ${MAX_USER_IMAGES} images`
                    : uploading
                      ? `Uploading (${userImages.filter((i) => i.status === "uploading").length} remaining)…`
                      : `Add reference image (${userImages.length}/${MAX_USER_IMAGES})`}
                </TooltipContent>
              </Tooltip>

              <div className="relative min-w-0 flex-1">
                <textarea
                  ref={textareaRef}
                  placeholder="Describe your thumbnail idea… or leave blank and let the context guide it"
                  rows={1}
                  value={prompt}
                  maxLength={PROMPT_MAX_CHARS}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={submitting}
                  aria-label="Thumbnail idea prompt"
                  className="w-full resize-none bg-transparent py-2 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
                />
                {showCharCount && (
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 text-[11px] tabular-nums",
                      promptLen >= PROMPT_MAX_CHARS
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {promptLen}/{PROMPT_MAX_CHARS}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {uploading && (
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Uploading{" "}
                    {userImages.filter((i) => i.status === "uploading").length}/
                    {userImages.length}…
                  </span>
                )}
                <GenerateButton
                  credits={creditCost > 0 ? creditCost : undefined}
                  disabled={!canSubmit}
                  submitting={submitting}
                  onClick={handleGenerate}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddContextModal
        open={addContextOpen}
        onOpenChange={setAddContextOpen}
        onAdd={handleAddContext}
      />

      <TemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={handleSelectTemplate}
        onImportContext={handleImportAsTemplates}
      />
    </>
  );
}
