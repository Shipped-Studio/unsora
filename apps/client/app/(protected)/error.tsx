"use client";

import { RouteError } from "@/components/shared/route-error";

/**
 * Fallback when a signed-in page throws while rendering. Renders inside the
 * dashboard shell, so the sidebar stays usable.
 */
export default function ProtectedError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} />;
}
