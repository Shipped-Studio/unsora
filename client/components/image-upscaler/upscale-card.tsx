"use client";

import { useState } from "react";
import {
  ArrowsLeftRight,
  DotsThree,
  DownloadSimple,
  ImageSquare,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { ScheduleLink } from "@/components/generator/tool-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  isImageUpscaleActive,
  type ImageUpscale,
} from "@/hooks/use-image-upscales-query";
import { getCdnUrl } from "@/lib/video-utils";

interface UpscaleCardProps {
  job: ImageUpscale;
  name: string;
  onOpen: () => void;
  onDelete: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function UpscaleCard({ job, name, onOpen, onDelete }: UpscaleCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = isImageUpscaleActive(job);
  const failed = job.status === "FAILED";
  const outputUrl = job.status === "COMPLETED" ? job.outputUrl : null;

  const status = active
    ? job.status === "QUEUED"
      ? "Queued"
      : "Upscaling"
    : failed
      ? "Failed"
      : formatDate(job.createdAt);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-muted">
      {outputUrl ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Compare ${name}`}
          className="relative block aspect-square w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <img
            src={getCdnUrl(outputUrl)}
            alt={name}
            loading="lazy"
            className="size-full object-cover"
          />
        </button>
      ) : (
        <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden bg-muted px-4 text-center">
          {active && job.inputUrl ? (
            <img
              src={getCdnUrl(job.inputUrl)}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-30"
            />
          ) : null}
          {active ? (
            <>
              <Spinner className="relative text-muted-foreground" />
              <span className="relative text-xs text-muted-foreground">
                {status}
              </span>
            </>
          ) : failed ? (
            <>
              <WarningCircle className="size-5 text-destructive" />
              <p className="line-clamp-3 text-xs text-destructive">
                {job.error || "Upscaling failed."}
              </p>
            </>
          ) : (
            <ImageSquare className="size-6 text-muted-foreground" />
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={name}>
              {name}
            </p>
            <p
              className={
                failed
                  ? "truncate text-xs text-destructive"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {status}
            </p>
          </div>
          {outputUrl ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-1"
                    aria-label={`More actions for ${name}`}
                  />
                }
              >
                <DotsThree weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onOpen}>
                  <ArrowsLeftRight />
                  Compare
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {outputUrl ? (
          <div className="mt-auto flex gap-2">
            <ScheduleLink url={outputUrl} mediaType="image" className="flex-1" />
            <a
              href={getCdnUrl(outputUrl, { download: true })}
              download
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
              aria-label={`Download ${name}`}
            >
              <DownloadSimple />
            </a>
          </div>
        ) : failed ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-auto"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash />
            Delete
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              The upscaled image will be removed from your results. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export function UpscaleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
