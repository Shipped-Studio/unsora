"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Sets the Clerk `unsafeMetadata.onboardedAt` flag; rendered once the last
 * step of either setup is reached. Either setup skips straight to its end
 * after that, so nobody goes through it twice.
 */
export function MarkOnboarded() {
  const { user } = useUser();
  const done = useRef(false);
  useEffect(() => {
    if (!user || done.current || user.unsafeMetadata?.onboardedAt) return;
    done.current = true;
    void user.update({
      unsafeMetadata: { ...user.unsafeMetadata, onboardedAt: new Date().toISOString() },
    });
  }, [user]);
  return null;
}
