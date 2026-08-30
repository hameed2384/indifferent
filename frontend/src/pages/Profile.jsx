import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, UserPlus, Swords, GitBranch, Calendar, Heart, Settings as SettingsIcon, MessageCircle } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import { startGoogleLogin } from "@/lib/auth";

function formatJoinDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

function StatBlock({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2" data-testid={`profile-stat-${label.toLowerCase()}`}>
      <Icon className="w-4 h-4 text-[var(--fg-subtle)] shrink-0" />
      <span className="text-sm"><span className="font-semibold">{value}</span> <span className="text-[var(--fg-subtle)]">{label}</span></span>
    </div>
  );
}

function TopicSpectrum({ t }) {
  const pct = 50 + (t.position / 10) * 50;
  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-2">
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

function EmptyState({ title, subtitle }) {
  return (
    <div className="card p-10 text-center">
      <div className="font-heading text-lg font-semibold">{title}</div>
      {subtitle && <p className="mt-1 text-sm text-[var(--fg-muted)]">{subtitle}</p>}
    </div>
  );
}

function DebateCardSmall({ d, onClick }) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover:border-[var(--fg)] transition-colors" data-testid={`profile-debate-${d.room_id}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {d.status === "active"
          ? <span className="chip-accent !py-0 !px-1.5"><span className="w-1 h-1 rounded-full bg-[var(--accent)]" /> Live</span>
          : <span className="chip !py-0 !px-1.5">Published</span>}
        {d.categories?.[0] && <span className="chip !py-0 !px-1.5">{d.categories[0]}</span>}
      </div>
      <div className="text-sm font-medium leading-snug line-clamp-2">{d.topics?.[0] || "An unrecorded disagreement"}</div>
      <div className="text-xs text-[var(--fg-subtle)] mt-1.5">♥ {d.likes}</div>
    </button>
  );
}

function ClipCardSmall({ c, onClick }) {
  return (
    <button onClick={onClick} className="card overflow-hidden text-left hover:border-[var(--fg)] transition-colors" data-testid={`profile-clip-${c.clip_id}`}>
      <video src={`${API}/clips/${c.clip_id}/video`} muted preload="metadata" className="w-full aspect-video object-cover bg-black" />
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="chip !py-0 !px-1.5 text-[10px]">{c.category}</span>
          {c.parent_clip_id && <span className="chip !py-0 !px-1.5 text-[10px]">Reply</span>}
        </div>
        <div className="text-sm font-medium leading-snug line-clamp-2">"{c.caption}"</div>
        <div className="text-xs text-[var(--fg-subtle)] mt-1">♥ {c.likes} · {c.reply_count} {c.reply_count === 1 ? "reply" : "replies"}</div>
      </div>
    </button>
  );
}

const TABS = [
  { key: "debates", label: "Debates", icon: Swords },
  { key: "claims", label: "Claims", icon: GitBranch },
  { key: "spectrum", label: "Topic spectrum", icon: Heart },
];

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: viewer, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [topics, setTopics] = useState([]);
  const [debates, setDebates] = useState([]);
  const [clips, setClips] = useState([]);
  const [liveRoomId, setLiveRoomId] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [tab, setTab] = useState("debates");

  const load = () => {
    api.get(`/users/${userId}`).then(({ data }) => setProfile(data)).catch(() => setNotFound(true));
    api.get(`/users/${userId}/topic-stances`).then(({ data }) => setTopics(data.topics || [])).catch(() => {});
    api.get(`/users/${userId}/debates`).then(({ data }) => { setDebates(data.debates || []); setLiveRoomId(data.live_room_id || null); }).catch(() => {});
    api.get(`/users/${userId}/clips`).then(({ data }) => setClips(data.clips || [])).catch(() => {});
  };

  useEffect(() => {
    load();
    setTab("debates");
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

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: profile?.display_name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* noop */ }
  };

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">
      Profile not found.
    </div>
  );
  if (!profile) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;

  const joinDate = formatJoinDate(profile.created_at);
  const activeTabCount = { debates: debates.length, claims: clips.length, spectrum: topics.length };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm" data-testid="nav-back">← Back</button>
          <div className="flex items-center gap-2">
            <button onClick={share} className="btn-outline text-sm" data-testid="btn-share-profile">Share</button>
            <ThemeToggle />
            {viewer
              ? <AccountMenu user={viewer} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
      </nav>

      {liveRoomId && (
        <button
          onClick={() => navigate(`/watch/${liveRoomId}`)}
          className="w-full bg-[var(--accent)] text-white py-2.5 flex items-center justify-center gap-2 text-sm font-medium hover:brightness-95 transition"
          data-testid="btn-profile-live-now"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {profile.display_name} is live now — watch the debate →
        </button>
      )}

      {/* Cover banner + avatar, YouTube/Twitter-channel style */}
      <div className="h-32 sm:h-44 bg-gradient-to-br from-[var(--accent-soft)] via-[var(--bg-muted)] to-[var(--bg-muted)]" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="-mt-12 sm:-mt-16 flex items-end gap-4 sm:gap-5">
          {profile.picture
            ? <img src={profile.picture} alt="" className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-[var(--bg)] shrink-0" />
            : <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[var(--bg-muted)] ring-4 ring-[var(--bg)] shrink-0 flex items-center justify-center font-heading text-3xl font-semibold text-[var(--fg-subtle)]">
                {(profile.display_name || "?")[0]?.toUpperCase()}
              </div>}
          <div className="min-w-0 pb-2 flex-1">
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold truncate">{profile.display_name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {profile.is_debater && <span className="chip-accent">Debater</span>}
              {profile.id_verified && <span className="chip">Verified</span>}
              {liveRoomId && <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" /> Live</span>}
            </div>
          </div>
          {profile.is_self && (
            <button onClick={() => navigate("/settings")} className="btn-outline text-sm shrink-0 mb-2 hidden sm:inline-flex items-center gap-1.5" data-testid="btn-edit-profile">
              <SettingsIcon className="w-3.5 h-3.5" /> Edit profile
            </button>
          )}
        </div>

        {profile.is_self && (
          <button onClick={() => navigate("/settings")} className="btn-outline text-sm w-full mt-4 sm:hidden inline-flex items-center justify-center gap-1.5" data-testid="btn-edit-profile-mobile">
            <SettingsIcon className="w-3.5 h-3.5" /> Edit profile
          </button>
        )}

        {profile.bio && <p className="mt-5 text-[var(--fg-muted)] max-w-xl">{profile.bio}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatBlock icon={Users} value={profile.followers_count} label="Followers" />
          <StatBlock icon={UserPlus} value={profile.following_count} label="Following" />
          <StatBlock icon={Swords} value={profile.debates_count} label="Debates" />
          <StatBlock icon={GitBranch} value={profile.clips_count} label="Claims" />
          {joinDate && (
            <span className="flex items-center gap-2 text-sm text-[var(--fg-subtle)]">
              <Calendar className="w-4 h-4 shrink-0" /> Joined {joinDate}
            </span>
          )}
        </div>

        {!profile.is_self && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={toggleFollow}
              className={profile.is_following ? "btn-outline" : "btn-accent"}
              data-testid="btn-profile-follow"
            >
              {profile.is_following ? "Following" : "Follow"}
            </button>
            <FriendButton profile={profile} userId={userId} onChange={load} />
            {profile.friend_status === "friends" && (
              <button onClick={() => navigate(`/private/${userId}`)} className="btn-outline inline-flex items-center gap-1.5" data-testid="btn-message-profile">
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            )}
            {profile.is_debater && (
              <button onClick={subscribe} disabled={subLoading || profile.is_subscribed} className="btn-outline" data-testid="btn-subscribe">
                {profile.is_subscribed ? "Subscribed £2/mo ✓" : subLoading ? "…" : "Subscribe £2/mo"}
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-8 border-b border-[var(--border)] flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
                tab === t.key ? "border-[var(--accent)] text-[var(--fg)]" : "border-transparent text-[var(--fg-subtle)] hover:text-[var(--fg)]"
              }`}
              data-testid={`profile-tab-${t.key}`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
              {activeTabCount[t.key] > 0 && <span className="text-[var(--fg-subtle)]">{activeTabCount[t.key]}</span>}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === "debates" && (
            debates.length === 0 ? (
              <EmptyState title="No debates yet" subtitle={profile.is_self ? "Find your opposite from the home page to start one." : "Nothing public here yet."} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {debates.map((d) => <DebateCardSmall key={d.room_id} d={d} onClick={() => navigate(`/watch/${d.room_id}`)} />)}
              </div>
            )
          )}

          {tab === "claims" && (
            clips.length === 0 ? (
              <EmptyState title="No claims yet" subtitle={profile.is_self ? "State a claim on video from the Claims page to start a tree." : "Nothing posted here yet."} />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.map((c) => <ClipCardSmall key={c.clip_id} c={c} onClick={() => navigate(`/claims/${c.clip_id}`)} />)}
              </div>
            )
          )}

          {tab === "spectrum" && (
            topics.length === 0 ? (
              <EmptyState title="No topics scored yet" subtitle="Positions are built from debates and viewer feedback over time." />
            ) : (
              <div className="card p-6">
                <p className="text-xs text-[var(--fg-subtle)] mb-2">Where {profile.is_self ? "you" : "they"} stand, per topic — built from debates and viewer feedback.</p>
                <div className="divide-y divide-[var(--border)]">
                  {topics.map((t) => <TopicSpectrum key={t.topic} t={t} />)}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
