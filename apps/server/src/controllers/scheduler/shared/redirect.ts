const CLIENT_REDIRECT_URI =
  process.env.CLIENT_URL || "https://sadek.tryunsora.com";

export function schedulerConnectionsRedirect(
  provider: string,
  status: "success" | "error",
  error?: string,
) {
  const base = `${CLIENT_REDIRECT_URI}/scheduler/accounts?status=${status}&provider=${provider}`;
  if (!error) {
    return base;
  }

  return `${base}&error=${encodeURIComponent(error)}`;
}

/**
 * Redirect builder for an OAuth callback. Shared links (opened by someone who
 * may not have an Unsora login) end on the public /connected page instead of
 * the signed-in accounts page.
 */
export function connectRedirect(provider: string, connect: { shared: boolean } | null) {
  return (status: "success" | "error", error?: string): string => {
    if (!connect?.shared) return schedulerConnectionsRedirect(provider, status, error);
    const base = `${CLIENT_REDIRECT_URI}/connected?status=${status}&provider=${provider}`;
    return error ? `${base}&error=${encodeURIComponent(error)}` : base;
  };
}
