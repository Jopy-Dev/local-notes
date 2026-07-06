import { useSyncExternalStore } from "react";

/*
 * Resize/collapse active across the whole supported viewport range
 * (REQ-034; DS 4.3 v1.5): 1024px is the REQ-031 supported minimum, and
 * display scaling routinely puts real windows under 1280 CSS px - the
 * original desktop-only gate made dividers inert for those users
 * (user feedback round 1).
 */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DESKTOP_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
