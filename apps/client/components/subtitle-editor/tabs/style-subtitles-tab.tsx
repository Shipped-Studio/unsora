"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  EditorSection,
  SliderField,
} from "@/components/subtitle-editor/editor-fields";
import type { SavedSubtitlePreset } from "@/hooks/subtitle/use-subtitle-api";
import {
  useCreateSubtitlePreset,
  useDeleteSubtitlePreset,
  useSavedSubtitlePresets,
} from "@/hooks/subtitle/use-subtitle-queries";

export interface SizePositionValues {
  fontSize: number;
  yAxis: number;
  xAxis: number;
  width: number;
  /** Kept for saved projects; the renderer doesn't use it. */
  height: number;
}

export const SIZE_POSITION_DEFAULTS: SizePositionValues = {
  fontSize: 43,
  yAxis: 20,
  xAxis: 0,
  width: 610,
  height: 200,
};

const FIELDS: {
  key: Exclude<keyof SizePositionValues, "height">;
  label: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  { key: "fontSize", label: "Font size", unit: "px", min: 8, max: 120 },
  { key: "yAxis", label: "Vertical position", unit: "%", min: -50, max: 50 },
  { key: "xAxis", label: "Horizontal position", unit: "%", min: -50, max: 50 },
  { key: "width", label: "Line width", unit: "px", min: 100, max: 1920 },
];

interface StyleSubtitlesTabProps {
  preset: SubtitleStylePreset;
  onPresetChange: (preset: SubtitleStylePreset) => void;
  sizePosition: SizePositionValues;
  onSizePositionChange: (values: SizePositionValues) => void;
}

export function StyleSubtitlesTab({
  preset,
  onPresetChange,
  sizePosition,
  onSizePositionChange,
}: StyleSubtitlesTabProps) {
  const [customizing, setCustomizing] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<SavedSubtitlePreset | null>(null);
  const savedQuery = useSavedSubtitlePresets();
  const createPreset = useCreateSubtitlePreset();
  const deletePreset = useDeleteSubtitlePreset();
  const savedPresets = savedQuery.data ?? [];

  const isDefault = FIELDS.every(
    ({ key }) => sizePosition[key] === SIZE_POSITION_DEFAULTS[key],
  );

  // What the preset looked like before it was customized.
  const original =
    SUBTITLE_PRESETS.find((p) => p.id === preset.id) ??
    savedPresets.map(savedToPreset).find((p) => p.id === preset.id) ??
    null;

  const saveAsNew = async (name: string) => {
    try {
      const saved = await createPreset.mutateAsync({
        name,
        style: presetStyle(preset),
      });
      onPresetChange(savedToPreset(saved));
      toast.success(`Saved "${saved.name}" to your presets`);
      return true;
    } catch (error) {
      toast.error(failureMessage("save the preset", error));
      return false;
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deletePreset.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Preset deleted");
      },
      onError: (error) =>
        toast.error(failureMessage("delete the preset", error)),
    });
  };

  return (
    <div className="space-y-8">
      {customizing ? (
        <CustomizePresetPanel
          preset={preset}
          onChange={onPresetChange}
          original={original}
          onBack={() => setCustomizing(false)}
          onSaveAsNew={saveAsNew}
        />
      ) : (
        <EditorSection title="Preset">
          <StylePresetsGrid
            selectedPresetId={preset.id}
            onSelectPreset={onPresetChange}
            savedPresets={savedPresets}
            onCustomize={() => setCustomizing(true)}
            onDeleteSaved={setPendingDelete}
          />
        </EditorSection>
      )}

      <EditorSection
        title="Size and position"
        description="You can also drag the subtitles on the preview."
        actions={
          <Button
            variant="ghost"
            disabled={isDefault}
            onClick={() =>
              onSizePositionChange({
                ...SIZE_POSITION_DEFAULTS,
                height: sizePosition.height,
              })
            }
          >
            Reset
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {FIELDS.map(({ key, label, unit, min, max }) => (
            <SliderField
              key={key}
              label={label}
              unit={unit}
              value={sizePosition[key] ?? SIZE_POSITION_DEFAULTS[key]}
              min={min}
              max={max}
              defaultValue={SIZE_POSITION_DEFAULTS[key]}
              onChange={(value) =>
                onSizePositionChange({ ...sizePosition, [key]: value })
              }
            />
          ))}
        </div>
      </EditorSection>

      <DeleteDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="The preset is removed from your presets. Projects using it keep their look."
        isDeleting={deletePreset.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
