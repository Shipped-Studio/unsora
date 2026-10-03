"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  ChoiceGroup,
  ChoiceItem,
  ColorField,
  EditorSection,
  FieldCaption,
  OVERLAY_COLORS,
  SliderField,
  SwitchRow,
} from "@/components/subtitle-editor/editor-fields";

export interface TitleOverlayConfig {
  enabled: boolean;
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  xAxis: number;
  yAxis: number;
  width: number;
}

export const TITLE_OVERLAY_DEFAULTS: TitleOverlayConfig = {
  enabled: true,
  text: "",
  fontSize: 48,
  fontWeight: 700,
  color: "#ffffff",
  xAxis: 0,
  yAxis: 0,
  width: 90,
};

const FONT_WEIGHTS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Black", value: 900 },
];

interface EditTitleTabProps {
  config: TitleOverlayConfig;
  onChange: (config: TitleOverlayConfig) => void;
}

export function EditTitleTab({ config, onChange }: EditTitleTabProps) {
  const textId = useId();
  const update = <K extends keyof TitleOverlayConfig>(
    key: K,
    value: TitleOverlayConfig[K],
  ) => onChange({ ...config, [key]: value });

  return (
    <div className="space-y-8">
      <EditorSection
        title="Title"
        description="Text shown near the top of the video for its whole length."
      >
        <SwitchRow
          label="Show title"
          checked={config.enabled}
          onCheckedChange={(checked) => update("enabled", checked)}
        />
        <div className="space-y-2">
          <FieldCaption htmlFor={textId}>Text</FieldCaption>
          <Input
            id={textId}
            value={config.text}
            onChange={(event) => update("text", event.target.value)}
            placeholder="Add a title"
          />
        </div>
        <ColorField
          label="Color"
          value={config.color}
          options={OVERLAY_COLORS}
          onChange={(color) => update("color", color)}
        />
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Weight
          </span>
          <ChoiceGroup
            label="Font weight"
            value={String(config.fontWeight)}
            onChange={(value) => update("fontWeight", Number(value))}
            className="grid grid-cols-3 sm:grid-cols-6"
          >
            {FONT_WEIGHTS.map((weight) => (
              <ChoiceItem key={weight.value} value={String(weight.value)}>
                <span style={{ fontWeight: weight.value }}>{weight.label}</span>
              </ChoiceItem>
            ))}
          </ChoiceGroup>
        </div>
      </EditorSection>

      <EditorSection title="Size and position">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <SliderField
            label="Font size"
            unit="px"
            value={config.fontSize}
            min={12}
            max={120}
            defaultValue={TITLE_OVERLAY_DEFAULTS.fontSize}
            onChange={(value) => update("fontSize", value)}
          />
          <SliderField
            label="Width"
            unit="%"
            value={config.width}
            min={10}
            max={100}
            defaultValue={TITLE_OVERLAY_DEFAULTS.width}
            onChange={(value) => update("width", value)}
          />
          <SliderField
            label="Horizontal position"
            unit="%"
            value={config.xAxis}
            min={-50}
            max={50}
            defaultValue={TITLE_OVERLAY_DEFAULTS.xAxis}
            onChange={(value) => update("xAxis", value)}
          />
          <SliderField
            label="Vertical position"
            unit="%"
            value={config.yAxis}
            min={-50}
            max={50}
            defaultValue={TITLE_OVERLAY_DEFAULTS.yAxis}
            onChange={(value) => update("yAxis", value)}
          />
        </div>
      </EditorSection>
    </div>
  );
}
