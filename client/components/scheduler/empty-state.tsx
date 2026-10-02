import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

interface EmptyStateProps {
  icon: PhosphorIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="text-center py-10 sm:py-16 px-4 space-y-4">
      <div className="flex justify-center">
        <div className="rounded-full bg-muted p-3 sm:p-4">
          <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
        </div>
      </div>
      <div className="mx-auto max-w-md space-y-1">
        <p className="font-medium text-foreground text-sm sm:text-base">
          {title}
        </p>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {description}
        </p>
      </div>
      {actionLabel && actionHref && (
        <Button render={<Link href={actionHref} />}>{actionLabel}</Button>
      )}
    </div>
  );
}
