"use client";

import { useCallback, useState } from "react";
import { MusicNotes } from "@phosphor-icons/react";
import { GenerateButton } from "@/components/ui/generate-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceSelector } from "@/components/voice-generator/voice-selector";
import { useVoiceClones } from "@/hooks/use-voice-clones";

const LYRICS_PLACEHOLDER = `[Verse]
In the stormy night, I wander alone
Lost in the rain, feeling like I have been thrown
Memories of you, they flash before my eyes
Hoping for a moment, just to find some bliss`;

export interface MusicGenerationPayload {
  lyrics: string;
  prompt: string;
  model: string;
  voice_id?: string;
}

interface MusicGenerationFormProps {
  onSubmit: (payload: MusicGenerationPayload) => Promise<void>;
  isSubmitting?: boolean;
}

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Mureka V9 (Auto)" },
  { value: "mureka-9", label: "Mureka V9" },
  { value: "mureka-8", label: "Mureka V8" },
  { value: "mureka-o2", label: "Mureka O2" },
  { value: "mureka-7.6", label: "Mureka V7.6" },
  { value: "mureka-7.5", label: "Mureka V7.5 (BGM)" },
];

export function MusicGenerationForm({
  onSubmit,
  isSubmitting = false,
}: MusicGenerationFormProps) {
  const { catalog } = useVoiceClones();
  const [lyrics, setLyrics] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("auto");
  const [useCloneVocal, setUseCloneVocal] = useState(false);
  const [voiceCloneId, setVoiceCloneId] = useState("");

  const isBgm = model === "mureka-7.5";
  const useClone = useCloneVocal && voiceCloneId.length > 0;
  const hasLyrics = lyrics.trim().length > 0;
  const hasPrompt = prompt.trim().length > 0;
  const charCount = lyrics.trim().length;
  const canSubmit =
    !isSubmitting &&
    (useClone
      ? hasLyrics
      : isBgm
        ? hasPrompt || hasLyrics
        : hasLyrics);

  const creditEstimate = useClone
    ? 4 +
      Math.max(1, Math.ceil(charCount / 500)) +
      2
    : isBgm
      ? 4
      : 5;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    await onSubmit({
      lyrics: lyrics.trim(),
      prompt: prompt.trim(),
      model,
      ...(useClone ? { voice_id: voiceCloneId } : {}),
    });
  }, [canSubmit, lyrics, prompt, model, useClone, voiceCloneId, onSubmit]);

  return (
    <div className="flex w-full flex-col border-b bg-card p-4 sm:p-5 lg:h-full lg:min-h-0 lg:w-95 lg:shrink-0 lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="mb-4 flex shrink-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MusicNotes className="size-5" weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Song settings
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {useClone
              ? "Instrumental BGM + your cloned voice speaking the lyrics over the beat (not AI singing)."
              : isBgm
                ? "Style prompt for instrumental BGM — lyrics optional."
                : "Lyrics required. Style prompt is optional but helps shape genre and mood."}
          </p>
        </div>
      </div>

      <div className="mb-4 shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="music-use-clone"
            checked={useCloneVocal}
            onCheckedChange={(v) => {
              const on = v === true;
              setUseCloneVocal(on);
              if (!on) setVoiceCloneId("");
            }}
            disabled={isSubmitting}
          />
          <Label htmlFor="music-use-clone" className="text-xs font-normal">
            Use my cloned voice on lyrics
          </Label>
        </div>
        {useCloneVocal && (
          <>
            <VoiceSelector
              value={voiceCloneId}
              onChange={setVoiceCloneId}
              disabled={isSubmitting}
              clonesOnly
              showCloneButton
              label="Cloned voice"
            />
            <p className="text-[10px] text-muted-foreground/80">
              Creates an instrumental track, then layers your cloned voice reading
              the lyrics aloud. For full AI singing without your clone, turn this
              off and use Mureka song mode.
            </p>
          </>
        )}
      </div>

      {!useClone && (
        <div className="mb-4 shrink-0 space-y-2">
          <Label className="text-xs">Model</Label>
          <Select value={model} onValueChange={(v) => v && setModel(v)}>
            <SelectTrigger className="w-full max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mb-4 flex min-h-0 flex-1 flex-col space-y-2">
        <Label htmlFor="music-lyrics" className="text-xs">
          Lyrics{isBgm ? " (optional)" : ""}
        </Label>
        <Textarea
          id="music-lyrics"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          disabled={isSubmitting}
          placeholder={LYRICS_PLACEHOLDER}
          rows={8}
          className="field-sizing-fixed min-h-32 max-h-48 flex-1 overflow-y-auto font-mono text-xs leading-relaxed sm:max-h-56 lg:min-h-0 lg:max-h-full md:text-sm"
        />
      </div>

      <div className="mb-4 shrink-0 space-y-2">
        <Label htmlFor="music-prompt" className="text-xs">
          Style prompt{isBgm ? "" : " (optional)"}
        </Label>
        <Input
          id="music-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isSubmitting}
          placeholder="r&b, slow, passionate, male vocal"
          className="text-sm"
        />
        <p className="text-[10px] text-muted-foreground/80">
          {isBgm
            ? "Required unless you only provide lyrics as a mood description."
            : "Optional — genre, tempo, mood, and vocal style in plain language."}
        </p>
      </div>

      <GenerateButton
        disabled={!canSubmit}
        onClick={handleSubmit}
        submitting={isSubmitting}
        credits={creditEstimate}
        label={useClone ? "Generate with my voice" : isBgm ? "Generate BGM" : "Generate song"}
        className="mt-auto w-full shrink-0"
      />
    </div>
  );
}
