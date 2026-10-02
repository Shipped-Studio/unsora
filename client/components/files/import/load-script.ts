/** Loads a third-party script once. Later calls reuse the same promise. */
const loading = new Map<string, Promise<void>>();

export function loadScript(
  src: string,
  attributes: Record<string, string> = {},
): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Scripts can only load in the browser."));
  }
  const existing = loading.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    for (const [name, value] of Object.entries(attributes)) {
      script.setAttribute(name, value);
    }
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      script.remove();
      reject(new Error("Couldn't load the file picker. Check your connection or ad blocker."));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}
