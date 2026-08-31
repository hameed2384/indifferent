import { Heart } from "lucide-react";

export default function DebateCard({ d, onClick }) {
  const isLive = d.status === "active";
  const isArchived = d.archive_visibility === "public" || d.archive_visibility === "unlisted";
  return (
    <button
      onClick={onClick}
      data-testid={`debate-card-${d.room_id}`}
      className="card p-5 text-left hover:border-[var(--fg)] transition-colors w-full"
    >
      <div className="flex items-center justify-between text-xs gap-2">
        {isLive
          ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span>
          : <span className="chip">{isArchived ? "Published" : "Ended"}</span>}
        <span className="text-[var(--fg-subtle)] truncate inline-flex items-center gap-1">{d.spectator_count ?? 0} {isLive ? "viewers" : "views"} · {d.likes ?? 0} <Heart className="w-3 h-3" /></span>
      </div>
      {d.categories?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.categories.map((c) => (
            <span key={c} className="chip !py-0.5 !px-2 !text-[10px]">{c}</span>
          ))}
        </div>
      )}
      <div className="mt-3 font-heading text-lg font-semibold leading-snug line-clamp-2">
        "{d.topics?.[0] || "An unrecorded disagreement"}"
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <SideMini info={d.side_a} label="Side A" />
        <SideMini info={d.side_b} label="Side B" align="right" />
      </div>
    </button>
  );
}

function SideMini({ info, label, align }) {
  return (
    <div className={`${align === "right" ? "text-right" : ""} truncate`}>
      <div className="text-[10px] uppercase tracking-widest text-[var(--fg-subtle)]">{label}</div>
      {info?.open ? (
        <div className="text-[var(--fg-subtle)] italic truncate">Open seat</div>
      ) : (
        <>
          <div className="font-medium truncate">{info?.display_name}</div>
          {info?.stance && (
            <div className="text-[11px] text-[var(--fg-subtle)] font-mono-ui">
              e {info.stance.economic?.toFixed?.(1)} · s {info.stance.social?.toFixed?.(1)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
