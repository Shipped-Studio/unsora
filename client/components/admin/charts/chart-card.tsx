import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className={className}>
      {title || action ? (
        <CardHeader>
          {title ? <CardTitle className="truncate">{title}</CardTitle> : null}
          {description ? (
            <CardDescription className="text-xs">{description}</CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}
