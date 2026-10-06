import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/states";

export const metadata: Metadata = { title: "Page not found" };

/** Unknown URLs anywhere in the app. */
export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <EmptyState
        title="Page not found"
        description="This page doesn't exist or has moved."
        action={{ label: "Go home", href: "/" }}
        className="w-full max-w-md"
      />
    </main>
  );
}
