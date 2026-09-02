import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Radio, Search, Shuffle, Swords, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import DebateCard from "@/components/DebateCard";
import { DebateCardSkeleton, SkeletonGrid } from "@/components/SkeletonCard";
import AdSlot from "@/components/AdSlot";
import SideNav from "@/components/SideNav";
import Logo from "@/components/Logo";
import { useSideNavToggle } from "@/hooks/use-sidenav";
import { readNotInterested } from "@/lib/notInterested";
import { startGoogleLogin } from "@/lib/auth";
import { STICKY_NAV, useNavHeightVar } from "@/lib/navChrome";
import { useModalA11y } from "@/hooks/useModalA11y";
import { CONTAINER_WIDE, FEED_GRID } from "@/lib/layout";

/** Interleaves one ad card into a feed row at a fixed position, YouTube-style
 * — only when the row has enough real cards for it not to dominate. */
function withAd(cards, afterIndex = 2) {
  if (cards.length <= afterIndex) return cards;
  const out = cards.slice(0, afterIndex + 1);
  out.push(<AdSlot key="ad-slot" variant="card" />);
  out.push(...cards.slice(afterIndex + 1));
  return out;
}

function PersonCard({ p, onClick }) {
  return (
    <button onClick={onClick} className="card p-4 flex items-center gap-3 text-left hover:border-[var(--fg)] transition-colors" data-testid={`person-result-${p.user_id}`}>
      {p.picture
        ? <img src={p.picture} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
        : <span className="w-11 h-11 rounded-full bg-[var(--bg-muted)] shrink-0 flex items-center justify-center font-medium text-[var(--fg-subtle)]">{(p.display_name || "?")[0]?.toUpperCase()}</span>}
      <div className="min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {p.display_name}
          {p.is_debater && <span className="chip-accent !py-0 !px-1.5 text-[10px] shrink-0">Debater</span>}
        </div>
        {p.handle && <div className="text-xs text-[var(--fg-subtle)] truncate">@{p.handle}</div>}
      </div>
    </button>
  );
}

export default function Watch() {
  const [debates, setDebates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [excluded] = useState(readNotInterested);
  const [showGoLive, setShowGoLive] = useState(false);
  const [feedTrouble, setFeedTrouble] = useState(false);
  const { collapsed: sidebarCollapsed, mobileOpen: mobileNavOpen, toggle: toggleSidebar, closeMobile } = useSideNavToggle();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navRef = useRef(null);
  useNavHeightVar(navRef);

  const findMatch = () => {
    if (!user.id_verified) return navigate("/verify");
    navigate("/match");
  };

  const goLive = () => {
    if (!user.id_verified) return navigate("/verify");
    if (!user.is_debater) {
      toast.info("Become a debater in Settings first");
      navigate("/settings");
      return;
    }
    setShowGoLive(true);
  };

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  // Separate from the debate feed's own load effect below on purpose: this
  // doesn't care about activeCategory, and shouldn't re-run on that feed's
  // 8s live poll — a person's name/handle isn't going to change that fast.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setPeople([]); return; }
    let mounted = true;
    api.get("/users/search", { params: { q: term } })
      .then(({ data }) => { if (mounted) setPeople(data.users || []); })
      .catch(() => { if (mounted) setPeople([]); });
    return () => { mounted = false; };
  }, [search]);

  useEffect(() => {
    let mounted = true;
    let failStreak = 0;
    const load = async () => {
      try {
        const params = {};
        if (activeCategory) params.category = activeCategory;
        if (search.trim()) params.q = search.trim();
        const { data } = await api.get("/public/debates", { params });
        if (!mounted) return;
        setDebates(data.debates || []);
        failStreak = 0;
        setFeedTrouble(false);
      } catch {
        // A single missed poll isn't worth alarming anyone about — the feed
        // just goes stale for 8s and quietly retries. Only surface it once
        // that's happened enough in a row to actually mean something.
        failStreak += 1;
        if (mounted && failStreak >= 3) setFeedTrouble(true);
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
      <nav ref={navRef} className={STICKY_NAV}>
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
          <Logo data-testid="nav-home" />
          <div className="flex-1 max-w-xl hidden sm:block relative">
            <Search className="w-4 h-4 text-[var(--fg-subtle)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              data-testid="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search debates or people…"
              className="field !py-2 !pl-9 w-full !rounded-full"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {user && <StartDebateMenu onGoLive={goLive} onFindMatch={findMatch} />}
            <ThemeToggle />
            {user && <NotificationBell />}
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
        <div className="relative sm:hidden mx-4 mb-3">
          <Search className="w-4 h-4 text-[var(--fg-subtle)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            data-testid="search-input-mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search debates or people…"
            className="field !py-1.5 !pl-9 !rounded-full w-full"
          />
        </div>
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
        {/* self-stretch: position:sticky only has room to move within a
            containing block taller than itself. items-start on this row
            keeps main's own height content-driven (correct), but as a side
            effect it also left this wrapper shrunk to exactly SideNav's own
            height, giving the sticky sidebar nowhere to travel — it just
            scrolled off with the page instead of sticking. Stretching only
            this wrapper to the row's full height (== main's height) fixes
            it without touching main's alignment. */}
        <div className="hidden md:block self-stretch">
          <SideNav collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
        </div>

        <main id="main-content" className={`flex-1 min-w-0 ${CONTAINER_WIDE} mx-auto px-4 sm:px-6 py-8`}>
          {!user && (
            <div className="card p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" data-testid="explainer-banner">
              <div>
                <div className="eyebrow mb-1">What is this?</div>
                <div className="font-heading text-lg sm:text-xl font-semibold">Find someone who disagrees with you. On camera. Live.</div>
                <p className="text-sm text-[var(--fg-muted)] mt-1 max-w-xl">
                  indifferent matches you with the sharpest opposing viewpoint for a real debate — or browse Claim Trees, video arguments that fork into video rebuttals instead of a comment section.
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

          {feedTrouble && (
            <div className="mt-4 text-sm text-[var(--fg-subtle)] flex items-center gap-2" data-testid="feed-trouble-banner">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] shrink-0" />
              Having trouble reaching the server — retrying…
            </div>
          )}

          {loading && <div className="mt-4"><SkeletonGrid Skeleton={DebateCardSkeleton} /></div>}

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

          {people.length > 0 && (
            <Row title="People">
              {people.map((p) => <PersonCard key={p.user_id} p={p} onClick={() => navigate(`/u/${p.user_id}`)} />)}
            </Row>
          )}
          {people.length === 0 && search.trim().length >= 2 && (
            <p className="text-sm text-[var(--fg-subtle)] mb-6" data-testid="no-people-found">No one matches "{search.trim()}".</p>
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

/** Icon-only trigger, mirrors AccountMenu's hand-rolled dropdown (same
 * click-outside behavior and styling) rather than the two actions
 * competing for nav space as separate buttons — one is a debater-only
 * broadcast, the other is matchmaking anyone can use, and both start
 * a debate, so they share one entry point instead of two. */
function StartDebateMenu({ onGoLive, onFindMatch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-accent !px-2.5 sm:!px-4 inline-flex items-center gap-1.5"
        title="Start a debate"
        aria-label="Start a debate"
        data-testid="btn-start-debate-menu"
      >
        <Swords className="w-4 h-4" />
        <span className="hidden sm:inline">Start a debate</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 card p-1 shadow-lg z-50" data-testid="start-debate-menu">
          <button
            onClick={() => { setOpen(false); onGoLive(); }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-muted)] inline-flex items-start gap-2.5"
            data-testid="menu-go-live"
          >
            <Radio className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0" />
            <span>
              <span className="block text-sm font-medium">Go live</span>
              <span className="block text-xs text-[var(--fg-subtle)]">Broadcast now, no matching</span>
            </span>
          </button>
          <button
            onClick={() => { setOpen(false); onFindMatch(); }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-muted)] inline-flex items-start gap-2.5"
            data-testid="menu-find-match"
          >
            <Shuffle className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0" />
            <span>
              <span className="block text-sm font-medium">Find your match</span>
              <span className="block text-xs text-[var(--fg-subtle)]">We'll pair you with someone who disagrees</span>
            </span>
          </button>
        </div>
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
      <div className={FEED_GRID}>{children}</div>
    </section>
  );
}

function GoLiveModal({ categories, onClose, onStarted }) {
  const [category, setCategory] = useState(categories[0] || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [starting, setStarting] = useState(false);
  const modalRef = useModalA11y(onClose);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post("/rooms/golive", {
        category, title: title.trim(), description: description.trim() || undefined,
      });
      onStarted(data.room_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't go live");
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Go live" className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Go live</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Pick a category</h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">You're immediately live and discoverable — no scheduling.</p>
        <div className="mt-6 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`py-2 rounded-lg border text-sm font-medium transition inline-flex items-center justify-center gap-1.5 ${category === c ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]" : "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"}`}
              data-testid={`golive-category-${c}`}
            >
              <Tag className="w-3.5 h-3.5" /> {c}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label className="text-xs text-[var(--fg-subtle)]" htmlFor="golive-title">What are you debating?</label>
          <input
            id="golive-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. Is remote work actually better for productivity?"
            className="field mt-1 w-full !py-2"
            data-testid="golive-title-input"
          />
        </div>
        <div className="mt-4">
          <label className="text-xs text-[var(--fg-subtle)]" htmlFor="golive-description">Description (optional)</label>
          <textarea
            id="golive-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add context viewers will see when they open the stream…"
            className="textarea mt-1 w-full"
            data-testid="golive-description-input"
          />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="golive-cancel">Cancel</button>
          <button className="btn-accent" onClick={start} disabled={!category || !title.trim() || starting} data-testid="golive-start">
            {starting ? "Going live…" : "Go live"}
          </button>
        </div>
      </div>
    </div>
  );
}
