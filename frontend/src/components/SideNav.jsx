import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, GitBranch, Users, Star, Rss, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

function Avatar({ picture, name, live }) {
  return (
    <div className="relative w-7 h-7 shrink-0">
      {picture
        ? <img src={picture} alt="" className="w-full h-full rounded-full object-cover" />
        : <span className="w-full h-full rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[10px] font-medium">{(name || "?")[0]?.toUpperCase()}</span>}
      {live && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />}
    </div>
  );
}

function Section({ title, icon: Icon, entries, collapsed, navigate, onHeaderClick, emptyHint }) {
  return (
    <div className="mt-4 first:mt-0">
      <button
        onClick={onHeaderClick}
        className={`flex items-center gap-3 w-full text-left rounded-lg hover:bg-[var(--bg-muted)] transition-colors ${collapsed ? "justify-center px-0 py-2" : "px-3 py-1.5"}`}
        title={title}
        data-testid={`sidenav-section-${title.toLowerCase()}`}
      >
        <Icon className="w-4 h-4 text-[var(--fg-subtle)] shrink-0" />
        {!collapsed && <span className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)] font-medium">{title}</span>}
      </button>
      {!collapsed && entries.length === 0 && (
        <div className="px-3 py-1 text-xs text-[var(--fg-subtle)]">{emptyHint}</div>
      )}
      {entries.map((e) => (
        <button
          key={e.user_id}
          onClick={() => navigate(e.live_room_id ? `/watch/${e.live_room_id}` : `/u/${e.user_id}`)}
          className={`flex items-center gap-3 w-full text-left rounded-lg hover:bg-[var(--bg-muted)] transition-colors ${collapsed ? "justify-center px-0 py-1.5" : "px-3 py-1.5"}`}
          title={e.live_room_id ? `${e.display_name} — live now` : e.display_name}
          data-testid={`sidenav-entry-${e.user_id}`}
        >
          <Avatar picture={e.picture} name={e.display_name} live={!!e.live_room_id} />
          {!collapsed && (
            <span className="text-sm truncate min-w-0 flex-1 flex items-center gap-1.5">
              <span className="truncate">{e.display_name}</span>
              {e.live_room_id && <span className="text-[9px] uppercase tracking-wide text-[var(--accent)] font-semibold shrink-0">Live</span>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Client feedback: the home/watch page should read as the site's main page,
 * not a secondary screen — a persistent, collapsible left rail (YouTube's
 * subscriptions sidebar) with friends/subscriptions/follows is the concrete
 * ask, and its presence + a proper full-width header is most of what makes
 * a page read as "primary" vs. "nested." */
export default function SideNav({ collapsed, onToggleCollapsed }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [friends, setFriends] = useState([]);
  const [following, setFollowing] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([
      api.get("/friends").catch(() => ({ data: { friends: [] } })),
      api.get("/users/me/following").catch(() => ({ data: { following: [] } })),
      api.get("/users/me/subscriptions").catch(() => ({ data: { subscriptions: [] } })),
    ]).then(([f, fo, s]) => {
      if (!mounted) return;
      setFriends(f.data.friends || []);
      setFollowing(fo.data.following || []);
      setSubscriptions(s.data.subscriptions || []);
    });
    return () => { mounted = false; };
  }, [user]);

  const isHome = location.pathname === "/" || location.pathname === "/watch";

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto transition-[width] duration-150 ${collapsed ? "w-16" : "w-60"}`}
      data-testid="sidenav"
    >
      <div className="p-2">
        <button
          onClick={onToggleCollapsed}
          className={`btn-ghost w-full !justify-start gap-3 mb-2 ${collapsed ? "!justify-center !px-0" : ""}`}
          data-testid="sidenav-toggle"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>

        <button
          onClick={() => navigate("/")}
          className={`flex items-center gap-3 w-full text-left rounded-lg transition-colors ${isHome ? "bg-[var(--bg-muted)]" : "hover:bg-[var(--bg-muted)]"} ${collapsed ? "justify-center px-0 py-2" : "px-3 py-2"}`}
          data-testid="sidenav-home"
        >
          <Home className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Home</span>}
        </button>

        <button
          onClick={() => navigate("/claims")}
          className={`flex items-center gap-3 w-full text-left rounded-lg transition-colors ${location.pathname.startsWith("/claims") ? "bg-[var(--bg-muted)]" : "hover:bg-[var(--bg-muted)]"} ${collapsed ? "justify-center px-0 py-2" : "px-3 py-2"}`}
          data-testid="sidenav-claims"
          title="Claim Trees"
        >
          <GitBranch className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Claims</span>}
        </button>

        {!user ? (
          !collapsed && <p className="px-3 py-4 text-xs text-[var(--fg-subtle)]">Sign in to see friends, follows, and subscriptions here.</p>
        ) : (
          <>
            <Section title="Friends" icon={Users} entries={friends} collapsed={collapsed} navigate={navigate} onHeaderClick={() => navigate("/dashboard")} emptyHint="No friends yet" />
            <Section title="Subscriptions" icon={Star} entries={subscriptions} collapsed={collapsed} navigate={navigate} onHeaderClick={() => navigate("/dashboard")} emptyHint="Subscribe to a debater's channel" />
            <Section title="Following" icon={Rss} entries={following} collapsed={collapsed} navigate={navigate} onHeaderClick={() => navigate("/dashboard")} emptyHint="Follow debaters to see them here" />
          </>
        )}
      </div>
    </aside>
  );
}
