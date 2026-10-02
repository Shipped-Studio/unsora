import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Post } from "@/hooks/use-posts";
import { useDeletePost, useRetryPost } from "@/hooks/use-posts";
import Link from "next/link";
import {
  getPlatformIcon,
  getPlatformName,
  formatHandle,
} from "@/lib/platform-utils";
import { formatDuration } from "@/lib/video-utils";
import {
  formatDateAndTime,
  getStatusVariant,
  getStatusText,
  canDeletePost,
  canEditPost,
  canRetryPost,
} from "@/lib/post-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Trash as Trash2,
  Warning as AlertTriangle,
  PencilSimple as Pen,
  Play,
  Images as ImagesIcon,
  FileVideo,
  CalendarBlank,
  Clock,
  CheckCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: Post;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (postId: string) => void;
}

/** Media preview: images for photo posts, thumbnail/first-frame for videos. */
function PostCardMedia({ post }: { post: Post }) {
  const images = (post.media ?? [])
    .filter((m) => m.type === "IMAGE")
    .sort((a, b) => a.order - b.order);
  const video = (post.media ?? []).find((m) => m.type === "VIDEO");
  const thumbnail = (post.media ?? []).find((m) => m.type === "THUMBNAIL");

  if (images.length > 0) {
    return (
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        <img
          src={images[0].asset.url}
          alt={post.mainCaption.slice(0, 60) || "Post image"}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {images.length > 1 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
            <ImagesIcon className="h-3 w-3" />
            {images.length}
          </div>
        )}
      </div>
    );
  }

  if (video) {
    const duration = video.asset.duration;
    return (
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        {thumbnail?.asset.url ? (
          <img
            src={thumbnail.asset.url}
            alt={post.mainCaption.slice(0, 60) || "Video cover"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <video
            src={video.asset.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        {/* Play affordance */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-[2px]">
            <Play className="h-4 w-4 translate-x-px text-white" weight="fill" />
          </div>
        </div>
        {duration ? (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {formatDuration(duration)}
          </div>
        ) : null}
      </div>
    );
  }

  // No media (e.g. draft without upload yet)
  return (
    <div className="flex aspect-4/5 items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
        <FileVideo className="h-7 w-7" />
        <span className="text-xs">No media yet</span>
      </div>
    </div>
  );
}

function PostCardDate({ post }: { post: Post }) {
  const isScheduled = post.status === "SCHEDULED" && post.scheduledFor;
  const isPublished = post.status === "PUBLISHED" && post.publishedAt;

  const date = new Date(
    post.scheduledFor || post.publishedAt || post.createdAt,
  );

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isScheduled ? (
        <Clock className="h-3.5 w-3.5" />
      ) : isPublished ? (
        <CheckCircle className="h-3.5 w-3.5" />
      ) : (
        <CalendarBlank className="h-3.5 w-3.5" />
      )}
      {formatDateAndTime(date)}
    </span>
  );
}

export function PostCard({
  post,
  selectionMode = false,
  isSelected = false,
  onSelect,
}: PostCardProps) {
  const deletePostMutation = useDeletePost();
  const retryPostMutation = useRetryPost();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!post) {
    return null;
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDeleting(true);
    try {
      await deletePostMutation.mutateAsync(post.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    retryPostMutation.mutate(post.id);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.preventDefault();
      onSelect(post.id);
    }
  };

  const showDeleteButton = !selectionMode && canDeletePost(post.status);
  const showEditButton = !selectionMode && canEditPost(post.status);
  const showRetryButton = !selectionMode && canRetryPost(post.status);

  const cardContent = (
    <Card
      className={cn(
        "w-full gap-0 overflow-hidden p-0 transition-colors cursor-pointer",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50",
      )}
    >
      <PostCardMedia post={post} />

      <CardContent className="space-y-2.5 p-3.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {post.mainCaption || (
            <span className="italic text-muted-foreground">No caption</span>
          )}
        </p>

        <div className="flex items-center justify-between gap-2">
          <PostCardDate post={post} />
          <Badge
            className="shrink-0 text-xs"
            variant={getStatusVariant(post.status)}
          >
            {getStatusText(post.status)}
          </Badge>
        </div>

        {(post.status === "FAILED" ||
          post.status === "PARTIALLY_PUBLISHED") &&
          post.error && (
            <p
              className="line-clamp-2 text-xs text-destructive"
              title={post.error}
            >
              {post.error}
            </p>
          )}

        {/* Connected Accounts */}
        {post.postAccounts && post.postAccounts.length > 0 && (
          <div className="flex items-center pt-0.5">
            <div className="flex -space-x-2">
              {post.postAccounts.slice(0, 5).map((postAccount, index) => {
                const account = postAccount.account;
                const platformName = getPlatformName(account.provider);
                const displayName =
                  account.accountName ||
                  account.accountUsername ||
                  `${platformName} Account`;

                return (
                  <Tooltip key={postAccount.id}>
                    <TooltipTrigger>
                      <div
                        className="relative cursor-pointer transition-transform hover:z-10 hover:scale-110"
                        style={{ zIndex: 4 - index }}
                      >
                        <Avatar className="h-7 w-7 border ring-0">
                          <AvatarImage
                            src={account.profilePicture || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback className="bg-muted text-[10px]">
                            {getPlatformIcon(account.provider, {
                              className: "h-3 w-3",
                            })}
                          </AvatarFallback>
                        </Avatar>
                        {/* Platform Icon Badge */}
                        <div className="absolute -bottom-0.5 -right-0.5 rounded-full">
                          <div className="flex h-3.5 w-3.5 items-center justify-center">
                            {getPlatformIcon(account.provider, {
                              className: "h-3.5 w-3.5",
                            })}
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <p className="font-medium">{displayName}</p>
                        {account.accountUsername && (
                          <p className="text-xs text-muted-foreground">
                            {formatHandle(account.accountUsername)}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {post.postAccounts.length > 5 && (
              <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                +{post.postAccounts.length - 5}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="relative group">
      {selectionMode ? (
        <div onClick={handleCardClick}>{cardContent}</div>
      ) : (
        <Link href={`/scheduler/posts/${post.id}`}>{cardContent}</Link>
      )}

      {/* Checkbox: always visible in selection mode, visible on hover otherwise */}
      {onSelect && (
        <div
          className={cn(
            "absolute top-3 left-3 z-10",
            selectionMode
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 transition-opacity",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(post.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            className="bg-background/80 backdrop-blur-sm"
          />
        </div>
      )}

      {/* Action Buttons - visible on hover, hidden in selection mode */}
      {!selectionMode && (
        <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {showRetryButton && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="icon"
                  className="h-8 w-8 shadow-md"
                  onClick={handleRetry}
                  disabled={retryPostMutation.isPending}
                >
                  <ArrowsClockwise
                    className={cn(
                      "h-4 w-4",
                      retryPostMutation.isPending && "animate-spin",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Retry failed accounts</p>
              </TooltipContent>
            </Tooltip>
          )}

          {showEditButton && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="icon"
                  className="h-8 w-8 shadow-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/scheduler/posts/edit/${post.id}`}>
                    <Pen className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit post</p>
              </TooltipContent>
            </Tooltip>
          )}

          {showDeleteButton && (
            <AlertDialog>
              <AlertDialogTrigger onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 shadow-md"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delete Post
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this post? This action
                    cannot be undone.
                    <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                      <strong className="text-foreground">Caption:</strong>{" "}
                      {post.mainCaption.slice(0, 100)}
                      {post.mainCaption.length > 100 && "..."}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    variant="destructive"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}
