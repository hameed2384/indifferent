import { useEffect } from "react";

// Shared nav-bar chrome — a single source of truth so the sticky-header
// treatment can't silently drift page to page (it used to be copy-pasted
// independently into 9+ files, two of which had quietly drifted to a
// different blur opacity for no reason).
export const STICKY_NAV = "sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]";

// Publishes the sticky nav's real rendered height as a --nav-h CSS var on
// the document root, so a second sticky element (SideNav) can stick right
// below it instead of guessing a pixel value — the nav's height isn't
// constant (the category-chip row only renders once categories load, and
// can wrap onto two lines on narrower desktop widths).
export function useNavHeightVar(navRef) {
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--nav-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [navRef]);
}
