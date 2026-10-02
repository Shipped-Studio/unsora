import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SubmissionStatusBannerProps {
  title: string;
  message?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  isSuccess?: boolean;
}

/**
 * A small banner pinned to the top of the create/edit page skeleton while a
 * submission is in flight. Communicates what's happening (upload progress,
 * saving, success) without yanking the user out of their context.
 */
export function SubmissionStatusBanner({
  title,
  message,
  isUploading,
  uploadProgress = 0,
  isSuccess,
}: SubmissionStatusBannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex items-start gap-3 transition-colors",
        isSuccess
          ? "border-success/30 bg-success/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          isSuccess
            ? "bg-success/15 text-success"
            : "bg-primary/10 text-primary",
        )}
      >
        {isSuccess ? (
          <CheckCircle className="h-5 w-5" weight="fill" />
        ) : (
          <Spinner className="h-5 w-5" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium leading-none">{title}</p>
          {isUploading && !isSuccess && (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {uploadProgress}%
            </span>
          )}
        </div>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        {isUploading && !isSuccess && (
          <Progress value={uploadProgress} className="h-1.5 mt-2" />
        )}
      </div>
    </div>
  );
}

/**
 * Card-shaped skeleton that mirrors the real `PostCard` layout
 * (media preview, caption, date, status badge, account avatars).
 */
export function PostCardSkeleton() {
  return (
    <Card className="w-full gap-0 overflow-hidden p-0">
      <Skeleton className="aspect-4/5 w-full rounded-none" />
      <CardContent className="space-y-2.5 p-3.5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex -space-x-2 pt-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PostCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Full-page skeleton for the various "list of posts" pages
 * (`/scheduler/posts`, `/scheduler/posts/scheduled`, etc.).
 * Renders a header, an optional filter row, and a grid of card skeletons.
 */
export function PostsListPageSkeleton({
  count = 12,
  showFilter = false,
}: {
  count?: number;
  showFilter?: boolean;
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 sm:h-8 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>

      {/* Filter row */}
      {showFilter && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:w-44" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}

      <PostCardSkeletonGrid count={count} />
    </div>
  );
}

/**
 * Skeleton for the post detail page (`/scheduler/posts/[id]`). Mirrors the
 * real layout: header with back button + title + badge + actions, then a
 * media "Content" card on the left and Accounts + Details cards on the right.
 */
export function PostDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md shrink-0" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 sm:h-8 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Content / media card */}
        <Card className="lg:self-start">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-12 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accounts + details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32 max-w-full" />
                      <Skeleton className="h-3 w-44 max-w-full" />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-px w-full" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-28 max-w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the edit post page. Mirrors the real layout pixel-for-pixel:
 * header with back arrow + title + status badge, accounts card, video card,
 * caption card, and a sticky sidebar with preview + update action card.
 */
export function EditPostSkeleton({
  banner,
}: {
  banner?: SubmissionStatusBannerProps;
} = {}) {
  return (
    <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {banner && <SubmissionStatusBanner {...banner} />}

      {/* Header: back button + title + status badge + subtitle */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 sm:h-8 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Accounts card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-56 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Video card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-48 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="h-14 w-14 rounded-md shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-10 rounded" />
              </div>
            </CardContent>
          </Card>

          {/* Caption card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[180px] w-full" />
              <div className="flex justify-end">
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Preview card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Update action card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
              <Skeleton className="h-px w-full" />
              <div className="space-y-2.5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the create post page. Mirrors the real layout: header,
 * accounts card, video drop-zone, caption card, and a sticky sidebar with
 * preview + publish action card.
 */
export function CreatePostSkeleton({
  banner,
}: {
  banner?: SubmissionStatusBannerProps;
} = {}) {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {banner && <SubmissionStatusBanner {...banner} />}

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 sm:h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Accounts card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-56 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Video drop-zone */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-10 flex flex-col items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2 w-full max-w-xs">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4 mx-auto" />
                </div>
                <Skeleton className="h-9 w-32" />
              </div>
            </CardContent>
          </Card>

          {/* Caption card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[180px] w-full" />
              <div className="flex justify-end">
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Preview card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-video w-full rounded-lg" />
            </CardContent>
          </Card>

          {/* Publish action card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
              <Skeleton className="h-px w-full" />
              <div className="space-y-2.5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the connections page.
 */
export function ConnectionsPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 sm:h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="h-9 w-full sm:w-24" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the calendar grid (used while posts are loading).
 */
export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Skeleton className="h-9 w-full sm:w-48" />
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 gap-px bg-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-9 rounded-none bg-muted/50" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton
              key={`d-${i}`}
              className="h-20 sm:h-28 rounded-none bg-card"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
