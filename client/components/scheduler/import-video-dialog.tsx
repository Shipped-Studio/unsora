"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "@phosphor-icons/react";
import { useState } from "react";
import { useVideos, type ProcessedVideo } from "@/hooks/use-videos-query";
import { getCdnUrl } from "@/lib/video-utils";

interface ImportVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (video: ProcessedVideo) => void;
}

export function ImportVideoDialog({
  open,
  onOpenChange,
  onImport,
}: ImportVideoDialogProps) {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const { data: videosData, isLoading: isLoadingVideos } = useVideos(
    currentPage,
    itemsPerPage
  );

  const handleImport = () => {
    if (selectedVideo) {
      const video = videosData?.videos.find((v) => v.id === selectedVideo);
      if (video) {
        onImport(video);
        onOpenChange(false);
        setSelectedVideo(null);
        setCurrentPage(1);
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedVideo(null);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(
    (videosData?.pagination?.totalCount || 0) / itemsPerPage
  );
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl ">
        <DialogHeader>
          <DialogTitle>Import Video</DialogTitle>
          <DialogDescription>
            Select a video from your processed videos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ScrollArea className="h-[500px] pr-4">
            {isLoadingVideos ? (
              <div className="grid grid-cols-4 gap-3 p-2">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ) : !videosData?.videos || videosData.videos.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No videos found</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 p-2">
                {videosData.videos
                  .filter((video) => video.status === "completed")
                  .map((video) => (
                    <div
                      key={video.id}
                      className={`relative cursor-pointer rounded-lg overflow-hidden aspect-square bg-muted transition-all hover:ring-2 hover:ring-primary/50 ${
                        selectedVideo === video.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedVideo(video.id)}
                    >
                      {video.processedAsset?.url ? (
                        <video
                          src={getCdnUrl(video.processedAsset.url)}
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Play className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
                        <p
                          className="text-xs text-white truncate"
                          title={video.originalName}
                        >
                          {video.originalName}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination Controls */}
          {videosData && videosData.pagination?.totalCount > itemsPerPage && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Page {currentPage} of {totalPages} (
                {videosData.pagination?.totalPages} total videos)
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (hasPrevPage && !isLoadingVideos) {
                          setCurrentPage((prev) => Math.max(1, prev - 1));
                        }
                      }}
                      className={
                        !hasPrevPage || isLoadingVideos
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>

                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(1);
                          }}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {currentPage > 4 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                    </>
                  )}

                  {/* Page numbers around current page */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      return (
                        page === currentPage ||
                        page === currentPage - 1 ||
                        page === currentPage + 1 ||
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      );
                    })
                    .map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentPage}
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(totalPages);
                          }}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (hasNextPage && !isLoadingVideos) {
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          );
                        }
                      }}
                      className={
                        !hasNextPage || isLoadingVideos
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 ">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!selectedVideo}>
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
