import Link from "next/link";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
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
    <div className="flex min-h-svh flex-col bg-background px-6 py-6 sm:px-10">
      <Link href="https://tryunsora.com" className="inline-flex w-fit">
        <UnsoraLogo variant="full" priority className="h-7" />
      </Link>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="relative mx-auto w-fit">
            {provider ? <PlatformIcon provider={provider} className="size-12" /> : null}
            {ok ? (
              <CheckCircle weight="fill" className="absolute -right-2 -bottom-2 size-6 rounded-full bg-background text-success" />
            ) : (
              <WarningCircle weight="fill" className="absolute -right-2 -bottom-2 size-6 rounded-full bg-background text-destructive" />
            )}
          </div>
          <h1 className="text-xl font-semibold">
            {ok ? `${name} connected` : `Couldn't connect ${name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ok
              ? "The account is now linked to the Unsora workspace that sent you this link. You can close this tab."
              : error || "Something went wrong. Try the link again, or ask for a new one."}
          </p>
        </div>
      </main>
    </div>
  );
}
