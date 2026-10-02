"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CalendarBlank,
  Copy,
  PaperPlaneTilt,
  PencilSimple,
  Robot,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { SchedulePicker } from "@/components/composer/schedule-picker";
import {
  AccountAvatar,
  accountHandle,
  accountLabel,
} from "@/components/scheduler/account-avatar";
import { PostStatusBadge } from "@/components/scheduler/post-status-badge";
import {
  useDeletePost,
  useDuplicatePost,
  usePublishPost,
  useReschedulePost,
  useRetryPost,
} from "@/hooks/use-posts";
import { useSchedulerTimezone } from "@/hooks/use-schedule";
import type { Metrics } from "@/hooks/use-analytics";
import { formatDayTime, zoneLabel } from "@/lib/scheduler/dates";
import { FORMATS, formatForPost, platformName } from "@/lib/scheduler/formats";
import { canDelete, canEdit, canPublishNow, canRetry } from "@/lib/scheduler/status";
import type { Post, PostAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

function LegStatus({ leg, postStatus }: { leg: PostAccount; postStatus: Post["status"] }) {
  if (leg.published) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <span className="size-1.5 rounded-full bg-success" />
        Published
      </span>
    );
  }
  if (leg.error) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  const label =
    postStatus === "PUBLISHING"
      ? "Publishing"
      : postStatus === "SCHEDULED"
        ? "Scheduled"
        : postStatus === "DRAFT"
          ? "Draft"
          : "Waiting";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full bg-muted-foreground/50",
          postStatus === "PUBLISHING" && "animate-pulse bg-info",
        )}
      />
      {label}
    </span>
  );
}

function compact(n: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
}

function PostMediaPreview({ post }: { post: Post }) {
  const media = [...post.media].sort((a, b) => a.order - b.order);
  const video = media.find((m) => m.type === "VIDEO");
  const cover = media.find((m) => m.type === "THUMBNAIL");
  const images = media.filter((m) => m.type === "IMAGE");

  if (video) {
    return (
      <video
        src={video.asset.url}
        poster={cover?.asset.url}
        controls
        playsInline
        preload="metadata"
        className="max-h-96 w-full rounded-lg bg-media object-contain"
      />
    );
  }
  if (images.length) {
    return (
      <div className={cn("grid gap-1.5", images.length > 1 ? "grid-cols-3" : "grid-cols-1")}>
        {images.map((image) => (
          <a
            key={image.id}
            href={image.asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-md bg-muted"
          >
            <img
              src={image.asset.url}
              alt=""
              loading="lazy"
              className={cn(
                "w-full object-cover",
                images.length > 1 ? "aspect-square" : "max-h-96 object-contain",
              )}
            />
          </a>
        ))}
      </div>
    );
  }
  return null;
}

/** Everything about one post plus its actions. Used by the sheet and the page. */
export function PostDetails({
  post,
  metrics,
  onDeleted,
}: {
  post: Post;
  metrics?: Record<string, Metrics>;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const userZone = useSchedulerTimezone();
  const zone = post.scheduledTimezone || userZone;
  const publish = usePublishPost();
  const retry = useRetryPost();
  const duplicate = useDuplicatePost();
  const remove = useDeletePost();
  const reschedule = useReschedulePost();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [draftTime, setDraftTime] = useState<Date | null>(
    post.scheduledFor ? new Date(post.scheduledFor) : null,
  );
  const [draftZone, setDraftZone] = useState(zone);

  const when = post.publishedAt ?? post.scheduledFor;
  const whenLabel = post.publishedAt
    ? `Published ${formatDayTime(post.publishedAt, zone)}`
    : post.scheduledFor
      ? `${post.status === "SCHEDULED" ? "Scheduled for" : "Was scheduled for"} ${formatDayTime(post.scheduledFor, zone)}`
      : "Not scheduled";

  const customized = post.postAccounts.filter((leg) => leg.customCaption).length;
  const format = FORMATS[formatForPost(post)];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PostStatusBadge status={post.status} className="text-sm" />
        <span className="text-sm text-muted-foreground">
          {whenLabel}
          {when ? ` ${zoneLabel(zone, new Date(when))}` : ""}
        </span>
        <span className="text-sm text-muted-foreground">· {format.label}</span>
        {post.source !== "WEB" ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            · <Robot className="size-3.5" />
            {post.source === "MCP" ? "Created by your agent" : "Created with the API"}
          </span>
        ) : null}
      </div>

      {post.error && post.status !== "PUBLISHED" ? (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
          <WarningCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>{post.error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canEdit(post.status) ? (
          <Link
            href={`/scheduler/posts/${post.id}/edit`}
            className={buttonVariants({ size: "sm" })}
          >
            <PencilSimple />
            Edit
          </Link>
        ) : null}
        {canRetry(post.status) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={retry.isPending}
            onClick={() => retry.mutate(post.id)}
          >
            {retry.isPending ? <Spinner /> : <ArrowsClockwise />}
            Retry failed
          </Button>
        ) : null}
        {canPublishNow(post.status) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={publish.isPending}
            onClick={() => publish.mutate(post.id)}
          >
            {publish.isPending ? <Spinner /> : <PaperPlaneTilt />}
            Publish now
          </Button>
        ) : null}
        {canEdit(post.status) ? (
          <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
            <PopoverTrigger render={<Button size="sm" variant="outline" />}>
              <CalendarBlank />
              {post.scheduledFor ? "Reschedule" : "Schedule"}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-3">
              <SchedulePicker
                value={draftTime}
                timezone={draftZone}
                excludePostId={post.id}
                onChange={setDraftTime}
                onTimezoneChange={setDraftZone}
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRescheduleOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!draftTime || reschedule.isPending}
                  onClick={async () => {
                    if (!draftTime) return;
                    try {
                      await reschedule.reschedule(post.id, draftTime, draftZone);
                      setRescheduleOpen(false);
                    } catch {
                      // The mutation surfaces the error.
                    }
                  }}
                >
                  {reschedule.isPending ? <Spinner /> : null}
                  Save time
                </Button>
              </div>
              {reschedule.error ? (
                <p className="mt-2 max-w-sm text-sm text-destructive">{reschedule.error.message}</p>
              ) : null}
            </PopoverContent>
          </Popover>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={duplicate.isPending}
          onClick={() =>
            duplicate.mutate(post.id, {
              onSuccess: (copy) => router.push(`/scheduler/posts/${copy.id}/edit`),
            })
          }
        >
          {duplicate.isPending ? <Spinner /> : <Copy />}
          Duplicate
        </Button>
        {canDelete(post.status) ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button size="sm" variant="ghost" className="text-muted-foreground" />}
            >
              <Trash />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>
                  {post.postAccounts.some((leg) => leg.published)
                    ? "It stays up on the platforms it already went out to. This only removes it from Unsora."
                    : "It won't be published. This can't be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    remove.mutate(post.id, { onSuccess: () => onDeleted?.() })
                  }
                >
                  Delete post
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      <PostMediaPreview post={post} />

      <section className="space-y-2">
        <h3 className="text-sm font-medium">
          {post.type === "TEXT" ? "Post" : "Caption"}
          {customized ? (
            <span className="ml-2 font-normal text-muted-foreground">
              Customized for {customized} {customized === 1 ? "account" : "accounts"}
            </span>
          ) : null}
        </h3>
        <p className="text-sm whitespace-pre-wrap break-words text-foreground">
          {post.mainCaption || <span className="text-muted-foreground italic">No caption</span>}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Accounts</h3>
        <ul className="divide-y divide-card rounded-xl bg-muted">
          {post.postAccounts.map((leg) => {
            const legMetrics = metrics?.[leg.id];
            return (
              <li key={leg.id} className="space-y-2 p-3">
                <div className="flex items-center gap-3">
                  <AccountAvatar account={leg.account} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{accountLabel(leg.account)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {platformName(leg.account.provider)}
                      {accountHandle(leg.account) ? ` · ${accountHandle(leg.account)}` : ""}
                    </p>
                  </div>
                  <LegStatus leg={leg} postStatus={post.status} />
                  {leg.publishedUrl ? (
                    <a
                      href={leg.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      aria-label={`Open on ${platformName(leg.account.provider)}`}
                    >
                      <ArrowSquareOut />
                    </a>
                  ) : null}
                </div>
                {leg.title ? (
                  <p className="pl-12 text-xs text-muted-foreground">Title: {leg.title}</p>
                ) : null}
                {leg.customCaption ? (
                  <p className="line-clamp-3 pl-12 text-xs text-muted-foreground">
                    {leg.customCaption}
                  </p>
                ) : null}
                {leg.error && !leg.published ? (
                  <p className="pl-12 text-xs text-destructive">{leg.error}</p>
                ) : null}
                {legMetrics ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pl-12 text-xs text-muted-foreground tabular-nums">
                    <span>{compact(legMetrics.views)} views</span>
                    <span>{compact(legMetrics.likes)} likes</span>
                    <span>{compact(legMetrics.comments)} comments</span>
                    {legMetrics.shares ? <span>{compact(legMetrics.shares)} shares</span> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
