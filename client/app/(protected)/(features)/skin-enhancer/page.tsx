"use client";

import { useState, useCallback } from "react";
import { UserFocus } from "@phosphor-icons/react";
import {
  SkinEnhancerForm,
  type SkinEnhancerPayload,
} from "@/components/skin-enhancer/skin-enhancer-form";
import { toast } from "sonner";

export default function SkinEnhancerPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (payload: SkinEnhancerPayload) => {
    setIsSubmitting(true);
    try {
      // TODO: wire up to your API
      await new Promise((r) => setTimeout(r, 1000));
      toast.success("Enhancement started");
      console.log("Skin enhancer payload:", payload);
    } catch {
      toast.error("Failed to start enhancement");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:max-h-[calc(100vh-64px)]">
      <SkinEnhancerForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />

      <div className="flex flex-1 flex-col">
        <div className="flex bg-card items-center justify-between border-b px-3 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Results</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <UserFocus className="size-7 text-muted-foreground/50" weight="duotone" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              No results yet
            </p>
            <p className="mt-1 max-w-[260px] text-xs text-muted-foreground/70">
              Upload or paste a portrait URL and hit Enhance skin to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
