import { Plugs } from "@phosphor-icons/react";
import { ClaudeIcon, OpenAIIcon } from "@/components/icons";

/**
 * The AI app (ChatGPT, Claude, …) behind an MCP connector sign-in. A new
 * account doesn't connect straight away: it sets Unsora up first, then
 * connects again from the app. /onboarding carries which app in `?connect=`.
 */
export const CONNECT_PARAM = "connect";

export interface ConnectorApp {
  key: string;
  name: string;
  /** Where to go back to, for known apps. */
  url: string | null;
  icon: React.ComponentType<{ className?: string }>;
}

const KNOWN: Record<string, Omit<ConnectorApp, "key">> = {
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com", icon: OpenAIIcon },
  claude: { name: "Claude", url: "https://claude.ai", icon: ClaudeIcon },
};

/** The app for a `?connect=` key; unknown keys get a generic one. */
export function connectorApp(key: string | null): ConnectorApp | null {
  if (!key) return null;
  return key in KNOWN
    ? { key, ...KNOWN[key] }
    : { key: "app", name: "your AI app", url: null, icon: Plugs };
}

/** The `?connect=` key for the app an OAuth `redirect_uri` hands back to. */
export function connectorAppKey(redirectUri: string): string {
  try {
    const host = new URL(redirectUri).hostname.replace(/^www\./, "");
    if (host === "chatgpt.com" || host.endsWith(".openai.com")) return "chatgpt";
    if (host === "claude.ai" || host.endsWith(".anthropic.com")) return "claude";
  } catch {
    // Unknown app.
  }
  return "app";
}

/**
 * The app a sign-in's `redirect_url` is connecting, or null when it isn't a
 * connector's OAuth flow: our consent screen, or Clerk's /oauth/authorize on
 * its way there. Both carry the app's `redirect_uri`.
 */
export function connectorFromRedirect(redirectUrl: string | null): ConnectorApp | null {
  if (!redirectUrl) return null;
  try {
    // Any base works: only the path and its params matter, and this also
    // runs on the server.
    const url = new URL(redirectUrl, "https://app.invalid");
    if (!url.pathname.startsWith("/oauth-consent") && !url.pathname.startsWith("/oauth/")) {
      return null;
    }
    const redirectUri = url.searchParams.get("redirect_uri");
    return redirectUri ? connectorApp(connectorAppKey(redirectUri)) : null;
  } catch {
    return null;
  }
}
