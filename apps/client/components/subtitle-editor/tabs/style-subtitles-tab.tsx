"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CaptionPlacement } from "@/components/subtitle-editor/caption-style";
import { CustomizePresetPanel } from "@/components/subtitle-editor/customize-preset-panel";
import { DeleteDialog } from "@/components/subtitle-editor/delete-dialog";
import { failureMessage } from "@/components/subtitle-editor/format";
import {
  SUBTITLE_PRESETS,
  StylePresetsGrid,
  presetStyle,
  savedToPreset,
  type SubtitleStylePreset,
} from "@/components/subtitle-editor/style-presets";
import type { PreviewStyleConfig } from "@/components/subtitle-editor/tabs/preview-style-tab";
import type { SavedSubtitlePreset } from "@/hooks/subtitle/use-subtitle-api";
import {
  useCreateSubtitlePreset,
  useDeleteSubtitlePreset,
  useSavedSubtitlePresets,
} from "@/hooks/subtitle/use-subtitle-queries";

const COPY_PREFIX = "copy-";

/** "Hormozi 4" → "Hormozi 6" when Hormozi 1 to 5 exist; "Adrian" → "Adrian 2". */
function copyName(name: string, taken: string[]): string {
  const base = name.replace(/\s+\d+$/, "");
  const numbers = taken
    .filter((n) => n === base || n.startsWith(`${base} `))
    .map((n) => Number(n.slice(base.length).trim() || 1))
    .filter(Number.isFinite);
  return `${base} ${Math.max(1, ...numbers) + 1}`;
}

interface StyleSubtitlesTabProps {
  preset: SubtitleStylePreset;
  onPresetChange: (preset: SubtitleStylePreset) => void;
  placement: CaptionPlacement;
  onPlacementChange: (placement: CaptionPlacement) => void;
  previewStyle: PreviewStyleConfig;
  onPreviewStyleChange: (config: PreviewStyleConfig) => void;
}

export function StyleSubtitlesTab({
  preset,
  onPresetChange,
  placement,
  onPlacementChange,
  previewStyle,
  onPreviewStyleChange,
}: StyleSubtitlesTabProps) {
  const [customizing, setCustomizing] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<SavedSubtitlePreset | null>(null);
  const savedQuery = useSavedSubtitlePresets();
  const createPreset = useCreateSubtitlePreset();
  const deletePreset = useDeleteSubtitlePreset();
  const savedPresets = savedQuery.data ?? [];
  const saved = savedPresets.map(savedToPreset);

  const sourceId = preset.id.startsWith(COPY_PREFIX)
    ? preset.id.slice(COPY_PREFIX.length)
    : preset.id;
  // The template as it was before customizing, for Reset.
  const original =
    SUBTITLE_PRESETS.find((p) => p.id === sourceId) ??
    saved.find((p) => p.id === sourceId) ??
    null;

  /** Editing a built-in template makes this project's own copy of it. */
  const edit = (next: SubtitleStylePreset) => {
    const isBuiltIn = SUBTITLE_PRESETS.some((p) => p.id === preset.id);
    if (!isBuiltIn) {
      onPresetChange(next);
      return;
    }
    onPresetChange({
      ...next,
      id: `${COPY_PREFIX}${preset.id}`,
      name: copyName(preset.name, [
        ...SUBTITLE_PRESETS.map((p) => p.name),
        ...saved.map((p) => p.name),
      ]),
    });
  };

  const saveAsNew = async (name: string) => {
    try {
      const created = await createPreset.mutateAsync({
        name,
        style: presetStyle(preset),
      });
      onPresetChange(savedToPreset(created));
      toast.success(`Saved "${created.name}" to your themes`);
      return true;
    } catch (error) {
      toast.error(failureMessage("save the theme", error));
      return false;
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deletePreset.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Theme deleted");
      },
      onError: (error) =>
        toast.error(failureMessage("delete the theme", error)),
    });
  };

  return (
    <div className="space-y-8">
      {customizing ? (
        <CustomizePresetPanel
          preset={preset}
          onChange={edit}
          original={original}
          onBack={() => setCustomizing(false)}
          onSaveAsNew={saveAsNew}
          placement={placement}
          onPlacementChange={onPlacementChange}
          previewStyle={previewStyle}
          onPreviewStyleChange={onPreviewStyleChange}
        />
      ) : (
        <StylePresetsGrid
          selectedPresetId={preset.id}
          projectPreset={preset.id.startsWith(COPY_PREFIX) ? preset : null}
          onSelectPreset={onPresetChange}
          savedPresets={savedPresets}
          onCustomize={() => setCustomizing(true)}
          onDeleteSaved={setPendingDelete}
        />
      )}

      <DeleteDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="The theme is removed from your themes. Projects using it keep their look."
        isDeleting={deletePreset.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
