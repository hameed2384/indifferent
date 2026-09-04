import { Heart } from "lucide-react";
import { isTitleConfirmed, titleFor } from "@/lib/debateTitle";

// Fallback for rooms with no d.thumbnail_url yet (ChatRoom.jsx captures one
// client-side a little into a live debate — ended-before-capture rooms and
// solo go-live rooms with the seat still open never get one). A fixed small
// palette keyed by category, not random — same category always reads as the
// same color, giving the feed a bit of visual rhythm even without a real
// thumbnail. Deliberately NOT theme-reactive (fixed dark tones even in light mode)
// — a thumbnail is content, not chrome, same as a real photo thumbnail
// wouldn't re-theme either. The end stop must NOT match either theme's
// page background: it used to fade to #0a0a0a, which is dark mode's
// exact --bg value — the card's true edge became invisible there, and
// different gradients disappearing by different amounts read as
// different-sized cards even though every card measured pixel-identical.
const PALETTE = [
  "from-[#1a2e2a] to-[#161616]",
  "from-[#2a1a2e] to-[#161616]",
  "from-[#1a1e2e] to-[#161616]",
  "from-[#2e2a1a] to-[#161616]",
  "from-[#2e1a1a] to-[#161616]",
];
function paletteFor(category) {
  if (!category) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function Avatar({ info }) {
  if (info?.open) {
    return <div className="w-5 h-5 rounded-full border border-dashed border-[var(--fg-subtle)]/60 shrink-0" />;
  }
  return (
    <div className="w-5 h-5 rounded-full bg-[var(--bg-muted)] border border-[var(--border-strong)] flex items-center justify-center text-[9px] font-semibold text-[var(--fg-muted)] shrink-0">
      {(info?.display_name || "?")[0]?.toUpperCase()}
    </div>
  );
}

export default function DebateCard({ d, onClick }) {
  const isLive = d.status === "active";
  const isArchived = d.archive_visibility === "public" || d.archive_visibility === "unlisted";
  return (
    <button
      onClick={onClick}
      data-testid={`debate-card-${d.room_id}`}
      className="text-left w-full group"
    >
      {/* Full-bleed like a real video thumbnail — no border, no internal
          padding/boxing, nothing floating inside it except the two small
          corner badges a real thumbnail would carry (live/status, and a
          stat badge standing in for YouTube's duration badge). "Who's
          debating" lives below, next to the title, the same place YouTube
          puts the channel identity — not inside the thumbnail itself. */}
      <div
        className={`relative aspect-video rounded-xl overflow-hidden border border-[var(--border-strong)] group-hover:border-[var(--fg-subtle)] transition-colors ${d.thumbnail_url ? "bg-black" : `bg-gradient-to-br ${paletteFor(d.categories?.[0])}`}`}
      >
        {d.thumbnail_url && (
          <img src={d.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {isLive && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-[var(--danger)] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
          {d.spectator_count ?? 0} {isLive ? "watching" : "views"} · {d.likes ?? 0} <Heart className="w-2.5 h-2.5" />
        </span>
      </div>

      <div className="mt-2.5 flex gap-2.5">
        <div className="flex items-center -space-x-1 shrink-0 mt-0.5">
          <Avatar info={d.side_a} />
          <Avatar info={d.side_b} />
        </div>
        <div className="min-w-0">
          {/* Fixed h-3.5 whether or not the label renders — same lesson as
              min-h below: a row that only sometimes exists is exactly what
              made cards different heights last time. This tells a viewer
              the quoted text is still a pre-match AI guess, not a record of
              what was actually said, without a new backend mechanism —
              just reading data that already exists (see lib/debateTitle.js). */}
          <div className="h-3.5 text-[10px] uppercase tracking-wide text-[var(--fg-subtle)]">
            {!isTitleConfirmed(d) && "Suggested topic"}
          </div>
          {/* min-h, not just line-clamp-2: line-clamp only caps the MAX at
              two lines, it doesn't reserve a minimum — a one-line title
              collapsed shorter than a two-line one, so cards in the same
              row ended up different heights even though the grid's own
              stretch behavior was already uniform everywhere else. */}
          <div className="font-heading text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">
            "{titleFor(d)}"
          </div>
          <div className="mt-1 text-xs text-[var(--fg-subtle)] truncate">
            {d.side_a?.open ? "Open seat" : d.side_a?.display_name} vs {d.side_b?.open ? "Open seat" : d.side_b?.display_name}
          </div>
          <div className="mt-0.5 text-xs text-[var(--fg-subtle)] flex items-center gap-1.5">
            {isLive ? <span className="text-[var(--danger)] font-medium">Live</span> : <span>{isArchived ? "Published" : "Ended"}</span>}
            {d.categories?.[0] && <span>· {d.categories[0]}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}
