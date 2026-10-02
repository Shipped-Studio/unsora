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
