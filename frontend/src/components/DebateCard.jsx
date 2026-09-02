import { Heart } from "lucide-react";

// A fixed small palette keyed by category, not random — same category
// always reads as the same color, giving the feed a bit of visual rhythm
// without needing a real thumbnail image (debates aren't recorded
// server-side in a way that gives a poster frame for a live one).
const PALETTE = [
  "from-[#1a2e2a] to-[#0a0a0a]",
  "from-[#2a1a2e] to-[#0a0a0a]",
  "from-[#1a1e2e] to-[#0a0a0a]",
  "from-[#2e2a1a] to-[#0a0a0a]",
  "from-[#2e1a1a] to-[#0a0a0a]",
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
      <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br ${paletteFor(d.categories?.[0])} ring-1 ring-white/5 group-hover:ring-white/15 transition-all`}>
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
          <div className="font-heading text-sm font-semibold leading-snug line-clamp-2">
            "{d.topics?.[0] || "An unrecorded disagreement"}"
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
