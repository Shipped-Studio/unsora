"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Plus, Stop, UserSound } from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoiceCloneDialog } from "@/components/voice-generator/voice-clone-dialog";
import {
  useVoiceClones,
  type ElevenV3Voice,
  type VoiceClone,
  type VoicePreset,
} from "@/hooks/use-voice-clones";

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
      void audio.play().catch(() => setPlayingUrl(null));
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
  compact?: boolean;
  /** When true, only show user cloned voices (for voice changer / music vocals). */
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
  const { catalog, loading, createClone } = useVoiceClones();
  const [cloneOpen, setCloneOpen] = useState(false);
  const { playingUrl, toggle, stop } = useVoicePreview();

  const presets = catalog.presets as VoicePreset[];
  const elevenV3 = catalog.elevenV3 as ElevenV3Voice[];
  const clones = catalog.clones as VoiceClone[];
  const canClone =
    showCloneButton && catalog.elevenLabsConfigured && !loading;

  const displayPresets = clonesOnly ? [] : presets;
  const displayElevenV3 = clonesOnly ? [] : elevenV3;
  const displayClones = clones;

  const selectedVoice = useMemo(
    () => elevenV3.find((v) => v.id === value) ?? null,
    [elevenV3, value],
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

  if (clonesOnly && !loading && displayClones.length === 0) {
    return (
      <>
        <div className={compact ? "min-w-0 flex-1" : "space-y-2"}>
          {!compact && <Label className="text-xs">{label}</Label>}
          <p className="text-xs text-muted-foreground">
            Create a voice clone first to use this feature.
          </p>
          {canClone && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setCloneOpen(true)}
            >
              <Plus className="size-4" />
              Clone your voice
            </Button>
          )}
        </div>
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
      </>
    );
  }

  return (
    <>
      <div className={compact ? "flex min-w-0 flex-1 items-center gap-1.5" : "space-y-2"}>
        {!compact && <Label className="text-xs">{label}</Label>}
        <div className={compact ? "flex min-w-0 flex-1 items-center gap-1.5" : "flex gap-2"}>
          <Select
            value={value}
            onValueChange={(v) => v && handleChange(v)}
            disabled={disabled || loading}
          >
            <SelectTrigger className={compact ? "min-w-0 flex-1" : "w-full max-w-full"}>
              {compact ? (
                <UserSound className="size-3.5 shrink-0" weight="fill" />
              ) : null}
              <SelectValue placeholder={loading ? "Loading voices…" : "Select voice"} />
            </SelectTrigger>
            <SelectContent>
              {displayElevenV3.length > 0 && (
                <SelectGroup>
                  <SelectLabel>ElevenLabs voices</SelectLabel>
                  {displayElevenV3.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {opt.gender} · {opt.accent}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {displayPresets.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Built-in voices</SelectLabel>
                  {displayPresets.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {displayClones.length > 0 && (
                <SelectGroup>
                  <SelectLabel>
                    {clonesOnly ? "Cloned voices" : "Your cloned voices"}
                  </SelectLabel>
                  {displayClones.map((clone) => (
                    <SelectItem key={clone.id} value={clone.id}>
                      {clone.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {previewUrl && (
            <Button
              type="button"
              variant="outline"
              size={compact ? "icon-sm" : "icon"}
              className="shrink-0"
              disabled={disabled}
              onClick={() => toggle(previewUrl)}
              title={
                isPreviewPlaying ? "Stop preview" : "Preview this voice"
              }
            >
              {isPreviewPlaying ? (
                <Stop className="size-4" weight="fill" />
              ) : (
                <Play className="size-4" weight="fill" />
              )}
            </Button>
          )}

          {canClone && (
            <Button
              type="button"
              variant="outline"
              size={compact ? "icon-sm" : "sm"}
              className={compact ? "shrink-0" : "shrink-0"}
              disabled={disabled}
              onClick={() => setCloneOpen(true)}
              title="Clone your voice"
            >
              <Plus className="size-4" />
              {!compact && <span className="ml-1">Clone</span>}
            </Button>
          )}
        </div>
        {!compact && selectedVoice && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {selectedVoice.description}
          </p>
        )}
      </div>

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
    </>
  );
}

export { isClonedVoiceId } from "@/hooks/use-voice-clones";
