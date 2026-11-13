"use client";

import { RouteError } from "@/components/shared/route-error";

/** An error here shows inside the page, with Try again, not the whole-site fallback. */
export default function PageError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} />;
}
