"use client";

import { useCallback, useState } from "react";
import { Microphone } from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
] as const;

export interface VoiceGenerationPayload {
  text: string;
  voice_id: string;
  emotion: string;
  speed: number;
  stability?: number;
  similarity?: number;
}

interface VoiceGenerationFormProps {
  onSubmit: (payload: VoiceGenerationPayload) => Promise<void>;
  isSubmitting?: boolean;
}

export function VoiceGenerationForm({
  onSubmit,
  isSubmitting = false,
}: VoiceGenerationFormProps) {
  const { catalog } = useVoiceClones();
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("Friendly_Person");
  const [emotion, setEmotion] = useState("neutral");
  const [speed, setSpeed] = useState([1]);
  const [stability, setStability] = useState([0.5]);
  const [similarity, setSimilarity] = useState([1]);

  const isClone = isClonedVoiceId(voiceId, catalog.clones);
  const isElevenV3 = catalog.elevenV3.some((v) => v.id === voiceId);
  const charCount = text.trim().length;
  const creditEstimate = isClone
    ? Math.max(3, Math.ceil(charCount / 500) * 3)
    : isElevenV3
      ? Math.max(6, Math.ceil(charCount / 1000) * 6)
      : Math.max(1, Math.ceil(charCount / 1000));
  const canSubmit = !isSubmitting && charCount > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    await onSubmit({
      text: text.trim(),
      voice_id: voiceId,
      emotion,
      speed: speed[0],
      ...(isElevenV3
        ? { stability: stability[0], similarity: similarity[0] }
        : {}),
    });
  }, [
    canSubmit,
    text,
    voiceId,
    emotion,
    speed,
    stability,
    similarity,
    isElevenV3,
    onSubmit,
  ]);

  return (
    <div className="flex w-full flex-col border-b bg-card p-4 sm:p-5 lg:h-full lg:min-h-0 lg:w-95 lg:shrink-0 lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="mb-4 flex shrink-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Microphone className="size-5" weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Voice settings
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isClone
              ? "Cloned voices use ElevenLabs. Built-in voices use MiniMax via WaveSpeed."
              : isElevenV3
                ? "ElevenLabs Eleven v3 — hit play next to the voice picker to preview it."
                : "Convert text to natural speech with built-in or cloned AI voices."}
          </p>
        </div>
      </div>

      <div className="mb-4 shrink-0">
        <VoiceSelector
          value={voiceId}
          onChange={setVoiceId}
          disabled={isSubmitting}
        />
      </div>

      {!isClone && !isElevenV3 && (
        <div className="mb-4 shrink-0 space-y-2">
          <Label className="text-xs">Emotion</Label>
          <Select
            value={emotion}
            onValueChange={(v) => v && setEmotion(v)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMOTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isElevenV3 && (
        <div className="mb-4 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Speed</Label>
            <span className="text-[10px] text-muted-foreground">
              {speed[0].toFixed(1)}×
            </span>
          </div>
          <Slider
            value={speed}
            onValueChange={(v) => setSpeed(Array.isArray(v) ? [...v] : [v])}
            min={0.5}
            max={2}
            step={0.1}
            disabled={isSubmitting}
          />
        </div>
      )}

      {isElevenV3 && (
        <>
          <div className="mb-4 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Stability</Label>
              <span className="text-[10px] text-muted-foreground">
                {stability[0].toFixed(2)}
              </span>
            </div>
            <Slider
              value={stability}
              onValueChange={(v) =>
                setStability(Array.isArray(v) ? [...v] : [v])
              }
              min={0}
              max={1}
              step={0.05}
              disabled={isSubmitting}
            />
            <p className="text-[10px] text-muted-foreground">
              Higher = more consistent delivery, lower = more expressive.
            </p>
          </div>

          <div className="mb-4 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Similarity</Label>
              <span className="text-[10px] text-muted-foreground">
                {similarity[0].toFixed(2)}
              </span>
            </div>
            <Slider
              value={similarity}
              onValueChange={(v) =>
                setSimilarity(Array.isArray(v) ? [...v] : [v])
              }
              min={0}
              max={1}
              step={0.05}
              disabled={isSubmitting}
            />
            <p className="text-[10px] text-muted-foreground">
              How closely the output sticks to the base voice.
            </p>
          </div>
        </>
      )}

      <div className="mb-4 flex min-h-0 flex-1 flex-col space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="voice-text" className="text-xs">
            Script
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {charCount.toLocaleString()} chars
          </span>
        </div>
        <Textarea
          id="voice-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSubmitting}
          placeholder="Type or paste the narration, dialogue, or voiceover you want generated…"
          rows={10}
          className="field-sizing-fixed min-h-32 max-h-48 flex-1 overflow-y-auto text-sm leading-relaxed sm:max-h-56 lg:min-h-0 lg:max-h-full"
        />
      </div>

      <GenerateButton
        disabled={!canSubmit}
        onClick={handleSubmit}
        submitting={isSubmitting}
        credits={creditEstimate}
        label="Generate voice"
        className="mt-auto w-full shrink-0"
      />
    </div>
  );
}
