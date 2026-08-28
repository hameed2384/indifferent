import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

export default function Watch() {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get("/public/debates");
        if (mounted) setDebates(data.debates || []);
      } catch {
        /* keep whatever was already loaded; next poll tries again */
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 8000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const live = debates.filter((d) => d.status === "active");
  const ended = debates.filter((d) => d.status !== "active");

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="btn-ghost text-sm" data-testid="nav-home">← indifferent</button>
          <div className="font-heading text-sm font-medium">The Watch</div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(user ? "/dashboard" : "/")} className="btn-primary text-sm" data-testid="nav-enter">
              {user ? "Dashboard" : "Sign in"}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="eyebrow">Public debates</div>
        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-semibold mt-2">
          Live on the record.
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--fg-muted)]">
          Debaters who opted in. Watch, react, and drop comments — the AI coach whispers only to the participants,
          keeping the conversation honest.
        </p>

        {loading && <div className="mt-12 text-sm text-[var(--fg-subtle)]">Loading feed…</div>}

        {!loading && debates.length === 0 && (
          <div className="mt-12 card p-10 text-center">
            <div className="eyebrow">Nothing to watch yet</div>
            <div className="font-heading text-xl sm:text-2xl mt-2">Be the first debate on the record.</div>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">Any debater can publish their room live from inside the chat.</p>
          </div>
        )}

        {live.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live now</span>
              <span className="text-xs text-[var(--fg-subtle)]">{live.length} active</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {live.map((d) => (
                <DebateCard key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />
              ))}
            </div>
          </section>
        )}

        {ended.length > 0 && (
          <section className="mt-14">
            <div className="eyebrow mb-4">Recently ended</div>
            <div className="grid md:grid-cols-2 gap-4">
              {ended.map((d) => (
                <DebateCard key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function DebateCard({ d, onClick }) {
  const isLive = d.status === "active";
  return (
    <button
      onClick={onClick}
      data-testid={`watch-card-${d.room_id}`}
      className="card p-5 text-left hover:border-[var(--fg)] transition-colors"
    >
      <div className="flex items-center justify-between text-xs">
        {isLive
          ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span>
          : <span className="chip">Ended</span>}
        <span className="text-[var(--fg-subtle)]">{d.spectator_count} watching · {d.likes} ♥</span>
      </div>
      <div className="mt-4 font-heading text-lg font-semibold leading-snug line-clamp-2">
        "{d.topics?.[0] || "An unrecorded disagreement"}"
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <SideMini side="A" info={d.side_a} />
        <SideMini side="B" info={d.side_b} align="right" />
      </div>
    </button>
  );
}

function SideMini({ side, info, align }) {
  return (
    <div className={`${align === "right" ? "text-right" : ""} truncate`}>
      <div className="text-[10px] uppercase tracking-widest text-[var(--fg-subtle)]">Side {side}</div>
      <div className="font-medium truncate">{info.display_name}</div>
      {info.stance && (
        <div className="text-[11px] text-[var(--fg-subtle)] font-mono-ui">
          e {info.stance.economic?.toFixed?.(1)} · s {info.stance.social?.toFixed?.(1)}
        </div>
      )}
    </div>
  );
}
