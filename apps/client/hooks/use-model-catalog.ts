"use client";

import { useCallback } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";
import { useDebounce } from "./use-debounce";

/**
 * Generation model catalog served by the server (`/api/catalog`). Each model's
 * fields come straight from WaveSpeed's live request schema, and prices come
 * from WaveSpeed's pricing API, so nothing about a model is hard-coded here.
 */

export type CatalogCategory = "video" | "image" | "motion-control";
export type MediaKind = "image" | "video" | "audio";

export interface CatalogFieldOption {
  value: string;
  label: string;
}

export interface CatalogField {
  key: string;
  label: string;
  type:
    | "prompt"
    | "negative_prompt"
    | "media"
    | "select"
    | "aspect"
    | "duration"
    | "toggle";
  required: boolean;
  options?: CatalogFieldOption[];
  default?: string;
  offLabel?: string;
  media?: { kind: MediaKind; max: number };
}

export interface CatalogEndpoint {
  modelId: string;
  /** Media field keys that must all have files for this endpoint to apply. */
  when?: string[];
  fields: CatalogField[];
}

export interface CatalogMode {
  key: string;
  label: string;
  endpoints: CatalogEndpoint[];
}

export interface CatalogModel {
  key: string;
  label: string;
  provider: string;
  icon: string;
  category: CatalogCategory;
  description: string;
  isNew: boolean;
  legacyDbModels: string[];
  modes: CatalogMode[];
}

export const catalogQueryKeys = {
  all: ["model-catalog"] as const,
  list: (category: CatalogCategory) =>
    [...catalogQueryKeys.all, "list", category] as const,
  quote: (body: unknown) => [...catalogQueryKeys.all, "quote", body] as const,
};

export function useModelCatalog(category: CatalogCategory) {
  const { authFetch } = useAuthFetch();
  return useQuery({
    queryKey: catalogQueryKeys.list(category),
    queryFn: async (): Promise<CatalogModel[]> => {
      const res = await authFetch(`/api/catalog?category=${category}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't load models.");
      }
      return data.models as CatalogModel[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Display label for a stored `model` value, including pre-catalog names. */
export function useCatalogLabel(category: CatalogCategory) {
  const { data } = useModelCatalog(category);
  return useCallback(
    (model?: string | null): string | null => {
      if (!model || !data) return null;
      const match = data.find(
        (m) => m.key === model || m.legacyDbModels.includes(model),
      );
      return match?.label ?? null;
    },
    [data],
  );
}

export interface CatalogRequest {
  model: string;
  mode: string;
  inputs: Record<string, unknown>;
}

export interface CatalogQuote {
  /** Null when the model can't be priced until its files are attached. */
  credits: number | null;
  /** True while required files are missing, so the price may still change. */
  estimate: boolean;
}

/**
 * Live price for one run, from the server's WaveSpeed quote. Debounced so
 * dragging a slider doesn't fire a request per step; the previous price stays
 * on screen while the next one loads.
 */
export function useCatalogQuote(request: CatalogRequest | null) {
  const { authFetch } = useAuthFetch();
  const debounced = useDebounce(request, 350);

  const query = useQuery({
    queryKey: catalogQueryKeys.quote(debounced),
    enabled: debounced !== null,
    queryFn: async (): Promise<CatalogQuote> => {
      const res = await authFetch("/api/catalog/quote", {
        method: "POST",
        body: JSON.stringify(debounced),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't get a price.");
      }
      return { credits: data.credits, estimate: data.estimate };
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: false,
  });

  const settled = JSON.stringify(request) === JSON.stringify(debounced);
  return {
    quote: query.data ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    /** True while the shown price is for older inputs. */
    pending: !settled || query.isFetching,
  };
}
