"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { ImageUpscalerForm, type BulkImageSubmitItem } from "@/components/image-upscaler/upload-form";
import {
  UpscaleCard,
  type UpscaleCardData,
} from "@/components/image-upscaler/upscale-card";
import {
  UpscaleDetailDialog,
  type UpscaleDetailData,
} from "@/components/image-upscaler/upscale-detail-dialog";
import { useImageUpscaler } from "@/hooks/use-image-upscaler";
import {
  useImageUpscales,
  useDeleteImageUpscale,
  type ImageUpscaleRecord,
} from "@/hooks/use-image-upscales-query";
import { ArrowsClockwise, ImageSquare } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { imageUpscaleQueryKeys } from "@/hooks/use-image-upscales-query";

const HISTORY_LIMIT = 12;

function toCardData(record: ImageUpscaleRecord): UpscaleCardData {
  return {
    id: record.id,
    status: record.status,
    originalName: record.originalName,
    inputUrl: record.inputAsset?.url ?? null,
    outputUrl: record.outputAsset?.url ?? null,
    error: record.error,
  };
}

function toDetailData(record: ImageUpscaleRecord): UpscaleDetailData {
  return {
    id: record.id,
    status: record.status,
    originalName: record.originalName,
    inputUrl: record.inputAsset?.url ?? null,
    outputUrl: record.outputAsset?.url ?? null,
    error: record.error,
    createdAt: record.createdAt,
  };
}

export default function ImageUpscalerPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [historyItems, setHistoryItems] = useState<ImageUpscaleRecord[]>([]);
  const hasMoreRef = useRef(false);
  const fetchingRef = useRef(false);

  // In-memory active jobs from the upscaler hook
  const {
    jobs: activeJobs,
    addJob,
    updateJob,
    submitUpscale,
    dismissJob,
  } = useImageUpscaler();

  // Paginated history
  const {
    data: historyData,
    isLoading: historyLoading,
    refetch,
  } = useImageUpscales(page, HISTORY_LIMIT);

  const { mutate: deleteJob } = useDeleteImageUpscale();

  // Sync paginated data into local state (append on page > 1)
  useEffect(() => {
    if (!historyData) return;
    const incoming = historyData.jobs ?? [];
    setHistoryItems((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
    hasMoreRef.current = historyData.pagination?.hasNextPage ?? false;
  }, [historyData, page]);

  // Filter out history items that are already tracked in activeJobs
  const activeJobIds = new Set(activeJobs.map((j) => j.id));
  const filteredHistory = historyItems.filter((h) => !activeJobIds.has(h.id));

  // Selected job for detail dialog
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Resolve selected job from both sources
  const selectedActive = activeJobs.find((j) => j.id === selectedId);
  const selectedHistory = filteredHistory.find((h) => h.id === selectedId);

  const selectedDetail: UpscaleDetailData | null = selectedActive
    ? {
        id: selectedActive.id,
        status: selectedActive.status,
        originalName: selectedActive.originalName,
        inputUrl: selectedActive.inputAsset?.url ?? null,
        outputUrl: selectedActive.outputAsset?.url ?? null,
        error: selectedActive.error,
        createdAt: selectedActive.createdAt,
      }
    : selectedHistory
      ? toDetailData(selectedHistory)
      : null;

  const handleSubmit = useCallback(
    async (items: BulkImageSubmitItem[]) => {
      for (const item of items) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        addJob({
          id: tempId,
          status: "submitting",
          originalName: item.originalName,
          inputAsset: { id: "", url: item.imageUrl },
          outputAsset: null,
          thumbnailAsset: null,
          createdAt: new Date().toISOString(),
        });

        const realId = await submitUpscale(
          item.imageUrl,
          item.originalName,
          tempId,
          item.resolution,
        );

        if (realId) {
          queryClient.invalidateQueries({
            queryKey: imageUpscaleQueryKeys.lists(),
          });
        }
      }
    },
    [addJob, submitUpscale, queryClient],
  );

  const handleDelete = useCallback(
    (jobId: string) => {
      dismissJob(jobId);
      setHistoryItems((prev) => prev.filter((h) => h.id !== jobId));
      deleteJob(jobId);
      if (selectedId === jobId) setSelectedId(null);
    },
    [dismissJob, deleteJob, selectedId],
  );

  const handleRefresh = useCallback(() => {
    setPage(1);
    queryClient.invalidateQueries({
      queryKey: imageUpscaleQueryKeys.lists(),
    });
  }, [queryClient]);

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMoreRef.current) return;
    fetchingRef.current = true;
    setPage((p) => p + 1);
    fetchingRef.current = false;
  }, []);

  const { ref: sentinelRef } = useInView({
    rootMargin: "200px",
    skip: historyLoading || !hasMoreRef.current,
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const allItems: UpscaleCardData[] = [
    ...activeJobs.map((j) => ({
      id: j.id,
      status: j.status,
      originalName: j.originalName,
      inputUrl: j.inputAsset?.url ?? null,
      outputUrl: j.outputAsset?.url ?? null,
      error: j.error,
    })),
    ...filteredHistory.map(toCardData),
  ];

  const isEmpty = allItems.length === 0 && !historyLoading;
  const isInitialLoad =
    historyLoading && page === 1 && historyItems.length === 0;

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:max-h-[calc(100vh-64px)]">
      <ImageUpscalerForm onSubmit={handleSubmit} />

      {/* Results panel */}
      <div className="flex flex-1 flex-col lg:overflow-hidden">
        <div className="flex bg-card items-center justify-between border-b px-3 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Results</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={historyLoading}
            className="gap-1.5 text-xs"
          >
            <ArrowsClockwise
              className={`size-3.5 ${historyLoading ? "animate-spin" : ""}`}
            />
            {historyLoading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          {isInitialLoad ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <ImageSquare className="size-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No results yet
                </p>
                <p className="mt-1 max-w-[260px] text-xs text-muted-foreground/70">
                  Upload images and choose a resolution — your upscaled results
                  will appear here
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-2 gap-1.5"
              >
                <ArrowsClockwise className="size-3.5" />
                Load previous results
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {allItems.map((item) => (
                  <UpscaleCard
                    key={item.id}
                    job={item}
                    displayMode="asset"
                    onDelete={handleDelete}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
              {hasMoreRef.current && (
                <div ref={sentinelRef} className="flex justify-center py-6">
                  {historyLoading && (
                    <Spinner className="size-5 text-muted-foreground" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <UpscaleDetailDialog
        job={selectedDetail}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
