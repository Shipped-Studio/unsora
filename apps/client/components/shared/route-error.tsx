"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { EmptyState } from "@/components/shared/states";

/**
 * A page's error screen (an `error.tsx`), shown in place of the page only, so
 * the rest of the screen stays and "Try again" usually gets going again.
 */
export function RouteError({
  error,
  retry,
  description = "This page hit an error. Try again, or head back home.",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  description?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col justify-center p-4 sm:p-6">
      <EmptyState
        icon={WarningCircle}
        title="Something went wrong"
        description={description}
        action={{ label: "Try again", onClick: retry }}
        secondaryAction={{ label: "Go home", href: "/" }}
      />
    </div>
  );
}
