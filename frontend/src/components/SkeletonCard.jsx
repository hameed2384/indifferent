import { FEED_GRID } from "@/lib/layout";

/** Loading placeholders for the two primary feed grids (Watch, Claims) —
 * both used to pop content in against a bare "Loading…" line with nothing
 * to anchor to. Shapes roughly match DebateCard/ClaimCard's own layout so
 * the swap-in doesn't visibly reflow. */
export function DebateCardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="w-full aspect-video rounded-xl bg-[var(--bg-muted)]" />
      <div className="mt-2.5 flex gap-2.5">
        <div className="w-5 h-5 rounded-full bg-[var(--bg-muted)] shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-1/4 rounded bg-[var(--bg-muted)]" />
          <div className="h-3.5 w-4/5 rounded bg-[var(--bg-muted)]" />
          <div className="h-3.5 w-3/5 rounded bg-[var(--bg-muted)]" />
          <div className="h-3 w-2/5 rounded bg-[var(--bg-muted)]" />
        </div>
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

/** Avatar + name row placeholder for list-shaped views (Friends, Admin's
 * user table) — the other common loading shape besides a card grid. */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-1.5 animate-pulse" aria-hidden="true">
      <div className="w-8 h-8 rounded-full bg-[var(--bg-muted)] shrink-0" />
      <div className="h-3.5 w-1/3 rounded bg-[var(--bg-muted)]" />
    </div>
  );
}

export function RowSkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <RowSkeleton key={i} />)}
    </div>
  );
}
