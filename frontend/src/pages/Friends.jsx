import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MessageCircle, Search, UserPlus, Users, Rss } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import BackButton from "@/components/BackButton";
import { STICKY_NAV } from "@/lib/navChrome";

function Avatar({ picture, name, size = "w-9 h-9" }) {
  return picture
    ? <img src={picture} alt="" className={`${size} rounded-full object-cover shrink-0`} />
    : <span className={`${size} rounded-full bg-[var(--bg-muted)] shrink-0 flex items-center justify-center text-xs font-medium text-[var(--fg-subtle)]`}>{(name || "?")[0]?.toUpperCase()}</span>;
}

function SearchResultRow({ result, onChange }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const follow = async () => {
    setBusy(true);
    try { await api.post(`/users/${result.user_id}/follow`); onChange(); }
    catch { toast.error("Couldn't follow"); }
    finally { setBusy(false); }
  };
  const unfollow = async () => {
    setBusy(true);
    try { await api.delete(`/users/${result.user_id}/follow`); onChange(); }
    catch { toast.error("Couldn't unfollow"); }
    finally { setBusy(false); }
  };
  const requestFriend = async () => {
    setBusy(true);
    try { await api.post(`/friends/request/${result.user_id}`); onChange(); }
    catch (e) { toast.error(e.response?.data?.detail || "Couldn't send request"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3" data-testid={`search-result-${result.user_id}`}>
      <button onClick={() => navigate(`/u/${result.user_id}`)} className="flex items-center gap-3 min-w-0 text-left hover:underline">
        <Avatar picture={result.picture} name={result.display_name} />
        <span className="min-w-0">
          <span className="block text-sm font-medium truncate">{result.display_name}</span>
          {result.handle && <span className="block text-xs text-[var(--fg-subtle)] truncate">@{result.handle}</span>}
          {result.is_debater && <span className="chip !py-0 !px-1.5 text-[10px] mt-0.5 inline-block">Debater</span>}
        </span>
      </button>
      <div className="flex gap-1.5 shrink-0">
        {result.friend_status === "friends" ? (
          <span className="btn-outline !px-2 !py-1 !text-xs" data-testid={`friend-status-${result.user_id}`}>Friends ✓</span>
        ) : result.friend_status === "pending_outgoing" ? (
          <span className="btn-outline !px-2 !py-1 !text-xs">Requested</span>
        ) : result.friend_status === "pending_incoming" ? (
          <span className="btn-outline !px-2 !py-1 !text-xs">Respond below</span>
        ) : (
          <button onClick={requestFriend} disabled={busy} className="btn-outline !px-2 !py-1 !text-xs" data-testid={`btn-friend-${result.user_id}`}>Friend</button>
        )}
        <button
          onClick={result.is_following ? unfollow : follow}
          disabled={busy}
          className={result.is_following ? "btn-outline !px-2 !py-1 !text-xs" : "btn-accent !px-2 !py-1 !text-xs"}
          data-testid={`btn-follow-${result.user_id}`}
        >
          {result.is_following ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}

function SearchSection() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = (term) => {
    if (term.trim().length < 2) { setResults([]); setSearched(false); return; }
    setSearching(true);
    api.get("/users/search", { params: { q: term.trim() } })
      .then(({ data }) => setResults(data.users || []))
      .catch(() => setResults([]))
      .finally(() => { setSearching(false); setSearched(true); });
  };

  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow mb-4">Find people</div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="field !pl-9"
          data-testid="people-search-input"
        />
      </div>
      {searching && <p className="mt-3 text-sm text-[var(--fg-subtle)]">Searching…</p>}
      {!searching && searched && results.length === 0 && (
        <p className="mt-3 text-sm text-[var(--fg-subtle)]">No one matches "{q.trim()}".</p>
      )}
      {results.length > 0 && (
        <div className="mt-2 divide-y divide-[var(--border)]">
          {results.map((r) => <SearchResultRow key={r.user_id} result={r} onChange={() => runSearch(q)} />)}
        </div>
      )}
    </div>
  );
}

function RequestsAndFriends() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const load = () => api.get("/friends").then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const respond = async (endpoint, userId) => {
    try { await api.post(`/friends/${endpoint}/${userId}`); load(); } catch { toast.error("Couldn't update request"); }
  };

  return (
    <>
      {data?.incoming_requests.length > 0 && (
        <div className="card p-5 sm:p-6">
          <div className="eyebrow mb-4">Requests · {data.incoming_requests.length}</div>
          <div className="space-y-3">
            {data.incoming_requests.map((f) => (
              <div key={f.user_id} className="flex items-center justify-between gap-3">
                <Link to={`/u/${f.user_id}`} className="flex items-center gap-3 min-w-0 hover:underline">
                  <Avatar picture={f.picture} name={f.display_name} />
                  <span className="text-sm font-medium truncate">{f.display_name}</span>
                </Link>
                <div className="flex gap-1.5 shrink-0">
                  <button className="btn-accent !px-2 !py-1 !text-xs" onClick={() => respond("accept", f.user_id)} data-testid={`btn-accept-${f.user_id}`}>Accept</button>
                  <button className="btn-outline !px-2 !py-1 !text-xs" onClick={() => respond("reject", f.user_id)} data-testid={`btn-reject-${f.user_id}`}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="eyebrow mb-4 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Friends {data ? `· ${data.friends.length}` : ""}</div>
        {!data ? (
          <p className="text-sm text-[var(--fg-subtle)]">Loading…</p>
        ) : data.friends.length === 0 ? (
          <p className="text-sm text-[var(--fg-subtle)]">No friends yet — search above to find people.</p>
        ) : (
          <div className="space-y-3">
            {data.friends.map((f) => (
              <div key={f.user_id} className="flex items-center justify-between gap-3" data-testid={`friend-${f.user_id}`}>
                <Link to={`/u/${f.user_id}`} className="flex items-center gap-3 min-w-0 hover:underline">
                  <Avatar picture={f.picture} name={f.display_name} />
                  <span className="text-sm font-medium truncate">{f.display_name}</span>
                </Link>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => navigate(`/private/${f.user_id}`)}
                    className="btn-outline !px-2 !py-1 !text-xs inline-flex items-center gap-1"
                    title="Private chat/call — never seen by AI features"
                    data-testid={`btn-message-${f.user_id}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Message
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
        {data?.outgoing_requests.length > 0 && (
          <p className="mt-3 text-xs text-[var(--fg-subtle)]">{data.outgoing_requests.length} request(s) pending</p>
        )}
      </div>
    </>
  );
}

function FollowingSection() {
  const [following, setFollowing] = useState(null);
  useEffect(() => { api.get("/users/me/following").then(({ data }) => setFollowing(data.following || [])).catch(() => setFollowing([])); }, []);

  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow mb-4 flex items-center gap-1.5"><Rss className="w-3.5 h-3.5" /> Following {following ? `· ${following.length}` : ""}</div>
      {!following ? (
        <p className="text-sm text-[var(--fg-subtle)]">Loading…</p>
      ) : following.length === 0 ? (
        <p className="text-sm text-[var(--fg-subtle)]">Not following anyone yet — search above to find debaters.</p>
      ) : (
        <div className="space-y-3">
          {following.map((f) => (
            <Link key={f.user_id} to={f.live_room_id ? `/watch/${f.live_room_id}` : `/u/${f.user_id}`} className="flex items-center justify-between gap-3 hover:underline" data-testid={`following-${f.user_id}`}>
              <span className="flex items-center gap-3 min-w-0">
                <Avatar picture={f.picture} name={f.display_name} />
                <span className="text-sm font-medium truncate">{f.display_name}</span>
              </span>
              {f.live_room_id && <span className="chip-accent shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" /> Live</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Friends() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className={STICKY_NAV}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton to="/" label="Home" data-testid="nav-back-home" />
            <span className="font-heading text-lg font-semibold inline-flex items-center gap-1.5 truncate"><UserPlus className="w-4 h-4 shrink-0" /> Friends</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
      </nav>

      <main id="main-content" className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <SearchSection />
        <RequestsAndFriends />
        <FollowingSection />
      </main>
    </div>
  );
}
