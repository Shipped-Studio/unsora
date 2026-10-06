"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Images, Slideshow, TextAa, VideoCamera } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { useConnectedAccounts, useEnabledPlatforms } from "@/hooks/use-connected-accounts";
import {
  FORMATS,
  FORMAT_ORDER,
  PLATFORMS,
  PLATFORM_ORDER,
  supportsFormat,
  type PostFormat,
} from "@/lib/scheduler/formats";

const ICONS: Record<PostFormat, Icon> = {
  video: VideoCamera,
  photos: Images,
  slideshow: Slideshow,
  text: TextAa,
};

function FormatChooser() {
  const searchParams = useSearchParams();
  const { data: accounts, isLoading } = useConnectedAccounts();
  const { isEnabled } = useEnabledPlatforms();
  const query = searchParams.toString();
  const connected = (accounts ?? []).filter((a) => isEnabled(a.provider));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {FORMAT_ORDER.map((format) => {
        const spec = FORMATS[format];
        const FormatIcon = ICONS[format];
        const eligible = connected.filter((a) => supportsFormat(a.provider, format));
        const platforms = PLATFORM_ORDER.filter(
          (p) => isEnabled(p) && PLATFORMS[p].formats[format],
        );
        return (
          <Link
            key={format}
            href={`${spec.href}${query ? `?${query}` : ""}`}
            className="group flex flex-col gap-4 rounded-xl border border-transparent bg-muted p-5 transition-colors outline-none hover:border-border hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-card shadow-xs">
                <FormatIcon className="size-5" />
              </span>
              <span className="flex -space-x-1">
                {platforms.map((provider) => (
                  <PlatformIcon
                    key={provider}
                    provider={provider}
                    className="size-5 rounded-full ring-2 ring-muted transition-shadow group-hover:ring-accent"
                  />
                ))}
              </span>
            </div>
            <div className="space-y-1">
              <h2 className="flex items-center gap-1.5 font-medium text-foreground">
                {spec.label}
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
              </h2>
              <p className="text-sm text-muted-foreground">{spec.description}</p>
            </div>
            <div className="mt-auto text-xs text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-40" />
              ) : connected.length === 0 ? (
                "Connect an account to post"
              ) : eligible.length === 0 ? (
                "None of your accounts take this format"
              ) : (
                `${eligible.length} of your ${connected.length} accounts can take this`
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function NewPostPage() {
  return (
    <>
      <PageHeader
        parents={[{ label: "Posts", href: "/scheduler/posts" }]}
        title="New post"
        description="Each format only shows the accounts and settings it needs."
      />
      <PageBody>
        <Suspense>
          <FormatChooser />
        </Suspense>
      </PageBody>
    </>
  );
}
