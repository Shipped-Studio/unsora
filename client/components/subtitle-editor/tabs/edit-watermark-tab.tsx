"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, TextAa, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { uploadFileToStorage } from "@/lib/storage-client";
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
import { failureMessage } from "@/components/subtitle-editor/format";

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface WatermarkOverlayConfig {
  enabled: boolean;
  type: "text" | "image";
  text: string;
  imageUrl: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
}

export const WATERMARK_OVERLAY_DEFAULTS: WatermarkOverlayConfig = {
  enabled: true,
  type: "text",
  text: "",
  imageUrl: "",
  fontSize: 36,
  color: "#ffffff",
  opacity: 50,
  position: "bottom-right",
};

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top" },
  { value: "top-right", label: "Top right" },
  { value: "center-left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "center-right", label: "Right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom" },
  { value: "bottom-right", label: "Bottom right" },
];

interface EditWatermarkTabProps {
  config: WatermarkOverlayConfig;
  onChange: (config: WatermarkOverlayConfig) => void;
}

export function EditWatermarkTab({ config, onChange }: EditWatermarkTabProps) {
  const textId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const update = <K extends keyof WatermarkOverlayConfig>(
    key: K,
    value: WatermarkOverlayConfig[K],
  ) => onChange({ ...config, [key]: value });

  // Upload to storage so the image survives reloads and the renderer can
  // reach it (a blob: URL does neither).
  const uploadImage = async (file: File) => {
    setIsUploading(true);
    const result = await uploadFileToStorage(file);
    setIsUploading(false);
    if (!result.success || !result.blobUrl) {
      toast.error(failureMessage("upload the image", result.error));
      return;
    }
    update("imageUrl", result.blobUrl);
  };

  return (
    <div className="space-y-8">
      <EditorSection
        title="Watermark"
        description="A handle or logo shown for the whole video."
      >
        <SwitchRow
          label="Show watermark"
          checked={config.enabled}
          onCheckedChange={(checked) => update("enabled", checked)}
        />

        <ChoiceGroup
          label="Watermark type"
          value={config.type}
          onChange={(type) => update("type", type)}
          className="grid grid-cols-2"
        >
          <ChoiceItem value="text">
            <TextAa />
            Text
          </ChoiceItem>
          <ChoiceItem value="image">
            <ImageIcon />
            Image
          </ChoiceItem>
        </ChoiceGroup>

        {config.type === "text" ? (
          <>
            <div className="space-y-2">
              <FieldCaption htmlFor={textId}>Text</FieldCaption>
              <Input
                id={textId}
                value={config.text}
                onChange={(event) => update("text", event.target.value)}
                placeholder="@yourhandle"
              />
            </div>
            <ColorField
              label="Color"
              value={config.color}
              options={OVERLAY_COLORS}
              onChange={(color) => update("color", color)}
            />
            <SliderField
              label="Font size"
              unit="px"
              value={config.fontSize}
              min={12}
              max={80}
              defaultValue={WATERMARK_OVERLAY_DEFAULTS.fontSize}
              onChange={(value) => update("fontSize", value)}
            />
          </>
        ) : (
          <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              {config.imageUrl ? (
                <img
                  src={config.imageUrl}
                  alt="Watermark"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                PNG with a transparent background works best.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? <Spinner /> : <UploadSimple />}
                  {isUploading
                    ? "Uploading…"
                    : config.imageUrl
                      ? "Replace image"
                      : "Upload image"}
                </Button>
                {config.imageUrl && !isUploading ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update("imageUrl", "")}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadImage(file);
              }}
            />
          </div>
        )}
      </EditorSection>

      <EditorSection title="Placement">
        <SliderField
          label="Opacity"
          unit="%"
          value={config.opacity}
          min={10}
          max={100}
          defaultValue={WATERMARK_OVERLAY_DEFAULTS.opacity}
          onChange={(value) => update("opacity", value)}
        />
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Position
          </span>
          <ChoiceGroup
            label="Watermark position"
            value={config.position}
            onChange={(position) => update("position", position)}
            className="grid max-w-sm grid-cols-3"
          >
            {POSITIONS.map((position) => (
              <ChoiceItem
                key={position.value}
                value={position.value}
                className="text-xs"
              >
                {position.label}
              </ChoiceItem>
            ))}
          </ChoiceGroup>
        </div>
      </EditorSection>
    </div>
  );
}
