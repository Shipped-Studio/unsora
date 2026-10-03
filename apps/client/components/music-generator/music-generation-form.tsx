"use client";

import { useState } from "react";
import {
  ToolSidebarBody,
  ToolSidebarFooter,
} from "@/components/generator/tool-layout";
import { GenerateButton } from "@/components/ui/generate-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VoiceSelector } from "@/components/voice-generator/voice-selector";

const LYRICS_PLACEHOLDER = `[Verse]
In the stormy night, I wander alone
Lost in the rain, feeling like I have been thrown`;

export interface MusicGenerationPayload {
  lyrics: string;
  prompt: string;
  model: string;
  voice_id?: string;
}

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Mureka V9 (auto)" },
  { value: "mureka-9", label: "Mureka V9" },
  { value: "mureka-8", label: "Mureka V8" },
  { value: "mureka-o2", label: "Mureka O2" },
  { value: "mureka-7.6", label: "Mureka V7.6" },
  { value: "mureka-7.5", label: "Mureka V7.5 (background music)" },
];

export function MusicGenerationForm({
  onSubmit,
}: {
  onSubmit: (payload: MusicGenerationPayload) => Promise<void>;
}) {
  const [lyrics, setLyrics] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("auto");
  const [useCloneVocal, setUseCloneVocal] = useState(false);
  const [voiceCloneId, setVoiceCloneId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isBgm = model === "mureka-7.5";
  const useClone = useCloneVocal && voiceCloneId.length > 0;
  const hasLyrics = lyrics.trim().length > 0;
  const hasPrompt = prompt.trim().length > 0;
  const charCount = lyrics.trim().length;
  const canSubmit =
    !submitting &&
    (useClone ? hasLyrics : isBgm ? hasPrompt || hasLyrics : hasLyrics);

  const credits = useClone
    ? 4 + Math.max(1, Math.ceil(charCount / 500)) + 2
    : isBgm
      ? 4
      : 5;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        lyrics: lyrics.trim(),
        prompt: prompt.trim(),
        model,
        ...(useClone ? { voice_id: voiceCloneId } : {}),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToolSidebarBody>
        {!useClone ? (
          <div className="space-y-2">
            <Label htmlFor="music-model">Model</Label>
            <Select
              items={MODEL_OPTIONS}
              value={model}
              onValueChange={(v) => v && setModel(v)}
            >
              <SelectTrigger id="music-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="music-lyrics">
              Lyrics
              {isBgm ? (
                <span className="font-normal text-muted-foreground">
                  Optional
                </span>
              ) : null}
            </Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {charCount.toLocaleString()} characters
            </span>
          </div>
          <Textarea
            id="music-lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            disabled={submitting}
            placeholder={LYRICS_PLACEHOLDER}
            rows={10}
            className="field-sizing-fixed min-h-40 resize-y leading-relaxed"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="music-prompt">
            Style
            {!isBgm ? (
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            ) : null}
          </Label>
          <Input
            id="music-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={submitting}
            placeholder="r&b, slow, passionate, male vocal"
          />
          <p className="text-xs text-muted-foreground">
            Genre, tempo, mood and vocal style.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="music-use-clone">Use my cloned voice</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Makes an instrumental track, then your cloned voice reads the
                lyrics over it. It speaks, it doesn&apos;t sing.
              </p>
            </div>
            <Switch
              id="music-use-clone"
              checked={useCloneVocal}
              onCheckedChange={(checked) => {
                setUseCloneVocal(checked);
                if (!checked) setVoiceCloneId("");
              }}
              disabled={submitting}
            />
          </div>
          {useCloneVocal ? (
            <VoiceSelector
              value={voiceCloneId}
              onChange={setVoiceCloneId}
              disabled={submitting}
              clonesOnly
              label="Cloned voice"
            />
          ) : null}
        </section>
      </ToolSidebarBody>

      <ToolSidebarFooter>
        <GenerateButton
          label={useClone ? "Generate with my voice" : isBgm ? "Generate music" : "Generate song"}
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
