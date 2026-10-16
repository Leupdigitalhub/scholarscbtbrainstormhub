// Single place that registers the install-only service worker (public/sw.js).
// Never registers in dev, iframes, or Lovable preview hosts; cleans up there instead.
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const h = window.location.hostname;
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => {
        if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
      }),
    ).catch(() => {});
    return;
  }
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}
