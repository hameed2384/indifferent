import { useState } from "react";

const STORAGE_KEY = "indifferent-sidenav-collapsed";

/** Shared by every page that renders SideNav (Watch, Claims). One hamburger
 * button, two different meanings depending on viewport: on desktop it
 * toggles the persisted icon-rail/full-rail width; on mobile — where the
 * rail isn't shown at all normally — it opens a slide-in drawer instead.
 * Routed by an actual viewport check at click-time rather than two separate
 * buttons, since there's only ever one hamburger in the header. */
export function useSideNavToggle() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () => {
    const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) {
      setCollapsed((v) => {
        const next = !v;
        try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
        return next;
      });
    } else {
      setMobileOpen((v) => !v);
    }
  };

  return { collapsed, mobileOpen, toggle, closeMobile: () => setMobileOpen(false) };
}
