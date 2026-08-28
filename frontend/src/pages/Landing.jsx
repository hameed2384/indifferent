import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liveDebates, setLiveDebates] = useState([]);

  useEffect(() => {
    api.get("/public/debates").then(({ data }) => setLiveDebates(data.debates || [])).catch(() => {});
  }, []);

  const handleLogin = () => {
    // Direct Google OAuth (authorization-code flow). redirect_uri must be one
    // of the "Authorized redirect URIs" on the Google Cloud OAuth client, and
    // AuthCallback sends this exact same value back to the backend so it can
    // be replayed to Google's token endpoint (which requires an exact match).
    const redirectUri = window.location.origin + "/auth/callback";
    sessionStorage.setItem("google_oauth_redirect_uri", redirectUri);
    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleEnter = () => {
    if (!user) return handleLogin();
    if (!user.onboarded) return navigate("/onboarding");
    return navigate("/dashboard");
  };

  const live = liveDebates.filter((d) => d.status === "active");
  const heroDebates = liveDebates.slice(0, 4);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="font-heading text-lg font-semibold tracking-tight" data-testid="brand-mark">
            indifferent
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/watch")} className="btn-ghost text-sm" data-testid="nav-watch">
              Watch {live.length > 0 && <span className="ml-1 text-[var(--accent)]">· {live.length}</span>}
            </button>
            <button onClick={handleEnter} className="btn-primary text-sm" data-testid="nav-enter">
              {user ? "Dashboard" : "Sign in"}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-3xl">
          <div className="chip mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> A civil discourse experiment
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05]">
            Meet the person<br />you disagree with.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-[var(--fg-muted)] leading-relaxed max-w-xl">
            An AI reads how you actually think — from your own words — and pairs you, live and on video,
            with someone on the other side. No echo chambers. No anonymity theatre.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={handleEnter} className="btn-accent" data-testid="cta-get-matched">
              Get matched
            </button>
            <button onClick={() => navigate("/watch")} className="btn-outline" data-testid="cta-watch">
              Watch a debate
            </button>
          </div>
          <div className="mt-4 text-xs text-[var(--fg-subtle)]">
            Google sign-in · ID verification required · Video is peer-to-peer
          </div>
        </div>

        {/* Sides preview */}
        <div className="mt-14 grid md:grid-cols-2 gap-4">
          <SidePreview
            eyebrow="Side A"
            title="You are too comfortable."
            body="You scroll timelines that agree with you. You block the people who don't. Your worldview hasn't been tested in months."
            tone="dark"
          />
          <SidePreview
            eyebrow="Side B"
            title="Change my mind."
            body="Bring evidence, not slogans. The best conversations happen when both people risk being wrong out loud."
            tone="light"
          />
        </div>
      </section>

      {/* Live now */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-muted)]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
            <div>
              <div className="eyebrow mb-2">Public feed</div>
              <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-semibold">
                Watch strangers argue<br />better than the internet.
              </h2>
            </div>
            <button className="btn-outline" onClick={() => navigate("/watch")} data-testid="cta-watch-all">
              See all debates →
            </button>
          </div>

          {heroDebates.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="eyebrow">The public feed is quiet right now</div>
              <div className="font-heading text-xl sm:text-2xl mt-2">Be the first debate on the record.</div>
              <button onClick={handleEnter} className="btn-accent mt-6" data-testid="cta-empty-feed">
                Start a debate
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {heroDebates.map((d) => (
                <DebatePreviewCard key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="eyebrow mb-2">How it works</div>
        <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-semibold max-w-3xl">
          Three steps to a conversation that might change your mind.
        </h2>
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {[
            { n: "01", h: "Tell us how you think", b: "Write freely, answer a short quiz. Gemini 3.1 Pro maps you on economic & social axes." },
            { n: "02", h: "Prove you're a person", b: "Upload a photo ID. Verified humans only — no bots or burner mobs." },
            { n: "03", h: "Meet your opposite", b: "We find someone across the aisle. Video, audio, text. AI suggests prompts and coaches civility." },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <div className="text-sm font-mono-ui text-[var(--fg-subtle)]">{s.n}</div>
              <h3 className="font-heading text-xl font-semibold mt-3">{s.h}</h3>
              <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <button onClick={handleEnter} className="btn-accent" data-testid="cta-get-matched-secondary">
            Continue with Google
          </button>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--fg-subtle)]">
          <div>© 2026 Indifferent — All opinions welcome</div>
          <div>Civil discourse or nothing</div>
        </div>
      </footer>
    </div>
  );
}

function SidePreview({ eyebrow, title, body, tone }) {
  // Deliberately theme-independent: this is the landing page's own dark-vs-light
  // split motif (Side A / Side B), not the site's light/dark mode — every color
  // here is a fixed literal so it reads correctly regardless of the viewer's theme.
  const dark = tone === "dark";
  return (
    <div className={`rounded-xl p-8 md:p-10 ${dark ? "bg-[#0a0a0a] text-white" : "bg-white text-[#0a0a0a] border border-[#e5e7eb]"}`}>
      <div className={`text-[11px] font-medium uppercase tracking-[0.14em] ${dark ? "text-white/50" : "text-black/50"}`}>{eyebrow}</div>
      <div className={`font-heading text-2xl sm:text-3xl font-semibold mt-3 leading-tight`}>{title}</div>
      <p className={`mt-4 text-sm leading-relaxed ${dark ? "text-white/70" : "text-black/70"}`}>{body}</p>
    </div>
  );
}

function DebatePreviewCard({ d, onClick }) {
  const isLive = d.status === "active";
  return (
    <button
      onClick={onClick}
      data-testid={`hero-debate-${d.room_id}`}
      className="card p-5 text-left hover:border-[var(--fg)] transition-colors"
    >
      <div className="flex items-center justify-between text-xs">
        {isLive ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span> : <span className="chip">Ended</span>}
        <span className="text-[var(--fg-subtle)]">{d.spectator_count} watching · {d.likes} ♥</span>
      </div>
      <div className="mt-4 font-heading text-lg font-semibold leading-snug line-clamp-2">
        "{d.topics?.[0] || "An unrecorded disagreement"}"
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="truncate">
          <div className="text-[10px] uppercase tracking-widest text-[var(--fg-subtle)]">Side A</div>
          <div className="font-medium truncate">{d.side_a.display_name}</div>
        </div>
        <div className="truncate text-right">
          <div className="text-[10px] uppercase tracking-widest text-[var(--fg-subtle)]">Side B</div>
          <div className="font-medium truncate">{d.side_b.display_name}</div>
        </div>
      </div>
    </button>
  );
}
