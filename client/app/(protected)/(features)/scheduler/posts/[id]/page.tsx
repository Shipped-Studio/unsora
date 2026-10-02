"use client";

import { useParams, useRouter } from "next/navigation";
import { usePost, useDeletePost, type Post } from "@/hooks/use-posts";
import type { PostImage } from "@/hooks/use-post-form";
import {
  ArrowLeft,
  ArrowSquareOut as ExternalLink,
  CalendarBlank as Calendar,
  Clock,
  CheckCircle,
  Trash as Trash2,
  Warning as AlertTriangle,
  PencilSimple as Edit,
  FileVideo,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SlideshowPreview } from "@/components/scheduler/slideshow-preview";
import { getPlatformIcon, getPlatformName } from "@/lib/platform-utils";
import { formatDuration } from "@/lib/video-utils";
import {
  formatDateAndTime,
  getStatusVariant,
  getStatusText,
  canDeletePost,
  canEditPost,
} from "@/lib/post-utils";
import Link from "next/link";
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
import { useMemo, useState } from "react";
import { PostDetailSkeleton } from "@/components/scheduler/post-card-skeleton";

type AccountPublishState =
  | "published"
  | "failed"
  | "publishing"
  | "scheduled"
  | "draft";

/**
 * Per-platform state. `published` on the PostAccount is authoritative;
 * otherwise the state depends on where the parent post is in its lifecycle —
 * a draft's accounts aren't "pending", nothing has been attempted yet.
 */
function getAccountPublishState(
  post: Post,
  postAccount: Post["postAccounts"][number],
): AccountPublishState {
  if (postAccount.published) return "published";
  if (postAccount.error) return "failed";
  if (post.status === "PUBLISHING") return "publishing";
  if (post.status === "SCHEDULED") return "scheduled";
  return "draft";
}

function AccountStatusBadge({ state }: { state: AccountPublishState }) {
  switch (state) {
    case "published":
      return (
        <Badge className="shrink-0 gap-1 bg-success hover:bg-success/90">
          <CheckCircle className="h-3 w-3" weight="fill" />
          Published
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="shrink-0">
          Failed
        </Badge>
      );
    case "publishing":
      return (
        <Badge variant="secondary" className="shrink-0 gap-1.5">
          <Spinner className="h-3 w-3" />
          Publishing
        </Badge>
      );
    case "scheduled":
      return (
        <Badge variant="secondary" className="shrink-0 gap-1">
          <Clock className="h-3 w-3" />
          Scheduled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="shrink-0">
          Not published
        </Badge>
      );
  }
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const { data: post, isLoading, error } = usePost(postId);
  const deletePostMutation = useDeletePost();
  const [isDeleting, setIsDeleting] = useState(false);

  const images: PostImage[] = useMemo(
    () =>
      (post?.media ?? [])
        .filter((m) => m.type === "IMAGE")
        .sort((a, b) => a.order - b.order)
        .map((m) => ({
          id: m.id,
          previewUrl: m.asset.url,
          uploadedUrl: m.asset.url,
          uploading: false,
          progress: 100,
        })),
    [post],
  );

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePostMutation.mutateAsync(postId);
      router.push("/scheduler/posts");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <PostDetailSkeleton />;
  }

  if (error || !post) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/scheduler/posts")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Posts
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load post</p>
        </div>
      </div>
    );
  }

  const video = post.media.find((m) => m.type === "VIDEO");
  const thumbnail = post.media.find((m) => m.type === "THUMBNAIL");
  const publishedCount = post.postAccounts.filter((pa) => pa.published).length;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        <div className="flex items-center gap-3">
          <Button
            render={<Link href="/scheduler/posts" />}
            variant="ghost"
            size="icon"
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Post
              </h1>
              <Badge variant={getStatusVariant(post.status)}>
                {getStatusText(post.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {post.type === "CAROUSEL" || post.type === "IMAGE"
                ? `Photo post · ${images.length} photo${images.length === 1 ? "" : "s"}`
                : "Video post"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditPost(post.status) && (
            <Button
              render={<Link href={`/scheduler/posts/edit/${post.id}`} />}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Post
            </Button>
          )}
          {canDeletePost(post.status) && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={isDeleting}
                  />
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete Post
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delete Post
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this post? This action
                    cannot be undone.
                    <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                      <strong className="text-foreground">Caption:</strong>{" "}
                      {post.mainCaption.slice(0, 150)}
                      {post.mainCaption.length > 150 && "..."}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {post.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Publishing error</AlertTitle>
          <AlertDescription className="text-sm">{post.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* ─── Media preview ─── */}
        <Card className="lg:self-start">
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent>
            {images.length > 0 ? (
              <SlideshowPreview images={images} />
            ) : video ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg bg-muted">
                  <video
                    src={video.asset.url}
                    poster={thumbnail?.asset.url || undefined}
                    controls
                    playsInline
                    className="w-full object-contain"
                  />
                </div>
                {video.asset.duration ? (
                  <div className="flex justify-end">
                    <Badge variant="secondary" className="text-xs">
                      {formatDuration(video.asset.duration)}
                    </Badge>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="mb-3 flex justify-center">
                  <div className="rounded-full bg-muted p-3">
                    <FileVideo className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">No media</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Publishing + details ─── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Platforms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Accounts
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {publishedCount}/{post.postAccounts.length} published
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {post.postAccounts.map((postAccount) => {
                const account = postAccount.account;
                const platformName = getPlatformName(account.provider);
                const displayName =
                  account.accountName ||
                  account.accountUsername ||
                  `${platformName} Account`;
                const state = getAccountPublishState(post, postAccount);

                return (
                  <div
                    key={postAccount.id}
                    className="rounded-lg border p-3 sm:p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage
                            src={account.profilePicture || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback className="bg-muted text-xs">
                            {getPlatformIcon(account.provider, {
                              className: "h-4 w-4",
                            })}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full">
                          {getPlatformIcon(account.provider, {
                            className: "h-4 w-4",
                          })}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {platformName}
                          {postAccount.publishedAt &&
                            ` · ${formatDateAndTime(new Date(postAccount.publishedAt))}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <AccountStatusBadge state={state} />
                        {postAccount.publishedUrl && (
                          <Button
                            render={
                              <Link
                                href={postAccount.publishedUrl}
                                target="_blank"
                              />
                            }
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>

                    {postAccount.error && (
                      <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                        {postAccount.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm">{post.mainCaption}</p>

              <Separator />

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatDateAndTime(new Date(post.createdAt))}
                  </p>
                </div>
                {post.scheduledFor && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Scheduled for
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateAndTime(new Date(post.scheduledFor))}
                    </p>
                  </div>
                )}
                {post.publishedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Published</p>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateAndTime(new Date(post.publishedAt))}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
