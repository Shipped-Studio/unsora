/**
 * Provider errors are often raw JSON, status codes or internal notes. Show a
 * plain line instead and keep the raw text for a tooltip.
 */
export function readableError(
  error: string,
  fallback = "Couldn't publish. Open the post for details.",
) {
  const raw = /[{}[\]"]|^\d{3}\b|sweeper|non-terminal|stack|exception/i.test(error);
  return raw || error.length > 140 ? fallback : error;
}
