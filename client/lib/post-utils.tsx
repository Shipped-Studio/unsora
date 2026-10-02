import { CheckCircle as CheckCircle2, Clock, XCircle, FileText } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";

export type PostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "PARTIALLY_PUBLISHED"
  | "FAILED";
export type PostType = "VIDEO" | "IMAGE" | "CAROUSEL" | "TEXT";

/**
 * Get badge variant for post status
 */
export function getStatusVariant(
  status: PostStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "PUBLISHED":
      return "default";
    case "SCHEDULED":
    case "PUBLISHING":
    case "PARTIALLY_PUBLISHED":
      return "secondary";
    case "DRAFT":
      return "outline";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Get color classes for status
 */
export function getStatusColor(status: PostStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "text-green-500 bg-green-500/10 border-green-500/20";
    case "SCHEDULED":
      return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    case "PUBLISHING":
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    case "PARTIALLY_PUBLISHED":
      return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    case "DRAFT":
      return "text-muted-foreground bg-muted/50 border-border";
    case "FAILED":
      return "text-red-500 bg-red-500/10 border-red-500/20";
    default:
      return "text-muted-foreground bg-muted/50 border-border";
  }
}

/**
 * Get icon component for status
 */
export function getStatusIcon(status: PostStatus, className?: string) {
  const defaultClass = className || "h-4 w-4";

  switch (status) {
    case "PUBLISHED":
      return <CheckCircle2 className={defaultClass} />;
    case "SCHEDULED":
      return <Clock className={defaultClass} />;
    case "PUBLISHING":
      return <Spinner className={defaultClass} />;
    case "PARTIALLY_PUBLISHED":
      return <XCircle className={defaultClass} />;
    case "DRAFT":
      return <FileText className={defaultClass} />;
    case "FAILED":
      return <XCircle className={defaultClass} />;
    default:
      return <FileText className={defaultClass} />;
  }
}

/**
 * Get formatted status text
 */
export function getStatusText(status: PostStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "SCHEDULED":
      return "Scheduled";
    case "PUBLISHING":
      return "Publishing";
    case "PARTIALLY_PUBLISHED":
      return "Partially published";
    case "DRAFT":
      return "Draft";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

/**
 * Format post type text
 */
export function getPostTypeText(type: PostType): string {
  switch (type) {
    case "VIDEO":
      return "Video";
    case "IMAGE":
      return "Image";
    case "CAROUSEL":
      return "Carousel";
    case "TEXT":
      return "Text";
    default:
      return type;
  }
}

/**
 * Get icon for post type
 */
export function getPostTypeIcon(type: PostType, className?: string) {
  const defaultClass = className || "h-4 w-4";

  // You can import specific icons from lucide-react as needed
  return null; // Placeholder - add specific icons as needed
}

/**
 * Check if post can be edited
 */
export function canEditPost(status: PostStatus): boolean {
  return status === "DRAFT" || status === "SCHEDULED";
}

/**
 * Check if post can be deleted
 */
export function canDeletePost(status: PostStatus): boolean {
  return status !== "PUBLISHING";
}

/**
 * Check if post can be published
 */
export function canPublishPost(status: PostStatus): boolean {
  return status === "DRAFT" || status === "FAILED";
}

/**
 * Check if post can be retried (only failed accounts are re-attempted)
 */
export function canRetryPost(status: PostStatus): boolean {
  return status === "FAILED" || status === "PARTIALLY_PUBLISHED";
}

/**
 * Check if post is in a final state
 */
export function isFinalState(status: PostStatus): boolean {
  return (
    status === "PUBLISHED" ||
    status === "PARTIALLY_PUBLISHED" ||
    status === "FAILED"
  );
}

/**
 * Check if post is in progress
 */
export function isInProgress(status: PostStatus): boolean {
  return status === "PUBLISHING";
}

/**
 * Format date and time
 */
export function formatDateAndTime(date: Date): string {
  return format(date, "MMM d, yyyy 'at' h:mm a");
}
