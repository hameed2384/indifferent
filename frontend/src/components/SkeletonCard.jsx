import { FEED_GRID } from "@/lib/layout";

/** Loading placeholders for the two primary feed grids (Watch, Claims) —
 * both used to pop content in against a bare "Loading…" line with nothing
 * to anchor to. Shapes roughly match DebateCard/ClaimCard's own layout so
 * the swap-in doesn't visibly reflow. */
export function DebateCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse" aria-hidden="true">
      <div className="w-full aspect-video bg-[var(--bg-muted)]" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 w-16 rounded-full bg-[var(--bg-muted)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}

export function ClaimCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse" aria-hidden="true">
      <div className="w-full aspect-video bg-[var(--bg-muted)]" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 w-16 rounded-full bg-[var(--bg-muted)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--bg-muted)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ Skeleton, count = 8 }) {
  return (
    <div className={FEED_GRID}>
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} />)}
    </div>
  );
}
