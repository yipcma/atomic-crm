import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

// Resolved synchronously in the state initialiser rather than in an effect.
// Starting from `undefined` meant the first render always reported "not mobile"
// and only corrected after mount, so every phone-sized visit rendered the
// desktop tree, threw it away, and rendered the mobile one -- mounting the
// dashboard chart and kanban drag layer for nothing, and discarding the query
// cache along with them.
function matches(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(matches);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener("change", onChange);
    // Re-sync in case the viewport changed between render and effect.
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
