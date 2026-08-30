// Shared nav-bar chrome — a single source of truth so the sticky-header
// treatment can't silently drift page to page (it used to be copy-pasted
// independently into 9+ files, two of which had quietly drifted to a
// different blur opacity for no reason).
export const STICKY_NAV = "sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]";
