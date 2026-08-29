import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import SideNav from "@/components/SideNav";
import RecordClipModal from "@/components/RecordClipModal";
import { startGoogleLogin } from "@/lib/auth";

const SIDENAV_COLLAPSED_KEY = "indifferent-sidenav-collapsed";

function ClaimCard({ clip, onClick }) {
  return (
    <button onClick={onClick} className="card overflow-hidden text-left hover:border-[var(--fg)] transition-colors" data-testid={`claim-card-${clip.clip_id}`}>
      <video src={`${API}/clips/${clip.clip_id}/video`} muted preload="metadata" className="w-full aspect-video object-cover bg-black" />
      <div className="p-4">
        <span className="chip !py-0 !px-1.5 text-[10px]">{clip.category}</span>
        <div className="font-heading text-base font-semibold mt-2 line-clamp-2">"{clip.caption}"</div>
        <div className="text-xs text-[var(--fg-subtle)] mt-2">
          {clip.uploader_name} · ♥ {clip.likes} · {clip.reply_count} {clip.reply_count === 1 ? "rebuttal" : "rebuttals"}
        </div>
      </div>
    </button>
  );
}

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDENAV_COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(SIDENAV_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  const load = () => {
    const params = {};
    if (activeCategory) params.category = activeCategory;
    api.get("/clips/roots", { params })
      .then(({ data }) => setClaims(data.claims || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRecorder = () => {
    if (!user) { toast.info("Sign in to post a claim"); return; }
    setShowRecorder(true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={toggleSidebar} className="btn-ghost !px-2.5 shrink-0" data-testid="btn-toggle-sidenav" aria-label="Toggle sidebar">
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <button onClick={() => navigate("/")} className="font-heading text-xl font-semibold tracking-tight shrink-0">indifferent</button>
          <div className="flex-1 max-w-xl mx-auto hidden sm:flex items-center gap-2">
            <span className="text-sm text-[var(--fg-subtle)]">Claim Trees</span>
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button onClick={openRecorder} className="btn-accent text-sm" data-testid="btn-new-claim">State a claim</button>
            <ThemeToggle />
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
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

      <div className="flex items-start">
        <div className="hidden md:block">
          <SideNav collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
        </div>

        <main className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading && <div className="text-sm text-[var(--fg-subtle)]">Loading claims…</div>}

          {!loading && claims.length === 0 && (
            <div className="card p-10 text-center">
              <div className="eyebrow">Nothing here yet</div>
              <div className="font-heading text-xl sm:text-2xl mt-2">Be the first to say something worth arguing with.</div>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">State a claim on video — anyone can push back with a video of their own.</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
