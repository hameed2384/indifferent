import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import { toast } from "sonner";

function StanceMap({ stance }) {
  if (!stance) return null;
  const x = 50 + (stance.economic / 10) * 45;
  const y = 50 - (stance.social / 10) * 45;
  return (
    <div className="card p-5">
      <div className="eyebrow mb-3">Your position</div>
      <div className="relative aspect-square w-full max-w-[320px] mx-auto border border-[var(--border-strong)] rounded-lg bg-[var(--bg-muted)]">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, transparent 49.5%, var(--border-strong) 49.5%, var(--border-strong) 50.5%, transparent 50.5%), linear-gradient(to bottom, transparent 49.5%, var(--border-strong) 49.5%, var(--border-strong) 50.5%, transparent 50.5%)" }} />
        <div className="absolute text-[10px] font-medium uppercase tracking-wider text-[var(--fg-subtle)] left-2 top-2">Progressive</div>
        <div className="absolute text-[10px] font-medium uppercase tracking-wider text-[var(--fg-subtle)] right-2 top-2">Free-market</div>
        <div className="absolute text-[10px] font-medium uppercase tracking-wider text-[var(--fg-subtle)] left-2 bottom-2">Liberal</div>
        <div className="absolute text-[10px] font-medium uppercase tracking-wider text-[var(--fg-subtle)] right-2 bottom-2">Traditional</div>
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent-soft)]"
          style={{ left: `calc(${x}% - 7px)`, top: `calc(${y}% - 7px)` }}
          data-testid="stance-dot"
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] text-[var(--fg-subtle)] uppercase tracking-wider">Economic</div>
          <div className="font-medium">{stance.economic.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[11px] text-[var(--fg-subtle)] uppercase tracking-wider">Social</div>
          <div className="font-medium">{stance.social.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

function FriendsCard({ allowFriendRequests, onToggleAllow }) {
  const [data, setData] = useState(null);
  const load = () => api.get("/friends").then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return null;

  const respond = async (endpoint, userId) => {
    try { await api.post(`/friends/${endpoint}/${userId}`); load(); } catch { toast.error("Couldn't update request"); }
  };

  return (
    <div className="card p-5 mt-6">
      <div className="eyebrow mb-3">Friends</div>
      {data.incoming_requests.length > 0 && (
        <div className="mb-4 space-y-2">
          {data.incoming_requests.map((f) => (
            <div key={f.user_id} className="flex items-center justify-between gap-2 text-sm">
              <Link to={`/u/${f.user_id}`} className="truncate hover:underline">{f.display_name}</Link>
              <div className="flex gap-1.5 shrink-0">
                <button className="btn-accent !px-2 !py-1 !text-xs" onClick={() => respond("accept", f.user_id)}>Accept</button>
                <button className="btn-outline !px-2 !py-1 !text-xs" onClick={() => respond("reject", f.user_id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.friends.length === 0 ? (
        <p className="text-sm text-[var(--fg-subtle)]">No friends yet.</p>
      ) : (
        <div className="space-y-2">
          {data.friends.map((f) => (
            <Link key={f.user_id} to={`/u/${f.user_id}`} className="flex items-center gap-2 text-sm hover:underline" data-testid={`friend-${f.user_id}`}>
              {f.picture ? <img src={f.picture} alt="" className="w-6 h-6 rounded-full object-cover" /> : <span className="w-6 h-6 rounded-full bg-[var(--bg-muted)]" />}
              <span className="truncate">{f.display_name}</span>
            </Link>
          ))}
        </div>
      )}
      {data.outgoing_requests.length > 0 && (
        <p className="mt-3 text-xs text-[var(--fg-subtle)]">{data.outgoing_requests.length} request(s) pending</p>
      )}
      <label className="mt-4 flex items-center gap-2 pt-3 border-t border-[var(--border)] cursor-pointer">
        <input type="checkbox" checked={!allowFriendRequests} onChange={onToggleAllow} className="w-4 h-4 accent-[var(--accent)]" data-testid="checkbox-block-friend-requests" />
        <span className="text-xs text-[var(--fg-muted)]">Don't allow friend requests</span>
      </label>
    </div>
  );
}

export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [becoming, setBecoming] = useState(false);

  useEffect(() => { api.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {}); }, []);

  const findMatch = () => {
    if (!user.id_verified) return navigate("/verify");
    navigate("/match");
  };

  const toggleFriendRequests = async () => {
    const next = !user.allow_friend_requests;
    try {
      await api.post("/users/me/friend-privacy", null, { params: { allow: next } });
      setUser((u) => ({ ...u, allow_friend_requests: next }));
    } catch {
      toast.error("Couldn't update setting");
    }
  };

  const becomeDebater = async () => {
    setBecoming(true);
    try {
      await api.post("/users/me/become-debater");
      setUser((u) => ({ ...u, is_debater: true }));
      toast.success("You're a debater now — go live any time from Watch.");
    } catch {
      toast.error("Couldn't update your account");
    } finally {
      setBecoming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="font-heading text-lg font-semibold tracking-tight" data-testid="brand-mark">
            indifferent
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/watch")} className="btn-ghost text-sm">Watch</button>
            <span className="text-sm text-[var(--fg-muted)] hidden md:block" data-testid="user-name">{user?.display_name || user?.name}</span>
            <ThemeToggle />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="eyebrow">Your dashboard</div>
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-semibold mt-2 leading-tight">
              Ready for someone<br />who disagrees?
            </h1>
            <p className="mt-4 text-[var(--fg-muted)] max-w-lg">
              One click and we'll find the sharpest opposing viewpoint in the queue.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-accent" onClick={findMatch} data-testid="btn-find-match">Find my opposite</button>
              {!user.id_verified && (
                <button className="btn-outline" onClick={() => navigate("/verify")} data-testid="btn-verify-cta">Verify ID first</button>
              )}
              {user.is_debater ? (
                <button className="btn-outline" onClick={() => navigate("/watch")} data-testid="btn-go-live-cta">Go live</button>
              ) : (
                <button className="btn-outline" onClick={becomeDebater} disabled={becoming} data-testid="btn-become-debater">
                  {becoming ? "…" : "Become a debater"}
                </button>
              )}
            </div>

            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Debates" value={stats?.debates ?? 0} testid="stat-debates" />
              <StatCard label="Minds changed" value={stats?.minds_changed ?? 0} testid="stat-minds" />
              <StatCard label="Verified" value={user.id_verified ? "Yes" : "No"} accent={user.id_verified} />
              <StatCard label="Sign in" value={user.email?.split("@")[0]} small />
            </div>

            {user.stance?.tags?.length > 0 && (
              <div className="mt-8">
                <div className="eyebrow mb-2">Your themes</div>
                <div className="flex flex-wrap gap-2">
                  {user.stance.tags.slice(0, 6).map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {user.stance?.summary && (
              <div className="mt-10 card p-6">
                <div className="eyebrow mb-2">AI stance summary</div>
                <p className="text-base leading-relaxed text-[var(--fg)]" data-testid="stance-summary">"{user.stance.summary}"</p>
              </div>
            )}
          </div>

          <div>
            <StanceMap stance={user.stance} />
            <FriendsCard allowFriendRequests={user.allow_friend_requests} onToggleAllow={toggleFriendRequests} />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, testid, accent, small }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-[var(--fg-subtle)] uppercase tracking-wider">{label}</div>
      <div className={`font-heading font-semibold mt-1 ${small ? "text-base truncate" : "text-2xl"} ${accent ? "text-[var(--accent)]" : ""}`} data-testid={testid}>
        {value}
      </div>
    </div>
  );
}
