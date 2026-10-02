"use client";

import {
  CheckCircle,
  Warning,
  Clock,
  PencilSimple,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_META: Record<
  string,
  {
    label: string;
    variant: StatusVariant;
    icon: PhosphorIcon | React.ComponentType<{ className?: string }>;
  }
> = {
  draft: { label: "Draft", variant: "outline", icon: PencilSimple },
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  processing: { label: "Processing", variant: "secondary", icon: Spinner },
  completed: { label: "Completed", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: Warning },
};

interface ProjectStatusBadgeProps {
  status: string;
  className?: string;
}

export function ProjectStatusBadge({
  status,
  className,
}: ProjectStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={className ?? "gap-1"}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}
