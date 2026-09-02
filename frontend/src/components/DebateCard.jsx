import { Heart } from "lucide-react";

function SideAvatar({ info }) {
  if (info?.open) {
    return (
      <div className="w-11 h-11 rounded-full border-2 border-dashed border-[var(--fg-subtle)]/50 flex items-center justify-center shrink-0" />
    );
  }
  return (
    <div className="w-11 h-11 rounded-full bg-[var(--bg-muted)] border border-[var(--border-strong)] flex items-center justify-center text-sm font-semibold text-[var(--fg-muted)] shrink-0">
      {(info?.display_name || "?")[0]?.toUpperCase()}
    </div>
  );
}

function SidePreview({ info, align }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 min-w-0 ${align === "right" ? "items-end" : "items-start"}`}>
      <SideAvatar info={info} />
      <span className="text-[11px] text-[var(--fg-muted)] truncate max-w-[80px]">{info?.open ? "Open seat" : info?.display_name}</span>
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
      className="card overflow-hidden text-left hover:border-[var(--fg)] transition-colors w-full p-0"
    >
      {/* A YouTube-thumbnail-shaped preview — no recorded/live frame to show
          here (debates aren't captured server-side, see RecordedDebatePlayer
          for what IS available once a debate ends), so this is a stylized
          stand-in: both sides' avatars, live/status badge and viewer count
          overlaid the same way a real video thumbnail would carry them. */}
      <div className="relative aspect-video bg-[#111]">
        <div className="absolute top-2 left-2">
          {isLive
            ? <span className="chip-accent !bg-black/60"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span>
            : <span className="chip !bg-black/60 !border-white/10 !text-white/80">{isArchived ? "Published" : "Ended"}</span>}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
          {d.spectator_count ?? 0} {isLive ? "viewers" : "views"} · {d.likes ?? 0} <Heart className="w-2.5 h-2.5" />
        </div>
        <div className="h-full w-full flex items-center justify-center gap-5 px-4">
          <SidePreview info={d.side_a} />
          <span className="text-[10px] font-semibold text-[var(--fg-subtle)] shrink-0">VS</span>
          <SidePreview info={d.side_b} align="right" />
        </div>
      </div>

      <div className="p-4">
        {d.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.categories.map((c) => (
              <span key={c} className="chip !py-0.5 !px-2 !text-[10px]">{c}</span>
            ))}
          </div>
        )}
        <div className="mt-2 font-heading text-base font-semibold leading-snug line-clamp-2">
          "{d.topics?.[0] || "An unrecorded disagreement"}"
        </div>
      </div>
    </button>
  );
}
