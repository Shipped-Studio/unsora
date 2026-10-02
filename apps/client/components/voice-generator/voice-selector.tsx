"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Play, Plus, Stop, UserSound } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceCloneDialog } from "@/components/voice-generator/voice-clone-dialog";
import { useVoiceClones } from "@/hooks/use-voice-clones";

/** Play/stop toggle for a voice's sample clip. */
function useVoicePreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingUrl(null);
  }, []);

  const toggle = useCallback(
    (url: string) => {
      if (playingUrl === url) {
        stop();
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(url);
      audio.onended = () => setPlayingUrl(null);
      audio.onerror = () => setPlayingUrl(null);
      audioRef.current = audio;
      setPlayingUrl(url);
      audio.play().catch(() => setPlayingUrl(null));
    },
    [playingUrl, stop],
  );

  useEffect(() => () => audioRef.current?.pause(), []);

  return { playingUrl, toggle, stop };
}

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  label?: string;
  showCloneButton?: boolean;
  /** Inline toolbar variant without a label, for composer docks. */
  compact?: boolean;
  /** Only list the user's cloned voices (voice changer, music vocals). */
  clonesOnly?: boolean;
}

export function VoiceSelector({
  value,
  onChange,
  disabled = false,
  label = "Voice",
  showCloneButton = true,
  compact = false,
  clonesOnly = false,
}: VoiceSelectorProps) {
  const triggerId = useId();
  const { catalog, loading, createClone } = useVoiceClones();
  const [cloneOpen, setCloneOpen] = useState(false);
  const { playingUrl, toggle, stop } = useVoicePreview();

  const { presets, elevenV3, clones } = useMemo(
    () => ({
      presets: clonesOnly ? [] : catalog.presets,
      elevenV3: clonesOnly ? [] : catalog.elevenV3,
      clones: catalog.clones,
    }),
    [catalog, clonesOnly],
  );
  const canClone = showCloneButton && catalog.elevenLabsConfigured && !loading;

  const voiceItems = useMemo(
    () => [
      ...elevenV3.map((voice) => ({ value: voice.id, label: voice.label })),
      ...presets.map((voice) => ({ value: voice.id, label: voice.label })),
      ...clones.map((clone) => ({ value: clone.id, label: clone.name })),
    ],
    [elevenV3, presets, clones],
  );

  const selectedVoice = useMemo(
    () => catalog.elevenV3.find((v) => v.id === value) ?? null,
    [catalog.elevenV3, value],
  );
  const previewUrl = selectedVoice?.previewUrl ?? null;
  const isPreviewPlaying = previewUrl !== null && playingUrl === previewUrl;

  const handleChange = useCallback(
    (voiceId: string) => {
      stop();
      onChange(voiceId);
    },
    [onChange, stop],
  );

  const cloneDialog = (
    <VoiceCloneDialog
      open={cloneOpen}
      onOpenChange={setCloneOpen}
      cloneCreditCost={catalog.cloneCreditCost}
      maxClones={catalog.maxClones}
      currentCloneCount={clones.length}
      onCreate={async (params) => {
        const clone = await createClone(params);
        onChange(clone.id);
      }}
    />
  );

  if (clonesOnly && !loading && clones.length === 0) {
    return (
      <>
        <div className={compact ? "min-w-0 flex-1" : "space-y-2"}>
          {!compact ? <p className="text-sm font-medium">{label}</p> : null}
          <p className="text-xs text-muted-foreground">
            You don&apos;t have a cloned voice yet.
          </p>
          {canClone ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCloneOpen(true)}
            >
              <Plus />
              Clone a voice
            </Button>
          ) : null}
        </div>
        {cloneDialog}
      </>
    );
  }

  return (
    <>
      <div className={compact ? "flex min-w-0 items-center gap-1.5" : "space-y-2"}>
        {!compact ? <Label htmlFor={triggerId}>{label}</Label> : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Select
            items={voiceItems}
            value={value}
            onValueChange={(v) => v && handleChange(v)}
            disabled={disabled || loading}
          >
            <SelectTrigger
              id={triggerId}
              aria-label={compact ? label : undefined}
              size={compact ? "sm" : "default"}
              className={compact ? "min-w-0 max-w-48" : "min-w-0 flex-1"}
            >
              {compact ? <UserSound className="text-muted-foreground" /> : null}
              <SelectValue
                placeholder={loading ? "Loading voices" : "Choose a voice"}
              />
            </SelectTrigger>
            <SelectContent>
              {elevenV3.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>ElevenLabs voices</SelectLabel>
                  {elevenV3.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.label}
                      <span className="text-xs text-muted-foreground">
                        {voice.gender} · {voice.accent}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {presets.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Built-in voices</SelectLabel>
                  {presets.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {clones.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Your cloned voices</SelectLabel>
                  {clones.map((clone) => (
                    <SelectItem key={clone.id} value={clone.id}>
                      {clone.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>

          {previewUrl ? (
            <Button
              type="button"
              variant="outline"
              size={compact ? "icon-sm" : "icon"}
              disabled={disabled}
              onClick={() => toggle(previewUrl)}
              aria-label={isPreviewPlaying ? "Stop preview" : "Preview voice"}
            >
              {isPreviewPlaying ? <Stop weight="fill" /> : <Play weight="fill" />}
            </Button>
          ) : null}

          {canClone ? (
            <Button
              type="button"
              variant="outline"
              size={compact ? "icon-sm" : "default"}
              disabled={disabled}
              onClick={() => setCloneOpen(true)}
              aria-label={compact ? "Clone a voice" : undefined}
            >
              <Plus />
              {compact ? null : "Clone"}
            </Button>
          ) : null}
        </div>
        {!compact && selectedVoice?.description ? (
          <p className="text-xs text-muted-foreground">
            {selectedVoice.description}
          </p>
        ) : null}
      </div>

      {cloneDialog}
    </>
  );
}

export { isClonedVoiceId } from "@/hooks/use-voice-clones";
