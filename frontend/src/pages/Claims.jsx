import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Menu, Plus, Search } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import SideNav from "@/components/SideNav";
import Logo from "@/components/Logo";
import { useSideNavToggle } from "@/hooks/use-sidenav";
import RecordClipModal from "@/components/RecordClipModal";
import { startGoogleLogin } from "@/lib/auth";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_WIDE } from "@/lib/layout";

function ClaimCard({ clip, onClick }) {
  return (
    <button onClick={onClick} className="card overflow-hidden text-left hover:border-[var(--fg)] transition-colors" data-testid={`claim-card-${clip.clip_id}`}>
      <video src={`${API}/clips/${clip.clip_id}/video`} muted preload="metadata" className="w-full aspect-video object-cover bg-black" />
      <div className="p-4">
        <span className="chip !py-0 !px-1.5 text-[10px]">{clip.category}</span>
        <div className="font-heading text-base font-semibold mt-2 line-clamp-2">"{clip.caption}"</div>
        <div className="text-xs text-[var(--fg-subtle)] mt-2 inline-flex items-center gap-1 flex-wrap">
          <span>{clip.uploader_name} ·</span> <Heart className="w-3 h-3" /> <span>{clip.likes} · {clip.reply_count} {clip.reply_count === 1 ? "rebuttal" : "rebuttals"}</span>
        </div>
      </div>
    </button>
  );
}

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const { collapsed: sidebarCollapsed, mobileOpen: mobileNavOpen, toggle: toggleSidebar, closeMobile } = useSideNavToggle();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  const load = () => {
    const params = {};
    if (activeCategory) params.category = activeCategory;
    if (search.trim()) params.q = search.trim();
    api.get("/clips/roots", { params })
      .then(({ data }) => setClaims(data.claims || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [activeCategory, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRecorder = () => {
    if (!user) { toast.info("Sign in to post a claim"); return; }
    setShowRecorder(true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--fg)] focus:text-[var(--bg)] focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <nav className={STICKY_NAV}>
        <div className="px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={toggleSidebar} className="btn-ghost !px-2.5 shrink-0" data-testid="btn-toggle-sidenav" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label="Toggle sidebar">
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <Logo data-testid="nav-home" />
          <div className="flex-1 max-w-xl mx-auto hidden sm:block relative">
            <Search className="w-4 h-4 text-[var(--fg-subtle)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              data-testid="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claims…"
              className="field !py-2 !pl-9 w-full !rounded-full"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button onClick={openRecorder} className="btn-accent !px-2.5 sm:!px-4 text-sm" data-testid="btn-new-claim" aria-label="State a claim">
              <Plus className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">State a claim</span>
            </button>
            <ThemeToggle />
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
            placeholder="Search claims…"
            className="field !py-1.5 !pl-9 !rounded-full w-full"
          />
        </div>
        {categories.length > 0 && (
          <div className="px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto">
            <button onClick={() => setActiveCategory(null)} className={activeCategory === null ? "chip-accent shrink-0" : "chip shrink-0"} data-testid="claims-category-all">All</button>
            {categories.map((c) => (
              <button key={c} onClick={() => setActiveCategory(c === activeCategory ? null : c)} className={c === activeCategory ? "chip-accent shrink-0" : "chip shrink-0"} data-testid={`claims-category-${c}`}>
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

        <main id="main-content" className={`flex-1 min-w-0 ${CONTAINER_WIDE} mx-auto px-4 sm:px-6 py-8`}>
          {loading && <div className="text-sm text-[var(--fg-subtle)]">Loading claims…</div>}

          {!loading && claims.length === 0 && (search.trim() || activeCategory) ? (
            <div className="card p-10 text-center">
              <div className="eyebrow">No matches</div>
              <div className="font-heading text-xl sm:text-2xl mt-2">No claims match your search.</div>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">Try a different term or category.</p>
            </div>
          ) : !loading && claims.length === 0 && (
            <div className="card p-10 text-center">
              <div className="eyebrow">Nothing here yet</div>
              <div className="font-heading text-xl sm:text-2xl mt-2">Be the first to say something worth arguing with.</div>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">State a claim on video — anyone can push back with a video of their own.</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {claims.map((c) => (
              <ClaimCard key={c.clip_id} clip={c} onClick={() => navigate(`/claims/${c.clip_id}`)} />
            ))}
          </div>
        </main>
      </div>

      {showRecorder && (
        <RecordClipModal
          categories={categories}
          onClose={() => setShowRecorder(false)}
          onPosted={(id) => { setShowRecorder(false); navigate(`/claims/${id}`); }}
        />
      )}
    </div>
  );
}
