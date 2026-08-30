import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Swords, Sparkles, ShieldCheck, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import { toast } from "sonner";

function formatJoinDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

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

function FriendsCard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const load = () => api.get("/friends").then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!data) {
    return (
      <div className="card p-5 mt-6">
        <div className="eyebrow mb-3">Friends</div>
        <p className="text-sm text-[var(--fg-subtle)]">Loading friends…</p>
      </div>
    );
  }

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
            <div key={f.user_id} className="flex items-center justify-between gap-2" data-testid={`friend-${f.user_id}`}>
              <Link to={`/u/${f.user_id}`} className="flex items-center gap-2 text-sm hover:underline min-w-0">
                {f.picture ? <img src={f.picture} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" /> : <span className="w-6 h-6 rounded-full bg-[var(--bg-muted)] shrink-0" />}
                <span className="truncate">{f.display_name}</span>
              </Link>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => navigate(`/private/${f.user_id}`)}
                  className="btn-outline !px-2 !py-1 !text-xs"
                  title="Private chat/call — never seen by AI features"
                  data-testid={`btn-message-${f.user_id}`}
                >
                  Message
                </button>
                <button
                  onClick={() => navigate("/match", { state: { friendId: f.user_id, friendName: f.display_name } })}
                  className="btn-outline !px-2 !py-1 !text-xs"
                  title="Queue together — you'll be matched as a pair"
                  data-testid={`btn-party-queue-${f.user_id}`}
                >
                  Queue together
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.outgoing_requests.length > 0 && (
        <p className="mt-3 text-xs text-[var(--fg-subtle)]">{data.outgoing_requests.length} request(s) pending</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [becoming, setBecoming] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const upgradeAdFree = async () => {
    setUpgrading(true);
    try {
      const { data } = await api.post("/payments/checkout/platform");
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e.response?.status === 503 ? "Ad-free isn't live yet" : "Couldn't start checkout");
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => { api.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {}); }, []);

  const findMatch = () => {
    if (!user.id_verified) return navigate("/verify");
    navigate("/match");
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

  const firstName = (user.display_name || user.name || "").split(" ")[0];
  const joinDate = formatJoinDate(user.created_at);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--fg)] focus:text-[var(--bg)] focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="eyebrow">{firstName ? `Welcome back, ${firstName}` : "Your dashboard"}</div>
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
            <button
              onClick={() => navigate(`/u/${user.user_id}`)}
              className="mt-4 text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
              data-testid="link-view-profile"
            >
              View your public profile →
            </button>

            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={Swords} label="Debates" value={stats?.debates ?? 0} testid="stat-debates" />
              <StatCard icon={Sparkles} label="Minds changed" value={stats?.minds_changed ?? 0} testid="stat-minds" />
              <StatCard icon={ShieldCheck} label="Verification" value={user.id_verified ? "Verified" : "Not yet"} accent={user.id_verified} testid="stat-verified" />
              <StatCard icon={Calendar} label="Member since" value={joinDate || "—"} testid="stat-member-since" />
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
            <FriendsCard />
            <div className="card p-5 mt-6">
              <div className="eyebrow mb-2">Ad-free</div>
              {user.ad_free ? (
                <p className="text-sm text-[var(--accent)] font-medium">You're ad-free ✓</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--fg-muted)] mb-3">Remove ads everywhere on the site.</p>
                  <button className="btn-outline w-full" onClick={upgradeAdFree} disabled={upgrading} data-testid="btn-upgrade-ad-free">
                    {upgrading ? "…" : "Upgrade — £9/mo"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, testid, accent }) {
  return (
    <div className="card p-4" data-testid={testid}>
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--fg-subtle)] uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`font-heading font-semibold mt-1.5 text-xl sm:text-2xl truncate ${accent ? "text-[var(--accent)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
