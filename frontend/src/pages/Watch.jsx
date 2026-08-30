import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import DebateCard from "@/components/DebateCard";
import AdSlot from "@/components/AdSlot";
import SideNav from "@/components/SideNav";
import { useSideNavToggle } from "@/hooks/use-sidenav";
import { readNotInterested } from "@/lib/notInterested";
import { startGoogleLogin } from "@/lib/auth";

/** Interleaves one ad card into a feed row at a fixed position, YouTube-style
 * — only when the row has enough real cards for it not to dominate. */
function withAd(cards, afterIndex = 2) {
  if (cards.length <= afterIndex) return cards;
  const out = cards.slice(0, afterIndex + 1);
  out.push(<AdSlot key="ad-slot" variant="card" />);
  out.push(...cards.slice(afterIndex + 1));
  return out;
}

export default function Watch() {
  const [debates, setDebates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [excluded] = useState(readNotInterested);
  const [showGoLive, setShowGoLive] = useState(false);
  const { collapsed: sidebarCollapsed, mobileOpen: mobileNavOpen, toggle: toggleSidebar, closeMobile } = useSideNavToggle();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const findMatch = () => {
    if (!user.id_verified) return navigate("/verify");
    navigate("/match");
  };

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const params = {};
        if (activeCategory) params.category = activeCategory;
        if (search.trim()) params.q = search.trim();
        const { data } = await api.get("/public/debates", { params });
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
  }, [activeCategory, search]);

  const visible = useMemo(
    () => debates.filter((d) => !d.categories?.some((c) => excluded.has(c))),
    [debates, excluded]
  );
  const live = visible.filter((d) => d.status === "active");
  const published = visible.filter((d) => d.status !== "active" && d.archive_visibility === "public");
  const featured = useMemo(
    () => [...visible].sort((x, y) => ((y.likes ?? 0) + (y.spectator_count ?? 0)) - ((x.likes ?? 0) + (x.spectator_count ?? 0))).slice(0, 4),
    [visible]
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--fg)] focus:text-[var(--bg)] focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="btn-ghost !px-2.5 shrink-0"
            data-testid="btn-toggle-sidenav"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <button onClick={() => navigate("/")} className="font-heading text-xl font-semibold tracking-tight shrink-0" data-testid="nav-home">
            indifferent
          </button>
          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <input
              data-testid="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search debates…"
              className="field !py-2 w-full !rounded-full"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {user?.is_debater && (
              <button onClick={() => setShowGoLive(true)} className="btn-accent text-sm" data-testid="btn-go-live">Go Live</button>
            )}
            <ThemeToggle />
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
        <input
          data-testid="search-input-mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search debates…"
          className="field !py-1.5 !rounded-full w-full sm:hidden mx-4 mb-3"
          style={{ width: "calc(100% - 2rem)" }}
        />
        {categories.length > 0 && (
          <div className="px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveCategory(null)}
              className={activeCategory === null ? "chip-accent shrink-0" : "chip shrink-0"}
              data-testid="category-all"
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c === activeCategory ? null : c)}
                className={c === activeCategory ? "chip-accent shrink-0" : "chip shrink-0"}
                data-testid={`category-${c}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </nav>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" data-testid="mobile-sidenav-overlay">
          <SideNav onClose={closeMobile} />
          <button className="flex-1 bg-black/50" onClick={closeMobile} aria-label="Close menu" />
        </div>
      )}

      <div className="flex items-start">
        <div className="hidden md:block">
          <SideNav collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
        </div>

        <main id="main-content" className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {!user && (
            <div className="card p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-testid="explainer-banner">
              <div>
                <div className="eyebrow mb-1">What is this?</div>
                <div className="font-heading text-lg sm:text-xl font-semibold">Find someone who disagrees with you. On camera. Live.</div>
                <p className="text-sm text-[var(--fg-muted)] mt-1 max-w-xl">
                  Indifferent matches you with the sharpest opposing viewpoint for a real debate — or browse Claim Trees, video arguments that fork into video rebuttals instead of a comment section.
                </p>
              </div>
              <button onClick={startGoogleLogin} className="btn-primary text-sm shrink-0" data-testid="explainer-sign-in">Sign in to start</button>
            </div>
          )}

          {user && (
            <div className="card p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-testid="match-banner">
              <div>
                <div className="eyebrow mb-1">Ready when you are</div>
                <div className="font-heading text-lg sm:text-xl font-semibold">Find your sharpest opposing viewpoint.</div>
                <p className="text-sm text-[var(--fg-muted)] mt-1 max-w-xl">One click and we'll match you with someone who disagrees, for a real debate.</p>
              </div>
              <button onClick={findMatch} className="btn-accent text-sm shrink-0" data-testid="btn-find-match">Find my opposite</button>
            </div>
          )}

          {loading && <div className="mt-4 text-sm text-[var(--fg-subtle)]">Loading feed…</div>}

          {!loading && visible.length === 0 && (
            <div className="mt-4 card p-10 text-center">
              <div className="eyebrow">Nothing to watch yet</div>
              <div className="font-heading text-xl sm:text-2xl mt-2">
                {search || activeCategory ? "No debates match that." : "Be the first debate on the record."}
              </div>
              {!search && !activeCategory && (
                <p className="mt-3 text-sm text-[var(--fg-muted)]">
                  No one's live right now. <button onClick={() => navigate("/claims")} className="text-[var(--accent)] hover:underline font-medium">Check Claim Trees</button> for video arguments you can jump into any time.
                </p>
              )}
            </div>
          )}

          {live.length > 0 && (
            <Row title="Live now" badge={`${live.length} active`} accent>
              {live.map((d) => <DebateCard key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />)}
            </Row>
          )}

          {featured.length > 0 && !activeCategory && !search && (
            <Row title="Featured for you">
              {withAd(featured.map((d) => <DebateCard key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />))}
            </Row>
          )}

          {published.length > 0 && (
            <Row title="Previously published">
              {withAd(published.map((d) => <DebateCard key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />))}
            </Row>
          )}
        </main>
      </div>

      {showGoLive && (
        <GoLiveModal
          categories={categories}
          onClose={() => setShowGoLive(false)}
          onStarted={(roomId) => navigate(`/room/${roomId}`)}
        />
      )}
    </div>
  );
}

function Row({ title, badge, accent, children }) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="flex items-center gap-2 mb-4">
        {accent
          ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> {title}</span>
          : <div className="eyebrow">{title}</div>}
        {badge && <span className="text-xs text-[var(--fg-subtle)]">{badge}</span>}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}

function GoLiveModal({ categories, onClose, onStarted }) {
  const [category, setCategory] = useState(categories[0] || "");
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post("/rooms/golive", { category });
      onStarted(data.room_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't go live");
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Go live</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Pick a category</h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">You're immediately live and discoverable — no scheduling.</p>
        <div className="mt-6 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`py-2 rounded-lg border text-sm font-medium transition ${category === c ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]" : "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"}`}
              data-testid={`golive-category-${c}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="golive-cancel">Cancel</button>
          <button className="btn-accent" onClick={start} disabled={!category || starting} data-testid="golive-start">
            {starting ? "Going live…" : "Go live"}
          </button>
        </div>
      </div>
    </div>
  );
}
