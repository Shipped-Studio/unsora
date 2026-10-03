import Link from "next/link";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { buttonVariants } from "@/components/ui/button";
import { platformName } from "@/lib/scheduler/formats";

export const metadata = { title: "Account connected · Unsora", robots: { index: false } };

/**
 * Public landing page for shared connect links ("Copy a link to share" on
 * the accounts page). The person who opened the link usually has no Unsora
 * login, so the OAuth callback sends them here instead of the app.
 */
export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; provider?: string; error?: string }>;
}) {
  const { status, provider: rawProvider = "", error } = await searchParams;
  // The YouTube callback reports "youtube"; accounts are stored as "google".
  const provider = rawProvider === "youtube" ? "google" : rawProvider;
  const name = provider ? platformName(provider) : "Your account";
  const ok = status === "success";

  return (
    <div className="flex min-h-svh flex-col bg-background px-4 py-6 sm:px-10">
      <Link href="https://tryunsora.com" className="inline-flex w-fit">
        <UnsoraLogo variant="full" priority className="h-7" />
      </Link>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="relative mx-auto w-fit">
            {provider ? (
              // The ring keeps black marks (TikTok, Threads) visible on dark backgrounds.
              <PlatformIcon provider={provider} className="size-12 rounded-full ring-1 ring-border" />
            ) : null}
            {ok ? (
              <CheckCircle
                weight="fill"
                className="absolute -right-2 -bottom-2 size-6 rounded-full bg-card text-success"
              />
            ) : (
              <WarningCircle
                weight="fill"
                className="absolute -right-2 -bottom-2 size-6 rounded-full bg-card text-destructive"
              />
            )}
          </div>
          <h1 className="text-xl font-semibold">
            {ok ? `${name} connected` : `Couldn't connect ${name}`}
          </h1>
          {ok ? (
            <p className="text-sm text-muted-foreground">
              The account is now linked to the Unsora workspace that sent you this link. You can
              close this tab.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Try the link again, or ask whoever sent it for a new one.
              </p>
              {error ? (
                // Usually our own reason (expired link, plan limit); provider text is kept short.
                <p className="line-clamp-3 text-xs text-muted-foreground" title={error}>
                  {error}
                </p>
              ) : null}
            </div>
          )}
          <div className="pt-2">
            <Link href="/" className={buttonVariants()}>
              Open Unsora
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
