import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

function TopicSpectrum({ t }) {
  const pct = 50 + (t.position / 10) * 50;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{t.topic}</span>
        <span className="text-xs font-mono-ui text-[var(--fg-subtle)]">{t.position?.toFixed?.(1)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-[var(--bg-muted)] border border-[var(--border-strong)]">
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--accent-soft)]" style={{ left: `calc(${pct}% - 6px)` }} />
      </div>
      {t.summary && <p className="mt-2 text-xs text-[var(--fg-muted)]">{t.summary}</p>}
    </div>
  );
}

function FriendButton({ profile, userId, onChange }) {
  const [busy, setBusy] = useState(false);
  const act = async (endpoint) => {
    setBusy(true);
    try { await api.post(`/friends/${endpoint}/${userId}`); onChange(); }
    catch (e) { toast.error(e.response?.data?.detail || "Couldn't update friend request"); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/friends/${userId}`); onChange(); }
    catch { toast.error("Couldn't remove friend"); }
    finally { setBusy(false); }
  };

  if (profile.friend_status === "friends") return <button className="btn-outline" onClick={remove} disabled={busy} data-testid="btn-unfriend">Friends ✓</button>;
  if (profile.friend_status === "pending_outgoing") return <button className="btn-outline" disabled data-testid="btn-friend-pending">Request sent</button>;
  if (profile.friend_status === "pending_incoming") return (
    <div className="flex gap-2">
      <button className="btn-accent" onClick={() => act("accept")} disabled={busy} data-testid="btn-accept-friend">Accept</button>
      <button className="btn-outline" onClick={() => act("reject")} disabled={busy} data-testid="btn-reject-friend">Reject</button>
    </div>
  );
  if (!profile.allow_friend_requests) return null;
  return <button className="btn-outline" onClick={() => act("request")} disabled={busy} data-testid="btn-add-friend">Add friend</button>;
}

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState(null);
  const [topics, setTopics] = useState([]);
  const [debates, setDebates] = useState([]);
  const [liveRoomId, setLiveRoomId] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  const load = () => {
    api.get(`/users/${userId}`).then(({ data }) => setProfile(data)).catch(() => setNotFound(true));
    api.get(`/users/${userId}/topic-stances`).then(({ data }) => setTopics(data.topics || [])).catch(() => {});
    api.get(`/users/${userId}/debates`).then(({ data }) => { setDebates(data.debates || []); setLiveRoomId(data.live_room_id || null); }).catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggleFollow = async () => {
    if (!viewer) { toast.info("Sign in to follow"); return; }
    try {
      if (profile.is_following) await api.delete(`/users/${userId}/follow`);
      else await api.post(`/users/${userId}/follow`);
      load();
    } catch { toast.error("Couldn't update follow"); }
  };

  const subscribe = async () => {
    if (!viewer) { toast.info("Sign in to subscribe"); return; }
    setSubLoading(true);
    try {
      const { data } = await api.post(`/payments/checkout/debater/${userId}`);
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e.response?.status === 503 ? "Subscriptions aren't live yet" : "Couldn't start checkout");
    } finally {
      setSubLoading(false);
    }
  };

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">
      Profile not found.
    </div>
  );
  if (!profile) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm" data-testid="nav-back">← Back</button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {liveRoomId && (
          <button
            onClick={() => navigate(`/watch/${liveRoomId}`)}
            className="w-full mb-6 card p-4 flex items-center justify-between gap-3 border-[var(--accent)] hover:brightness-95 transition"
            data-testid="btn-profile-live-now"
          >
            <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" /> Live now</span>
            <span className="text-sm font-medium">Watch {profile.display_name} debate live →</span>
          </button>
        )}

        <div className="flex items-center gap-5">
          {profile.picture
            ? <img src={profile.picture} alt="" className="w-20 h-20 rounded-full object-cover border border-[var(--border)]" />
            : <div className="w-20 h-20 rounded-full bg-[var(--bg-muted)] border border-[var(--border)]" />}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold truncate">{profile.display_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {profile.is_debater && <span className="chip-accent">Debater</span>}
              {profile.id_verified && <span className="chip">Verified</span>}
            </div>
          </div>
        </div>

        {profile.bio && <p className="mt-5 text-[var(--fg-muted)] max-w-xl">{profile.bio}</p>}

        <div className="mt-6 flex items-center gap-6 text-sm">
          <div><span className="font-semibold">{profile.followers_count}</span> <span className="text-[var(--fg-subtle)]">followers</span></div>
          <div><span className="font-semibold">{profile.following_count}</span> <span className="text-[var(--fg-subtle)]">following</span></div>
        </div>

        {!profile.is_self && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={toggleFollow}
              className={profile.is_following ? "btn-outline" : "btn-accent"}
              data-testid="btn-profile-follow"
            >
              {profile.is_following ? "Following" : "Follow"}
            </button>
            <FriendButton profile={profile} userId={userId} onChange={load} />
            {profile.is_debater && (
              <button onClick={subscribe} disabled={subLoading || profile.is_subscribed} className="btn-outline" data-testid="btn-subscribe">
                {profile.is_subscribed ? "Subscribed £2/mo ✓" : subLoading ? "…" : "Subscribe £2/mo"}
              </button>
            )}
          </div>
        )}

        {debates.length > 0 && (
          <div className="mt-12">
            <div className="eyebrow mb-3">Debates</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {debates.map((d) => (
                <button
                  key={d.room_id}
                  onClick={() => navigate(`/watch/${d.room_id}`)}
                  className="card p-4 text-left hover:border-[var(--fg)] transition-colors"
                  data-testid={`profile-debate-${d.room_id}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {d.status === "active"
                      ? <span className="chip-accent !py-0 !px-1.5"><span className="w-1 h-1 rounded-full bg-[var(--accent)]" /> Live</span>
                      : <span className="chip !py-0 !px-1.5">Published</span>}
                    {d.categories?.[0] && <span className="chip !py-0 !px-1.5">{d.categories[0]}</span>}
                  </div>
                  <div className="text-sm font-medium leading-snug line-clamp-2">{d.topics?.[0] || "An unrecorded disagreement"}</div>
                  <div className="text-xs text-[var(--fg-subtle)] mt-1">♥ {d.likes}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 card p-6">
          <div className="eyebrow mb-1">Topic spectrums</div>
          <p className="text-xs text-[var(--fg-subtle)] mb-2">Where they stand, per topic — built from their debates and viewer feedback.</p>
          {topics.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)] mt-4">No debates scored yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {topics.map((t) => <TopicSpectrum key={t.topic} t={t} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
