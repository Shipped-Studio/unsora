"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { EmptyState } from "@/components/shared/states";

/**
 * Fallback when a signed-in page throws while rendering. Renders inside the
 * dashboard shell, so the sidebar stays usable.
 */
export default function ProtectedError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col justify-center p-4 sm:p-6">
      <EmptyState
        icon={WarningCircle}
        title="Something went wrong"
        description="This page hit an error. Try again, or head back home."
        action={{ label: "Try again", onClick: retry }}
        secondaryAction={{ label: "Go home", href: "/" }}
      />
    </div>
  );
}
