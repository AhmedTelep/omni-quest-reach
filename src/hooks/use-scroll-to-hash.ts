import { useEffect } from "react";

/**
 * Scrolls to the element matching window.location.hash and briefly highlights it.
 * Re-runs whenever `deps` change (use this so it triggers after async data loads).
 */
export function useScrollToHash(deps: ReadonlyArray<unknown> = []) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    let cancelled = false;
    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      const el = document.getElementById(hash);
      if (!el) {
        if (attempt < 20) setTimeout(() => tryScroll(attempt + 1), 100);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-md", "transition-shadow");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      }, 2500);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}