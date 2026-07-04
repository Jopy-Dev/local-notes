import { useSyncExternalStore } from "react";

/* Resize/collapse active only at the desktop breakpoint (REQ-034; DS 4.3). */
const DESKTOP_QUERY = "(min-width: 1280px)";

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
