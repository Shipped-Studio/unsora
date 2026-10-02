"use client";

import { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { GridFour, ImageSquare, LinkSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useSetCreditBalance } from "@/hooks/use-user-usage";
import { getThumbnailGenerationCreditCost } from "@/lib/thumb-maker-config";
import { cn } from "@/lib/utils";
import type { ThumbnailTemplate } from "@/lib/thumbmaker-types";
import {
  CountSelect,
  ParamControl,
  type ParamConfig,
} from "@/components/generator/param-control";
import { LibraryPicker } from "@/components/generator/library-picker";
import { AttachmentStrip } from "@/components/generator/attachment-strip";
import { useMediaAttachments } from "@/components/generator/use-media-attachments";
import type { UploadField } from "@/components/generator/attachments";
import {
  AddMediaButton,
  ComposerCard,
  ComposerDivider,
  ComposerDock,
  ComposerFooter,
  ComposerToolbar,
  UploadingNote,
} from "@/components/generator/prompt-composer";
import { AddContextModal, type ContextItem } from "./add-context-modal";
import { TemplatesModal } from "./templates-modal";
import { TemplateStrip } from "./template-strip";

const PROMPT_MAX_CHARS = 1000;
const PROMPT_COUNT_AT = 800;

const REFERENCE_FIELD: UploadField = {
  key: "references",
  label: "References",
  accept: "image/*",
  max: 6,
  icon: ImageSquare,
};
const UPLOAD_FIELDS = [REFERENCE_FIELD];

const expressionParam: ParamConfig = {
  key: "expression",
  label: "Expression",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "neutral", label: "Neutral" },
    { value: "soft-smile", label: "Soft smile" },
    { value: "big-smile", label: "Big smile" },
    { value: "surprised", label: "Surprised" },
    { value: "confused", label: "Confused" },
    { value: "worried", label: "Worried" },
    { value: "angry", label: "Angry" },
    { value: "sad", label: "Sad" },
    { value: "disgusted", label: "Disgusted" },
    { value: "determined", label: "Determined" },
  ],
};

export type ThumbPromptFormProps = {
  onGenerationsStarted?: (
    generations: { id: string; status: string }[],
    prompt: string,
  ) => void;
};

interface CreateResponse {
  error?: string;
  message?: string;
  creditsRemaining?: number;
  generations?: { id: string; status: string }[];
}

export function ThumbPromptForm({ onGenerationsStarted }: ThumbPromptFormProps) {
  const { authFetch } = useAuthFetch();
  const setCreditBalance = useSetCreditBalance();

  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [template, setTemplate] = useState<ThumbnailTemplate | null>(null);
  const [prompt, setPrompt] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expression, setExpression] = useState(expressionParam.defaultValue);
  const [submitting, setSubmitting] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const {
    visibleAttachments,
    libraryField,
    setLibraryField,
    addAssets,
    removeAttachment,
    clearAttachments,
    routeFiles,
    uploadingCount,
    fileCounts,
    readyUrls,
  } = useMediaAttachments(UPLOAD_FIELDS);

  const hasReadyRefs = useMemo(
    () => visibleAttachments.some((a) => a.status === "ready" && !!a.url),
    [visibleAttachments],
  );

  const hasInput =
    !!prompt.trim() || contextItems.length > 0 || !!template || hasReadyRefs;
  const canSubmit = hasInput && uploadingCount === 0 && !submitting;

  const handleGenerate = useCallback(async () => {
    if (!hasInput) {
      toast.error("Add a prompt, context, template or reference image.");
      return;
    }
    if (uploadingCount > 0) {
      toast.error("Wait for your images to finish uploading.");
      return;
    }
    if (submitting) return;

    const userRefUrls = readyUrls()[REFERENCE_FIELD.key] ?? [];
    const templateRefUrls = template ? [template.src] : [];

    setSubmitting(true);
    try {
      const res = await authFetch("/api/thumbnails/create", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          referenceImageUrls: [...userRefUrls, ...templateRefUrls],
          templateImageUrls: templateRefUrls,
          context: contextItems,
          channelStyle: "",
          expression,
          variations: quantity,
        }),
      });
      const data: CreateResponse = await res.json().catch(() => ({}));

      if (typeof data.creditsRemaining === "number") {
        setCreditBalance(data.creditsRemaining);
      }

      if (!res.ok) {
        const reason =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : `The server returned ${res.status}.`;
        toast.error(`Couldn't start the thumbnail. ${reason}`);
        return;
      }

      onGenerationsStarted?.(
        Array.isArray(data.generations) ? data.generations : [],
        prompt.trim(),
      );
      setPrompt("");
      setContextItems([]);
      clearAttachments();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    hasInput,
    uploadingCount,
    submitting,
    readyUrls,
    template,
    authFetch,
    prompt,
    contextItems,
    expression,
    quantity,
    setCreditBalance,
    onGenerationsStarted,
    clearAttachments,
  ]);

  const handleImportTemplate = (items: ContextItem[]) => {
    const first = items.find((item) => item.thumbnail);
    if (!first?.thumbnail) return;
    setTemplate({
      id: `import-${Date.now()}`,
      src: first.thumbnail,
      title: first.label,
      creator: "YouTube",
      tags: [],
      category: "import",
    });
  };

  return (
    <>
      <ComposerDock onFiles={routeFiles}>
        {(template || visibleAttachments.length > 0) && (
          <div className="flex items-end gap-2 overflow-x-auto">
            {template && (
              <TemplateStrip template={template} onRemove={() => setTemplate(null)} />
            )}
            <AttachmentStrip
              attachments={visibleAttachments}
              onRemove={removeAttachment}
            />
          </div>
        )}

        <ComposerCard>
          <ComposerToolbar>
            <ParamControl
              param={expressionParam}
              value={expression}
              disabled={submitting}
              onChange={setExpression}
            />
            <CountSelect
              value={quantity}
              noun="thumbnail"
              disabled={submitting}
              onChange={setQuantity}
            />
            <ComposerDivider />
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => setTemplatesOpen(true)}
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              <GridFour />
              {template ? "Change template" : "Template"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => setContextOpen(true)}
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              <LinkSimple />
              Context
              {contextItems.length > 0 && (
                <span className="tabular-nums">{contextItems.length}</span>
              )}
            </Button>
          </ComposerToolbar>

          {contextItems.length > 0 && (
            <ul
              aria-label="Context"
              className="flex flex-wrap items-center gap-1.5 px-3 pt-2"
            >
              {contextItems.map((item) => (
                <li
                  key={item.id}
                  className="inline-flex max-w-56 items-center gap-1.5 rounded-md bg-muted py-0.5 pr-0.5 pl-1 text-xs"
                >
                  {item.thumbnail && (
                    <Image
                      src={item.thumbnail}
                      alt=""
                      width={32}
                      height={18}
                      unoptimized
                      className="h-4.5 w-8 shrink-0 rounded-sm object-cover"
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${item.label}`}
                    onClick={() =>
                      setContextItems((prev) =>
                        prev.filter((c) => c.id !== item.id),
                      )
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (canSubmit) void handleGenerate();
                }
              }}
              placeholder="Describe the thumbnail (optional with a template or context)"
              aria-label="Thumbnail prompt"
              maxLength={PROMPT_MAX_CHARS}
              disabled={submitting}
              rows={3}
              className="field-sizing-content block max-h-52 min-h-20 w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            {prompt.length >= PROMPT_COUNT_AT && (
              <span
                className={cn(
                  "absolute right-4 bottom-1 text-xs tabular-nums",
                  prompt.length >= PROMPT_MAX_CHARS
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {prompt.length}/{PROMPT_MAX_CHARS}
              </span>
            )}
          </div>

          <ComposerFooter
            start={
              <AddMediaButton
                label="References"
                fields={UPLOAD_FIELDS}
                attachments={visibleAttachments}
                disabled={submitting}
                onPick={setLibraryField}
                onRemove={removeAttachment}
                onFiles={routeFiles}
              />
            }
            end={
              <>
                <UploadingNote count={uploadingCount} />
                <GenerateButton
                  credits={getThumbnailGenerationCreditCost(quantity)}
                  disabled={!canSubmit}
                  submitting={submitting}
                  onClick={handleGenerate}
                />
              </>
            }
          />
        </ComposerCard>

        <LibraryPicker
          field={libraryField}
          fileCounts={fileCounts}
          onSelect={addAssets}
          onClose={() => setLibraryField(null)}
        />
      </ComposerDock>

      <AddContextModal
        open={contextOpen}
        onOpenChange={setContextOpen}
        onAdd={(item) => setContextItems((prev) => [...prev, item])}
      />

      <TemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={setTemplate}
        onImportContext={handleImportTemplate}
      />
    </>
  );
}
