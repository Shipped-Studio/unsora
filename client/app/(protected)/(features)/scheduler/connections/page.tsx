"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { toast } from "sonner";
import { ConnectionsHeader } from "@/components/scheduler/connections-header";
import { PlatformConnectionCard } from "@/components/scheduler/platform-connection-card";
import { InstagramConnectionDialog } from "@/components/scheduler/instagram-connection-dialog";
import { YouTubeConnectionDialog } from "@/components/scheduler/youtube-connection-dialog";
import { TikTokConnectionDialog } from "@/components/scheduler/tiktok-connection-dialog";
import { FacebookConnectionDialog } from "@/components/scheduler/facebook-connection-dialog";
import { BlueskyConnectionDialog } from "@/components/scheduler/bluesky-connection-dialog";
import { ThreadsConnectionDialog } from "@/components/scheduler/threads-connection-dialog";
import { PinterestConnectionDialog } from "@/components/scheduler/pinterest-connection-dialog";
import { LinkedInConnectionDialog } from "@/components/scheduler/linkedin-connection-dialog";
import {
  TikTokIcon,
  YouTubeIcon,
  FacebookIcon,
  InstagramIcon,
  BlueskyIcon,
  ThreadsIcon,
  PinterestIcon,
  LinkedInIcon,
} from "@/components/icons";
import { ConnectionsPageSkeleton } from "@/components/scheduler/post-card-skeleton";

interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountId: string;
  accountName: string | null;
  accountUsername: string | null;
  profilePicture: string | null;
  expiresAt: string | null;
}

interface SocialPlatform {
  name: string;
  icon: React.ReactNode;
  iconBg?: string;
  description: string;
  comingSoon?: boolean;
}

const platforms: SocialPlatform[] = [
  {
    name: "TikTok",
    icon: <TikTokIcon className="h-10 w-10" />,
    iconBg: "bg-black/5 dark:bg-white/10",
    description: "Connect a TikTok account to schedule and publish videos",
  },
  {
    name: "Instagram",
    icon: <InstagramIcon className="h-10 w-10" />,
    iconBg:
      "bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10",
    description: "Connect an Instagram account for posts, reels, and carousels",
  },
  {
    name: "YouTube",
    icon: <YouTubeIcon className="h-10 w-10" />,
    iconBg: "bg-red-500/10",
    description: "Connect a YouTube channel to schedule and publish videos",
  },
  {
    name: "Facebook",
    icon: <FacebookIcon className="h-10 w-10" />,
    iconBg: "bg-blue-600/10",
    description: "Connect your Facebook Pages to publish posts and videos",
  },
  // {
  //   name: "Threads",
  //   icon: <ThreadsIcon className="h-10 w-10" />,
  //   iconBg: "bg-black/5 dark:bg-white/10",
  //   description: "Connect a Threads profile to publish text, images, and videos",
  // },
  {
    name: "Bluesky",
    icon: <BlueskyIcon className="h-10 w-10" />,
    iconBg: "bg-sky-500/10",
    description: "Connect a Bluesky account to publish posts, images, and videos",
  },
  // {
  //   name: "Pinterest",
  //   icon: <PinterestIcon className="h-10 w-10" />,
  //   iconBg: "bg-red-600/10",
  //   description: "Connect a Pinterest account to publish image and video pins",
  // },
  {
    name: "LinkedIn",
    icon: <LinkedInIcon className="h-10 w-10" />,
    iconBg: "bg-[#0A66C2]/10",
    description:
      "Connect a LinkedIn profile to publish text, image, and video posts",
  },
];

function ConnectionsPageContent() {
  const { authFetch } = useAuthFetch();
  const searchParams = useSearchParams();
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshingAllPlatform, setRefreshingAllPlatform] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [instagramDialogOpen, setInstagramDialogOpen] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [tiktokDialogOpen, setTiktokDialogOpen] = useState(false);
  const [facebookDialogOpen, setFacebookDialogOpen] = useState(false);
  const [blueskyDialogOpen, setBlueskyDialogOpen] = useState(false);
  const [threadsDialogOpen, setThreadsDialogOpen] = useState(false);
  const [pinterestDialogOpen, setPinterestDialogOpen] = useState(false);
  const [linkedinDialogOpen, setLinkedinDialogOpen] = useState(false);

  // Platform name mapping (client-side display name to server provider name)
  const platformToProvider = (platformName: string): string => {
    return platformName.toLowerCase().replace("youtube", "google");
  };

  // Provider to platform mapping (server provider name to client display name)
  const providerToPlatform = (provider: string): string => {
    // The server stores YouTube accounts under "google" but its OAuth
    // callback redirects with provider=youtube.
    if (provider === "google" || provider === "youtube") return "YouTube";
    if (provider === "tiktok") return "TikTok";
    if (provider === "linkedin") return "LinkedIn";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  // Handle OAuth callback status from URL params
  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const error = searchParams.get("error");

    if (status === "success" && provider) {
      const platformName = providerToPlatform(provider);
      toast.success(`${platformName} account connected successfully!`);
      fetchConnectedAccounts();

      // Clean up URL params
      // window.history.replaceState({}, "", "/connections");
    } else if (status === "error" && provider) {
      const platformName = providerToPlatform(provider);
      const errorMessage = error ? decodeURIComponent(error) : "Unknown error";
      toast.error(`Failed to connect ${platformName}: ${errorMessage}`);

      // Clean up URL params
      // window.history.replaceState({}, "", "/connections");
    }
  }, [searchParams]);

  // Fetch connected accounts on mount
  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/connect/accounts");

      if (response.ok) {
        const data = await response.json();
        setConnectedAccounts(data.data || []);
      } else {
        toast.error("Failed to fetch connected accounts");
      }
    } catch (error) {
      console.error("Error fetching connected accounts:", error);
      toast.error("Failed to fetch connected accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (
    platformName: string,
    options?: {
      method?: "instagram" | "facebook";
      skipDialog?: boolean;
    },
  ) => {
    const method = options?.method;
    const skipDialog = options?.skipDialog;

    // Show Instagram dialog if connecting to Instagram
    if (platformName === "Instagram" && !skipDialog && !method) {
      setInstagramDialogOpen(true);
      return;
    }

    // Show YouTube dialog if connecting to YouTube
    if (platformName === "YouTube" && !skipDialog) {
      setYoutubeDialogOpen(true);
      return;
    }

    // Show TikTok dialog if connecting to TikTok
    if (platformName === "TikTok" && !skipDialog) {
      setTiktokDialogOpen(true);
      return;
    }

    // Show Facebook dialog if connecting to Facebook
    if (platformName === "Facebook" && !skipDialog) {
      setFacebookDialogOpen(true);
      return;
    }

    // Bluesky always goes through its dialog: AT Protocol OAuth
    // needs the user's handle to locate their server.
    if (platformName === "Bluesky") {
      setBlueskyDialogOpen(true);
      return;
    }

    // Show Threads dialog if connecting to Threads
    if (platformName === "Threads" && !skipDialog) {
      setThreadsDialogOpen(true);
      return;
    }

    // Show Pinterest dialog if connecting to Pinterest
    if (platformName === "Pinterest" && !skipDialog) {
      setPinterestDialogOpen(true);
      return;
    }

    // Show LinkedIn dialog if connecting to LinkedIn
    if (platformName === "LinkedIn" && !skipDialog) {
      setLinkedinDialogOpen(true);
      return;
    }

    setConnecting(platformName);

    try {
      let authUrl = "";
      let provider = platformToProvider(platformName);

      // If Instagram connection via Facebook, use facebook provider
      if (platformName === "Instagram" && method === "facebook") {
        provider = "facebook";
      } else if (platformName === "Instagram" && method === "instagram") {
        provider = "instagram";
      }

      const returnUrl = window.location.origin;
      const res = await authFetch(
        `/api/connect/${provider}?returnUrl=${encodeURIComponent(returnUrl)}`,
      );

      const data = await res.json();
      authUrl = data.authUrl;
      window.location.href = authUrl;

      setConnecting(null);
    } catch (error) {
      console.error("Error connecting account:", error);
      toast.error(`Failed to connect ${platformName} account`);
      setConnecting(null);
    }
  };

  const handleBlueskyConnect = async (handle: string) => {
    setConnecting("Bluesky");

    try {
      const res = await authFetch(
        `/api/connect/bluesky?handle=${encodeURIComponent(handle)}`,
      );
      const data = await res.json();

      if (!res.ok || !data.authUrl) {
        throw new Error(data.error || "Failed to start Bluesky sign-in");
      }

      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Error connecting Bluesky account:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to connect Bluesky account",
      );
      setConnecting(null);
    }
  };

  const handleRefreshAll = async (platformName: string) => {
    const platformAccounts = getAccountsByPlatform(platformName);

    if (platformAccounts.length === 0) {
      toast.error(`No ${platformName} accounts to refresh`);
      return;
    }

    setRefreshingAllPlatform(platformName);

    try {
      // Refresh all accounts in parallel
      const refreshPromises = platformAccounts.map(async (account) => {
        try {
          const response = await authFetch(
            `/api/connect/accounts/${account.id}/refresh`,
            {
              method: "POST",
            },
          );

          if (response.ok) {
            const data = await response.json();
            return { success: true, data: data.data };
          } else {
            const errorData = await response.json();
            return { success: false, error: errorData.error, id: account.id };
          }
        } catch (error) {
          return { success: false, error: "Network error", id: account.id };
        }
      });

      const results = await Promise.all(refreshPromises);

      // Count successes and failures
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      // Update state with successful refreshes
      const updatedAccounts = [...connectedAccounts];
      results.forEach((result) => {
        if (result.success && result.data) {
          const index = updatedAccounts.findIndex(
            (acc) => acc.id === result.data.id,
          );
          if (index !== -1) {
            updatedAccounts[index] = result.data;
          }
        }
      });
      setConnectedAccounts(updatedAccounts);

      // Show appropriate toast
      if (failureCount === 0) {
        toast.success(
          `All ${platformName} accounts refreshed successfully! (${successCount}/${platformAccounts.length})`,
        );
      } else if (successCount === 0) {
        toast.error(`Failed to refresh ${platformName} accounts`);
      } else {
        toast.warning(
          `Partially refreshed ${platformName} accounts: ${successCount} succeeded, ${failureCount} failed`,
        );
      }
    } catch (error) {
      console.error("Error refreshing all accounts:", error);
      toast.error(`Failed to refresh ${platformName} accounts`);
    } finally {
      setRefreshingAllPlatform(null);
    }
  };

  const handleDisconnect = async (accountId: string, platformName: string) => {
    try {
      const response = await authFetch(`/api/connect/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`${platformName} account disconnected`);
        setConnectedAccounts(
          connectedAccounts.filter((account) => account.id !== accountId),
        );
      } else {
        toast.error("Failed to disconnect account");
      }
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    }
  };

  const getAccountsByPlatform = (platformName: string) => {
    const provider = platformToProvider(platformName);
    return connectedAccounts.filter((account) => account.provider === provider);
  };

  const totalAccounts = connectedAccounts.length;
  const connectedPlatformCount = new Set(
    connectedAccounts.map((account) => account.provider),
  ).size;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <ConnectionsHeader
        totalAccounts={totalAccounts}
        connectedPlatforms={connectedPlatformCount}
        loading={loading}
      />

      {/* Instagram Connection Dialog */}
      <InstagramConnectionDialog
        open={instagramDialogOpen}
        onOpenChange={setInstagramDialogOpen}
        onConnect={() =>
          handleConnect("Instagram", { method: "instagram", skipDialog: true })
        }
        isConnecting={connecting === "Instagram"}
      />

      {/* YouTube Connection Dialog */}
      <YouTubeConnectionDialog
        open={youtubeDialogOpen}
        onOpenChange={setYoutubeDialogOpen}
        onConnect={() => handleConnect("YouTube", { skipDialog: true })}
        isConnecting={connecting === "YouTube"}
      />

      {/* TikTok Connection Dialog */}
      <TikTokConnectionDialog
        open={tiktokDialogOpen}
        onOpenChange={setTiktokDialogOpen}
        onConnect={() => handleConnect("TikTok", { skipDialog: true })}
        isConnecting={connecting === "TikTok"}
      />

      {/* Facebook Connection Dialog */}
      <FacebookConnectionDialog
        open={facebookDialogOpen}
        onOpenChange={setFacebookDialogOpen}
        onConnect={() => handleConnect("Facebook", { skipDialog: true })}
        isConnecting={connecting === "Facebook"}
      />

      {/* Bluesky Connection Dialog */}
      <ThreadsConnectionDialog
        open={threadsDialogOpen}
        onOpenChange={setThreadsDialogOpen}
        onConnect={() => handleConnect("Threads", { skipDialog: true })}
        isConnecting={connecting === "Threads"}
      />

      <PinterestConnectionDialog
        open={pinterestDialogOpen}
        onOpenChange={setPinterestDialogOpen}
        onConnect={() => handleConnect("Pinterest", { skipDialog: true })}
        isConnecting={connecting === "Pinterest"}
      />

      <LinkedInConnectionDialog
        open={linkedinDialogOpen}
        onOpenChange={setLinkedinDialogOpen}
        onConnect={() => handleConnect("LinkedIn", { skipDialog: true })}
        isConnecting={connecting === "LinkedIn"}
      />

      <BlueskyConnectionDialog
        open={blueskyDialogOpen}
        onOpenChange={setBlueskyDialogOpen}
        onConnect={handleBlueskyConnect}
        isConnecting={connecting === "Bluesky"}
      />

      {/* Loading State */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: platforms.length }).map((_, index) => (
            <Card key={index} className="h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {platforms.map((platform) => {
            const platformAccounts = getAccountsByPlatform(platform.name);
            const isConnecting = connecting === platform.name;
            const isRefreshingAll = refreshingAllPlatform === platform.name;

            return (
              <PlatformConnectionCard
                key={platform.name}
                platform={platform}
                connectedAccounts={platformAccounts}
                isConnecting={isConnecting}
                isRefreshing={isRefreshingAll}
                onConnect={() => handleConnect(platform.name)}
                onRefresh={() => handleRefreshAll(platform.name)}
                onDisconnect={handleDisconnect}
              />
            );
          })}
        </div>
      )}

      {/* Additional Info */}
      <div className="mt-6 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground sm:mt-8 sm:p-5">
        <p>
          Connect multiple accounts per platform for different brands or
          projects — every connected account becomes a publishing target when
          you{" "}
          <a
            href="/scheduler/posts/create"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            create a post
          </a>
          . Tokens refresh automatically; if a platform revokes access, hit the
          refresh icon on its card or reconnect the account.
        </p>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsPageSkeleton />}>
      <ConnectionsPageContent />
    </Suspense>
  );
}
