"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export interface VoicePreset {
  id: string;
  label: string;
}

export interface ElevenV3Voice {
  id: string;
  label: string;
  description: string;
  gender: "male" | "female" | "neutral";
  accent: string;
  previewUrl: string | null;
}

export interface VoiceClone {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface VoiceCatalog {
  presets: VoicePreset[];
  elevenV3: ElevenV3Voice[];
  clones: VoiceClone[];
  elevenLabsConfigured: boolean;
  maxClones: number;
  cloneCreditCost: number;
}

const DEFAULT_CATALOG: VoiceCatalog = {
  presets: [],
  elevenV3: [],
  clones: [],
  elevenLabsConfigured: false,
  maxClones: 10,
  cloneCreditCost: 15,
};

export const voiceClonesQueryKey = ["voice-clones"] as const;

export function useVoiceClones() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: voiceClonesQueryKey,
    queryFn: async (): Promise<VoiceCatalog> => {
      const res = await authFetch("/api/voice-clones/all");
      if (!res.ok) throw new Error("Failed to load voices");
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load voices");
      }
      return {
        presets: data.presets ?? [],
        elevenV3: data.elevenV3Voices ?? [],
        clones: data.clones ?? [],
        elevenLabsConfigured: Boolean(data.elevenLabsConfigured),
        maxClones: data.maxClones ?? 10,
        cloneCreditCost: data.cloneCreditCost ?? 15,
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      sample_url: string;
    }) => {
      const res = await authFetch("/api/voice-clones/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create voice clone");
      }
      return data.clone as VoiceClone;
    },
    onSuccess: (clone, params) => {
      toast.success(`Voice "${params.name}" cloned successfully`);
      queryClient.setQueryData<VoiceCatalog>(voiceClonesQueryKey, (prev) => {
        const base = prev ?? DEFAULT_CATALOG;
        if (base.clones.some((c) => c.id === clone.id)) return base;
        return { ...base, clones: [clone, ...base.clones] };
      });
      void queryClient.invalidateQueries({ queryKey: voiceClonesQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (cloneId: string) => {
      const res = await authFetch(`/api/voice-clones/${cloneId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete voice clone");
      }
    },
    onSuccess: (_data, cloneId) => {
      toast.success("Voice clone deleted");
      queryClient.setQueryData<VoiceCatalog>(voiceClonesQueryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clones: prev.clones.filter((c) => c.id !== cloneId),
        };
      });
      void queryClient.invalidateQueries({ queryKey: voiceClonesQueryKey });
    },
  });

  const refresh = useCallback(() => query.refetch(), [query]);

  return {
    catalog: query.data ?? DEFAULT_CATALOG,
    loading: query.isLoading,
    refresh,
    createClone: createMutation.mutateAsync,
    deleteClone: deleteMutation.mutateAsync,
  };
}

export function isClonedVoiceId(
  voiceId: string,
  clones: VoiceClone[],
): boolean {
  return clones.some((c) => c.id === voiceId);
}
