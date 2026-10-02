"use client";

import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: Icon;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  /** `inline` drops the dashed frame, for use inside cards. */
  variant?: "framed" | "inline";
  className?: string;
}

function ActionButton({
  action,
  variant,
}: {
  action: NonNullable<EmptyStateProps["action"]>;
  variant: "default" | "outline";
}) {
  if (action.href) {
    return (
      <Link href={action.href} className={buttonVariants({ variant, size: "sm" })}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button variant={variant} size="sm" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  secondaryAction,
  variant = "framed",
  className,
}: EmptyStateProps) {
  return (
    <Empty
      className={cn(
        variant === "framed" ? "bg-muted py-16" : "p-8",
        className,
      )}
    >
      <EmptyHeader>
        {IconComponent ? (
          <EmptyMedia variant="icon">
            <IconComponent />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action || secondaryAction ? (
        <EmptyContent className="flex-row justify-center gap-2">
          {action ? <ActionButton action={action} variant="default" /> : null}
          {secondaryAction ? (
            <ActionButton action={secondaryAction} variant="outline" />
          ) : null}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={WarningCircle}
      title={title}
      description={description}
      action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
      className={className}
    />
  );
}

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground",
        className,
      )}
    >
      <Spinner />
      {label}
    </div>
  );
}
