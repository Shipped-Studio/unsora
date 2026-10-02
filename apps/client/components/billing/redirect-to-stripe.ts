import { toast } from "sonner";

/**
 * Awaits a Stripe endpoint that answers `{ url }` and sends the browser there.
 * On any failure it shows the server's error and resolves to false, so the
 * caller can clear its loading state. Resolves to true once redirecting.
 */
export async function redirectToStripe(
  request: Promise<Response>,
  errorTitle: string,
): Promise<boolean> {
  try {
    const res = await request;
    const data = await res.json().catch(() => null);
    if (typeof data?.url === "string" && data.url) {
      window.location.href = data.url;
      return true;
    }
    toast.error(errorTitle, {
      description: data?.error || "Try again in a moment.",
    });
  } catch {
    toast.error(errorTitle, {
      description: "Check your connection and try again.",
    });
  }
  return false;
}
