"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectedAccounts, useEnabledPlatforms } from "@/hooks/use-connected-accounts";
import { FORMATS, FORMAT_ORDER, supportsFormat, type PostFormat } from "@/lib/scheduler/formats";

/**
 * "New post" lands straight in the composer, which has its own format tabs.
 * It opens on the format most of your accounts take, or the first one the
 * account in `?account=` takes. Date and account params carry over.
 */
function NewPostRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: accounts, isLoading, isError } = useConnectedAccounts();
  const { isEnabled, isLoading: platformsLoading } = useEnabledPlatforms();
  const redirected = useRef(false);

  useEffect(() => {
    if (isLoading || platformsLoading || redirected.current) return;
    redirected.current = true;
    const connected = isError ? [] : (accounts ?? []).filter((a) => isEnabled(a.provider));
    const accountId = searchParams.get("account");
    const only = accountId ? connected.filter((a) => a.id === accountId) : [];
    const pool = only.length ? only : connected;

    let best: PostFormat = FORMAT_ORDER[0];
    let bestCount = -1;
    for (const format of FORMAT_ORDER) {
      const count = pool.filter((a) => supportsFormat(a.provider, format)).length;
      if (count > bestCount) {
        best = format;
        bestCount = count;
      }
    }
    const query = searchParams.toString();
    router.replace(`${FORMATS[best].href}${query ? `?${query}` : ""}`);
  }, [accounts, isError, isEnabled, isLoading, platformsLoading, router, searchParams]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
      <div className="space-y-6">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="hidden h-96 w-full rounded-xl lg:block" />
    </div>
  );
}

export default function NewPostPage() {
  return (
    <>
      <PageHeader parents={[{ label: "Posts", href: "/scheduler/posts" }]} title="New post" />
      <PageBody>
        <Suspense>
          <NewPostRedirect />
        </Suspense>
      </PageBody>
    </>
  );
}
