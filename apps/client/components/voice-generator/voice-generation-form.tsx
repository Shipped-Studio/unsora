"use client";

import { useId, useState } from "react";
import {
  ToolSidebarBody,
  ToolSidebarFooter,
} from "@/components/generator/tool-layout";
import { GenerateButton } from "@/components/ui/generate-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ManageVoicesButton } from "@/components/voice-generator/voice-clone-list";
import {
  VoiceSelector,
  isClonedVoiceId,
} from "@/components/voice-generator/voice-selector";
import { useVoiceClones } from "@/hooks/use-voice-clones";

const EMOTION_OPTIONS = [
  { value: "happy", label: "Happy" },
  { value: "neutral", label: "Neutral" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "surprised", label: "Surprised" },
  { value: "fearful", label: "Fearful" },
];

export interface VoiceGenerationPayload {
  text: string;
  voice_id: string;
  emotion: string;
  speed: number;
  stability?: number;
  similarity?: number;
}

function firstValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : (value as number);
}

function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label id={labelId}>{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {display}
        </span>
      </div>
      <Slider
        aria-labelledby={labelId}
        value={[value]}
        onValueChange={(next) => onChange(firstValue(next))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function VoiceGenerationForm({
  onSubmit,
}: {
  onSubmit: (payload: VoiceGenerationPayload) => Promise<void>;
}) {
  const { catalog } = useVoiceClones();
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("Friendly_Person");
  const [emotion, setEmotion] = useState("neutral");
  const [speed, setSpeed] = useState(1);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const isClone = isClonedVoiceId(voiceId, catalog.clones);
  const isElevenV3 = catalog.elevenV3.some((v) => v.id === voiceId);
  const charCount = text.trim().length;
  const credits = isClone
    ? Math.max(3, Math.ceil(charCount / 500) * 3)
    : isElevenV3
      ? Math.max(6, Math.ceil(charCount / 1000) * 6)
      : Math.max(1, Math.ceil(charCount / 1000));
  const canSubmit = !submitting && charCount > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        text: text.trim(),
        voice_id: voiceId,
        emotion,
        speed,
        ...(isElevenV3 ? { stability, similarity } : {}),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToolSidebarBody>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="voice-text">Script</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {charCount.toLocaleString()} characters
            </span>
          </div>
          <Textarea
            id="voice-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
            placeholder="What should the voice say?"
            rows={8}
            className="field-sizing-fixed min-h-40 resize-y leading-relaxed"
          />
        </div>

        <VoiceSelector
          value={voiceId}
          onChange={setVoiceId}
          disabled={submitting}
          labelAction={<ManageVoicesButton />}
        />

        {!isClone && !isElevenV3 ? (
          <div className="space-y-2">
            <Label htmlFor="voice-emotion">Emotion</Label>
            <Select
              items={EMOTION_OPTIONS}
              value={emotion}
              onValueChange={(v) => v && setEmotion(v)}
              disabled={submitting}
            >
              <SelectTrigger id="voice-emotion" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMOTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!isElevenV3 ? (
          <SliderField
            label="Speed"
            value={speed}
            display={`${speed.toFixed(1)}x`}
            min={0.5}
            max={2}
            step={0.1}
            disabled={submitting}
            onChange={setSpeed}
          />
        ) : (
          <>
            <SliderField
              label="Stability"
              value={stability}
              display={stability.toFixed(2)}
              min={0}
              max={1}
              step={0.05}
              disabled={submitting}
              hint="Higher is more consistent, lower is more expressive."
              onChange={setStability}
            />
            <SliderField
              label="Similarity"
              value={similarity}
              display={similarity.toFixed(2)}
              min={0}
              max={1}
              step={0.05}
              disabled={submitting}
              hint="How closely the output follows the original voice."
              onChange={setSimilarity}
            />
          </>
        )}
      </ToolSidebarBody>

      <ToolSidebarFooter>
        <GenerateButton
          label="Generate voiceover"
          credits={credits}
          disabled={!canSubmit}
          submitting={submitting}
          onClick={handleSubmit}
          className="w-full"
        />
      </ToolSidebarFooter>
    </>
  );
}
