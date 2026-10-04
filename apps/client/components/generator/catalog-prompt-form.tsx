"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ImageSquare,
  MusicNote,
  VideoCamera,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CountSelect,
  GHOST_TRIGGER_CLASS,
  ParamControl,
  type ParamConfig,
} from "@/components/generator/param-control";
import { ModelPicker } from "@/components/generator/model-picker";
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
  ComposerPrompt,
  ComposerToolbar,
  UploadingNote,
} from "@/components/generator/prompt-composer";
import {
  MentionEditor,
  type MentionFile,
} from "@/components/video-generator/forms/mention-editor";
import {
  useCatalogQuote,
  useModelCatalog,
  type CatalogCategory,
  type CatalogEndpoint,
  type CatalogField,
  type CatalogMode,
  type CatalogModel,
  type MediaKind,
} from "@/hooks/use-model-catalog";
import type { CatalogSubmit } from "@/hooks/use-catalog-generation";

const PROMPT_WARN_AT = 1400;
const PROMPT_STRONG_WARN_AT = 1600;

const MEDIA_ACCEPT: Record<MediaKind, UploadField["accept"]> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
};
const MEDIA_ICON: Record<MediaKind, Icon> = {
  image: ImageSquare,
  video: VideoCamera,
  audio: MusicNote,
};
const MENTION_NOUN: Record<MediaKind, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
};

const SETTING_TYPES = new Set(["select", "aspect", "duration", "toggle"]);
const MODE_PARAM_KEY = "__mode";

/** Attachments are kept per model and mode, so field keys carry both. */
const scope = (model: string, mode: string, key: string) =>
  `${model}:${mode}:${key}`;
const unscope = (key: string) => key.slice(key.lastIndexOf(":") + 1);

/** Media fields across every endpoint in the mode, so a start frame can be added before it switches the endpoint. */
function modeMediaFields(mode: CatalogMode): CatalogField[] {
  const byKey = new Map<string, CatalogField>();
  for (const ep of mode.endpoints) {
    for (const f of ep.fields) {
      if (f.type !== "media" || !f.media) continue;
      const seen = byKey.get(f.key);
      if (!seen || f.media.max > (seen.media?.max ?? 0)) byKey.set(f.key, f);
    }
  }
  return [...byKey.values()];
}

/** Mirrors the server: first endpoint whose `when` fields all have files. */
function activeEndpoint(
  mode: CatalogMode,
  counts: Record<string, number>,
): CatalogEndpoint {
  return (
    mode.endpoints.find((ep) =>
      (ep.when ?? []).every((key) => (counts[key] ?? 0) > 0),
    ) ?? mode.endpoints[mode.endpoints.length - 1]
  );
}

function toParam(field: CatalogField): ParamConfig {
  return {
    key: field.key,
    label: field.label,
    type: field.type as ParamConfig["type"],
    options: field.options ?? [],
    defaultValue: field.default ?? field.options?.[0]?.value ?? "",
    offLabel: field.offLabel,
  };
}

/** The stored value if the endpoint still offers it, else the endpoint's default. */
function effectiveValue(field: CatalogField, stored?: string): string {
  const options = field.options ?? [];
  if (stored !== undefined && options.some((o) => o.value === stored)) {
    return stored;
  }
  return field.default ?? options[0]?.value ?? "";
}

function pickerItems(models: CatalogModel[]) {
  return models.map((m) => ({
    key: m.key,
    label: m.isNew ? `${m.label} · New` : m.label,
    sublabel: m.provider,
    title: m.description,
    iconSrc: m.icon,
  }));
}

interface CatalogPromptFormProps {
  category: CatalogCategory;
  /** "video" or "image": used in labels and the count picker. */
  noun: "video" | "image";
  defaultModel: string;
  placeholder: string;
  promptLabel: string;
  /** Starts one generation; resolves to its id, or null if it didn't start. */
  onSubmit: (request: CatalogSubmit) => Promise<string | null>;
}

export function CatalogPromptForm(props: CatalogPromptFormProps) {
  const catalog = useModelCatalog(props.category);

  if (catalog.isPending) {
    return (
      <ComposerDock>
        <ComposerCard>
          <div className="space-y-3 p-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="ml-auto h-8 w-32" />
          </div>
        </ComposerCard>
      </ComposerDock>
    );
  }

  if (!catalog.data?.length) {
    return (
      <ComposerDock>
        <ComposerCard>
          <div className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="text-muted-foreground">
              {catalog.error instanceof Error
                ? catalog.error.message
                : "No models are available right now."}
            </span>
            <Button variant="outline" size="sm" onClick={() => catalog.refetch()}>
              Try again
            </Button>
          </div>
        </ComposerCard>
      </ComposerDock>
    );
  }

  return <CatalogComposer {...props} models={catalog.data} />;
}

function CatalogComposer({
  models,
  noun,
  defaultModel,
  placeholder,
  promptLabel,
  onSubmit,
}: CatalogPromptFormProps & { models: CatalogModel[] }) {
  const [modelKey, setModelKey] = useState(
    models.some((m) => m.key === defaultModel) ? defaultModel : models[0].key,
  );
  const [modeByModel, setModeByModel] = useState<Record<string, string>>({});
  // Settings are remembered per model; a key the next endpoint doesn't offer
  // falls back to that endpoint's default.
  const [valuesByModel, setValuesByModel] = useState<
    Record<string, Record<string, string>>
  >({});
  const [countByModel, setCountByModel] = useState<Record<string, number>>({});
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const model = models.find((m) => m.key === modelKey) ?? models[0];
  const mode =
    model.modes.find((m) => m.key === modeByModel[model.key]) ?? model.modes[0];
  const values = useMemo(
    () => valuesByModel[model.key] ?? {},
    [valuesByModel, model.key],
  );
  const count = countByModel[model.key] ?? 1;

  // ── Media ──
  const mediaFields = useMemo(() => modeMediaFields(mode), [mode]);
  const uploadFields: UploadField[] = useMemo(
    () =>
      mediaFields.map((f) => ({
        key: scope(model.key, mode.key, f.key),
        label: f.label,
        accept: MEDIA_ACCEPT[f.media!.kind],
        max: f.media!.max,
        icon: MEDIA_ICON[f.media!.kind],
      })),
    [mediaFields, model.key, mode.key],
  );

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
  } = useMediaAttachments(uploadFields);

  // Files per unscoped field key (uploading included), for endpoint routing.
  const mediaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of visibleAttachments) {
      if (a.status === "error") continue;
      const key = unscope(a.fieldKey);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [visibleAttachments]);

  const endpoint = activeEndpoint(mode, mediaCounts);
  const fieldByKey = useMemo(
    () => new Map(endpoint.fields.map((f) => [f.key, f])),
    [endpoint],
  );
  const settings = endpoint.fields.filter((f) => SETTING_TYPES.has(f.type));
  const promptField = fieldByKey.get("prompt");
  const supportsNegative = fieldByKey.has("negative_prompt");
  const usesMentions = mediaFields.some((f) => f.key.startsWith("reference_"));

  // ── Request ──
  // Built fresh each render, then keyed on its content so the quote's debounce
  // only restarts when something actually changed.
  const urls = readyUrls();
  const draft: Record<string, unknown> = {};
  for (const f of settings) draft[f.key] = effectiveValue(f, values[f.key]);
  if (promptField && prompt.trim()) draft.prompt = prompt.trim();
  if (supportsNegative && showNegative && negativePrompt.trim()) {
    draft.negative_prompt = negativePrompt.trim();
  }
  for (const f of mediaFields) {
    const list = urls[scope(model.key, mode.key, f.key)] ?? [];
    if (list.length) draft[f.key] = f.media!.max > 1 ? list : list[0];
  }
  const requestKey = JSON.stringify({
    model: model.key,
    mode: mode.key,
    inputs: draft,
  });
  const request = useMemo(
    () =>
      JSON.parse(requestKey) as {
        model: string;
        mode: string;
        inputs: Record<string, unknown>;
      },
    [requestKey],
  );

  // Prices never depend on the prompt text, so typing doesn't re-quote.
  const quoteKey = useMemo(() => {
    const inputs = { ...request.inputs };
    delete inputs.prompt;
    delete inputs.negative_prompt;
    return JSON.stringify({ ...request, inputs });
  }, [request]);
  const quoteRequest = useMemo(() => JSON.parse(quoteKey), [quoteKey]);
  const { quote, error: quoteError, pending: quotePending } =
    useCatalogQuote(quoteRequest);

  // ── Readiness ──
  const missingMedia = endpoint.fields
    .filter((f) => f.type === "media" && f.required && !mediaCounts[f.key])
    .map((f) => f.label.toLowerCase());
  // A file in a field this endpoint doesn't take (end frame without a start frame).
  const labelOf = (key: string) =>
    (mediaFields.find((f) => f.key === key)?.label ?? key).toLowerCase();
  const strandedFieldKeys = mediaFields
    .filter((f) => mediaCounts[f.key] && !fieldByKey.has(f.key))
    .map((f) => f.key);
  const strandedMedia = strandedFieldKeys.map(labelOf);
  const promptMissing = !!promptField?.required && !prompt.trim();

  const strandedNeeds = strandedMedia.length
    ? (mode.endpoints
        .find((ep) => ep.fields.some((f) => strandedFieldKeys.includes(f.key)))
        ?.when?.filter((k) => !mediaCounts[k]) ?? [])
    : [];
  const blockingNote = strandedMedia.length
    ? `Add a ${strandedNeeds.map(labelOf).join(" and ") || "start file"} to use the ${strandedMedia.join(" and ")}`
    : missingMedia.length
      ? `Needs ${missingMedia.join(" and ")}`
      : null;

  const credits = quote?.credits ?? null;
  const canSubmit =
    !promptMissing &&
    !missingMedia.length &&
    !strandedMedia.length &&
    uploadingCount === 0 &&
    !submitting &&
    credits !== null &&
    !quotePending &&
    !quoteError;

  const costLabel =
    credits === null
      ? quoteError
        ? "Price unavailable"
        : quote?.estimate
          ? "Add files for price"
          : "Pricing…"
      : quote?.estimate
        ? `from ${credits * count} credits`
        : undefined;

  // ── Actions ──
  const setValue = useCallback(
    (key: string, value: string) =>
      setValuesByModel((prev) => ({
        ...prev,
        [model.key]: { ...(prev[model.key] ?? {}), [key]: value },
      })),
    [model.key],
  );

  const handleGenerate = useCallback(async () => {
    if (submitting) return;
    if (uploadingCount > 0) {
      toast.error("Wait for your files to finish uploading.");
      return;
    }
    if (!canSubmit || credits === null) return;

    setSubmitting(true);
    try {
      let started = 0;
      for (let i = 0; i < count; i++) {
        const id = await onSubmit({ ...request, expectedCredits: credits });
        if (!id) break;
        started++;
      }
      if (started > 0) {
        setPrompt("");
        setNegativePrompt("");
        setShowNegative(false);
        clearAttachments(uploadFields.map((f) => f.key));
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    uploadingCount,
    canSubmit,
    credits,
    count,
    onSubmit,
    request,
    clearAttachments,
    uploadFields,
  ]);

  const submitIfReady = () => {
    if (canSubmit) void handleGenerate();
  };

  const mentionFiles: MentionFile[] = useMemo(() => {
    const perKind: Record<string, number> = {};
    return visibleAttachments
      .filter((a) => a.status !== "error")
      .map((a) => {
        const n = (perKind[a.kind] = (perKind[a.kind] ?? 0) + 1);
        return {
          id: a.id,
          label: `@${MENTION_NOUN[a.kind]} ${n}`,
          preview: a.objectUrl,
          kind: a.kind,
        };
      });
  }, [visibleAttachments]);

  const modeParam: ParamConfig | null =
    model.modes.length > 1
      ? {
          key: MODE_PARAM_KEY,
          label: "Mode",
          type: "select",
          options: model.modes.map((m) => ({ value: m.key, label: m.label })),
          defaultValue: model.modes[0].key,
          hideLabel: true,
        }
      : null;

  const promptLength = prompt.trim().length;
  const lengthNote =
    noun === "video" && promptLength > PROMPT_STRONG_WARN_AT
      ? "Very long prompts often time out. Shorten it if you can."
      : noun === "video" && promptLength > PROMPT_WARN_AT
        ? "Long prompts take longer and can time out."
        : null;

  return (
    <ComposerDock onFiles={uploadFields.length > 0 ? routeFiles : undefined}>
      <AttachmentStrip
        attachments={visibleAttachments}
        fieldLabel={(key) => uploadFields.find((f) => f.key === key)?.label ?? ""}
        onRemove={removeAttachment}
      />

      <ComposerCard>
        <ComposerToolbar>
          <ModelPicker
            label="Model"
            items={pickerItems(models)}
            activeKey={model.key}
            disabled={submitting}
            onSelect={setModelKey}
          />
          <ComposerDivider />
          {modeParam && (
            <ParamControl
              param={modeParam}
              value={mode.key}
              disabled={submitting}
              onChange={(v) =>
                setModeByModel((prev) => ({ ...prev, [model.key]: v }))
              }
            />
          )}
          {settings.map((field) => (
            <ParamControl
              key={`${model.key}-${field.key}`}
              param={toParam(field)}
              value={effectiveValue(field, values[field.key])}
              disabled={submitting}
              onChange={(v) => setValue(field.key, v)}
            />
          ))}
          <CountSelect
            value={count}
            noun={noun}
            disabled={submitting}
            onChange={(n) =>
              setCountByModel((prev) => ({ ...prev, [model.key]: n }))
            }
          />
          {supportsNegative && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              aria-pressed={showNegative}
              onClick={() => setShowNegative((v) => !v)}
              className={GHOST_TRIGGER_CLASS}
            >
              Negative prompt
            </Button>
          )}
        </ComposerToolbar>

        {promptField &&
          (usesMentions ? (
            <MentionEditor
              editorId={`${model.key}-${mode.key}-prompt-editor`}
              value={prompt}
              placeholder={`${placeholder}. Type @ to reference attached files`}
              label={promptLabel}
              disabled={submitting}
              files={mentionFiles}
              onChange={setPrompt}
              onSubmitShortcut={submitIfReady}
            />
          ) : (
            <ComposerPrompt
              value={prompt}
              onChange={setPrompt}
              onSubmit={submitIfReady}
              placeholder={
                promptField.required ? placeholder : `${placeholder} (optional)`
              }
              label={promptLabel}
              disabled={submitting}
            />
          ))}

        {supportsNegative && showNegative && (
          <div className="relative px-3 pb-2">
            <Textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder={`What to leave out of the ${noun}`}
              aria-label="Negative prompt"
              disabled={submitting}
              className="min-h-14 resize-none pr-9"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove negative prompt"
              className="absolute top-1.5 right-4.5"
              onClick={() => {
                setShowNegative(false);
                setNegativePrompt("");
              }}
            >
              <X />
            </Button>
          </div>
        )}

        {lengthNote && (
          <p
            className={cn(
              "px-4 pb-2 text-xs",
              promptLength > PROMPT_STRONG_WARN_AT
                ? "text-warning"
                : "text-muted-foreground",
            )}
          >
            <span className="tabular-nums">
              {promptLength.toLocaleString()} characters.
            </span>{" "}
            {lengthNote}
          </p>
        )}

        <ComposerFooter
          start={
            <>
              {uploadFields.length > 0 && (
                <AddMediaButton
                  fields={uploadFields}
                  attachments={visibleAttachments}
                  showArrows
                  disabled={submitting}
                  onPick={setLibraryField}
                  onRemove={removeAttachment}
                  onFiles={routeFiles}
                />
              )}
              {(blockingNote || quoteError) && uploadingCount === 0 && (
                <span
                  className={cn(
                    "truncate text-xs",
                    quoteError ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {blockingNote ?? quoteError}
                </span>
              )}
            </>
          }
          end={
            <>
              <UploadingNote count={uploadingCount} />
              <GenerateButton
                credits={credits === null ? undefined : credits * count}
                costLabel={costLabel}
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
  );
}
