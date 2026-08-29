import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLiveKit } from "@/lib/livekit";
import { VideoControls, VideoStage } from "@/components/VideoStage";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import { excludeCategories } from "@/lib/notInterested";
import { startGoogleLogin } from "@/lib/auth";

function ViewerOverlay({ side, navigate }) {
  const [following, setFollowing] = useState(null); // null = unknown/self/open, else bool
  const { user } = useAuth();
  const userId = side.identity?.startsWith("user-") ? side.identity.slice(5) : null;

  useEffect(() => {
    if (!userId || !user || userId === user.user_id) return;
    api.get(`/users/${userId}`).then(({ data }) => setFollowing(data.is_following)).catch(() => {});
  }, [userId, user]);

  const toggleFollow = async (e) => {
    e.stopPropagation();
    if (!user) { toast.info("Sign in to follow debaters"); return; }
    try {
      if (following) { await api.delete(`/users/${userId}/follow`); setFollowing(false); }
      else { await api.post(`/users/${userId}/follow`); setFollowing(true); }
    } catch { toast.error("Couldn't update follow"); }
  };

  if (side.open) return null;
  return (
    <div className="absolute top-2 left-2 flex items-center gap-1.5 max-w-[85%]">
      <button
        onClick={() => userId && navigate(`/u/${userId}`)}
        className="flex items-center gap-1.5 bg-black/70 text-white pl-1 pr-2 py-1 rounded-full text-[11px] font-medium hover:bg-black/85 transition min-w-0"
        data-testid={`viewer-overlay-${side.identity}`}
      >
        {side.picture
          ? <img src={side.picture} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
          : <span className="w-5 h-5 rounded-full bg-white/30 shrink-0" />}
        <span className="truncate">{side.display_name}</span>
      </button>
      {userId && user && userId !== user.user_id && following !== null && (
        <button
          onClick={toggleFollow}
          className={`text-[11px] font-medium px-2 py-1 rounded-full transition ${following ? "bg-white/20 text-white" : "bg-[var(--accent)] text-white"}`}
          data-testid={`btn-follow-${userId}`}
        >
          {following ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

function JoinRequestPanel({ roomId, debate, navigate }) {
  const { user } = useAuth();
  const [side, setSide] = useState(null);
  const [status, setStatus] = useState("none"); // none | pending | approved
  const [sending, setSending] = useState(false);

  const myIdentity = user ? `user-${user.user_id}` : null;
  const allIdentities = [
    debate.side_a.identity, debate.side_b.identity,
    ...(debate.side_a_extra || []).map((s) => s.identity),
    ...(debate.side_b_extra || []).map((s) => s.identity),
  ].filter(Boolean);
  const alreadyIn = !!myIdentity && allIdentities.includes(myIdentity);

  useEffect(() => {
    if (!user || alreadyIn) return;
    let cancelled = false;
    api.get(`/rooms/${roomId}/join-status`).then(({ data }) => { if (!cancelled) setStatus(data.status); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, alreadyIn, roomId]);

  useEffect(() => {
    if (status !== "pending") return;
    const iv = setInterval(async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}/join-status`);
        setStatus(data.status);
        if (data.status === "approved") {
          toast.success("You're in — joining the debate…");
          navigate(`/room/${roomId}`);
        }
      } catch { /* transient — next tick retries */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [status, roomId, navigate]);

  if (!user || alreadyIn || debate.status !== "active") return null;

  const requestJoin = async () => {
    if (!side) return;
    setSending(true);
    try {
      await api.post(`/rooms/${roomId}/join-requests`, { side });
      setStatus("pending");
      toast.success("Request sent — waiting for both debaters to approve.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't send request");
    } finally {
      setSending(false);
    }
  };

  if (status === "pending") {
    return (
      <div className="mt-6 card p-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--fg-muted)]">Request to join sent — waiting for approval…</span>
        <span className="chip">Pending</span>
      </div>
    );
  }

  return (
    <div className="mt-6 card p-4">
      <div className="eyebrow mb-2">Jump in</div>
      <p className="text-sm text-[var(--fg-muted)] mb-3">Subscribe to a debater here to request joining as a third voice — both debaters have to agree.</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">
          <button
            onClick={() => setSide("a")}
            disabled={debate.side_full?.a}
            className={`px-3 py-1.5 text-xs font-medium ${side === "a" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"} disabled:opacity-40`}
            data-testid="join-side-a"
          >
            Side A{debate.side_full?.a ? " (full)" : ""}
          </button>
          <button
            onClick={() => setSide("b")}
            disabled={debate.side_full?.b}
            className={`px-3 py-1.5 text-xs font-medium border-l border-[var(--border-strong)] ${side === "b" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"} disabled:opacity-40`}
            data-testid="join-side-b"
          >
            Side B{debate.side_full?.b ? " (full)" : ""}
          </button>
        </div>
        <button onClick={requestJoin} disabled={!side || sending} className="btn-accent text-xs" data-testid="btn-request-join">
          {sending ? "Sending…" : "Request to join"}
        </button>
      </div>
    </div>
  );
}

function RelatedDebates({ category, excludeRoomId, navigate }) {
  const [related, setRelated] = useState([]);
  useEffect(() => {
    if (!category) return;
    let mounted = true;
    api.get("/public/debates", { params: { category } })
      .then(({ data }) => { if (mounted) setRelated((data.debates || []).filter((d) => d.room_id !== excludeRoomId).slice(0, 8)); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [category, excludeRoomId]);

  if (!category) return null;
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="eyebrow mb-3">More in {category}</div>
      <div className="space-y-2">
        {related.length === 0 && <div className="text-xs text-[var(--fg-subtle)]">Nothing else right now.</div>}
        {related.map((d) => (
          <button
            key={d.room_id}
            onClick={() => navigate(`/watch/${d.room_id}`)}
            className="card p-3 text-left w-full hover:border-[var(--fg)] transition-colors block"
            data-testid={`related-${d.room_id}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] mb-1">
              {d.status === "active"
                ? <span className="chip-accent !py-0 !px-1.5"><span className="w-1 h-1 rounded-full bg-[var(--accent)]" /> Live</span>
                : <span className="chip !py-0 !px-1.5">Published</span>}
            </div>
            <div className="text-sm font-medium leading-snug line-clamp-2">
              {d.topics?.[0] || "An unrecorded disagreement"}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default function WatchRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [debate, setDebate] = useState(null);
  const [chat, setChat] = useState([]);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [likeBurst, setLikeBurst] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const sinceRef = useRef(null);
  const likesRef = useRef(0);
  const clientIdRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `spectator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const chatEndRef = useRef(null);
  const commentEndRef = useRef(null);
  const collapseTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/debates/${roomId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setDebate(data);
        setChat(data.chat || []);
        setComments((data.comments || []).slice().reverse());
        setLikes(data.likes || 0);
        likesRef.current = data.likes || 0;
        setSpectatorCount(data.spectator_count || 0);
        sinceRef.current = data.server_time;
      })
      .catch(() => { toast.error("Debate not available"); navigate("/watch"); });
    return () => { cancelled = true; };
  }, [roomId, navigate]);

  const pollOnce = async () => {
    try {
      const { data } = await api.get(`/public/debates/${roomId}/updates`, {
        params: { since: sinceRef.current || undefined, client_id: clientIdRef.current },
      });
      sinceRef.current = data.server_time;
      setConnected(true);
      if (data.likes !== likesRef.current) setLikeBurst((b) => b + 1);
      likesRef.current = data.likes;
      setLikes(data.likes);
      setSpectatorCount(data.spectator_count);
      for (const evt of data.events || []) {
        if (evt.type === "debate-chat") {
          setChat((c) => [...c, { text: evt.text, speaker: evt.speaker, speaker_side: evt.speaker_side, created_at: evt.ts }]);
        } else if (evt.type === "comment") {
          setComments((c) => [{ text: evt.text, author: evt.author, authed: evt.authed, created_at: evt.ts }, ...c]);
        }
      }
    } catch (e) {
      setConnected(false);
      if (e.response?.status === 404) {
        toast.info("The debaters ended the broadcast.");
        navigate("/watch");
      }
    }
  };

  useEffect(() => {
    if (!debate || collapsed) return;
    pollOnce();
    const iv = setInterval(pollOnce, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debate, roomId, collapsed]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);
  useEffect(() => { commentEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments.length]);
  useEffect(() => () => clearTimeout(collapseTimerRef.current), []);

  const sendComment = async () => {
    const t = commentText.trim();
    if (!t) return;
    setCommentText("");
    try {
      await api.post(`/public/debates/${roomId}/comment`, { text: t });
      pollOnce();
    } catch {
      toast.error("Comment failed to send");
    }
  };

  const like = () => {
    api.post(`/public/debates/${roomId}/like`).then(({ data }) => {
      setLikes(data.likes);
      setLikeBurst((b) => b + 1);
    }).catch(() => {});
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Indifferent — live debate", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* noop */ }
  };

  const notInterested = () => {
    if (!debate?.categories?.length) { navigate("/watch"); return; }
    const undo = excludeCategories(debate.categories);
    setCollapsed(true);
    toast(`Won't show you more ${debate.categories[0]} debates`, {
      duration: 15000,
      action: { label: "Undo", onClick: () => { undo(); setCollapsed(false); clearTimeout(collapseTimerRef.current); } },
    });
    collapseTimerRef.current = setTimeout(() => navigate("/watch"), 15000);
  };

  const lk = useLiveKit({ roomId, mode: "spectator", enabled: !!debate && debate.status === "active" && !collapsed });
  const sideA_lk = debate ? lk.remoteParticipants.find((p) => p.identity === debate.side_a.identity) : null;
  const sideB_lk = debate ? lk.remoteParticipants.find((p) => p.identity === debate.side_b.identity) : null;

  const [viewMode, setViewMode] = useState("normal");
  const [spotlightIdentity, setSpotlightIdentity] = useState(null);
  useEffect(() => {
    if (debate && !spotlightIdentity) setSpotlightIdentity(debate.side_a.identity);
  }, [debate, spotlightIdentity]);

  if (!debate) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;
  const isLive = debate.status === "active";

  if (collapsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-muted)] text-sm text-[var(--fg-subtle)]">
        Collapsed. Heading back to the feed…
      </div>
    );
  }

  const extraTiles = (extras, prefix, sideLabel) => (extras || []).map((ex, i) => {
    const exLk = lk.remoteParticipants.find((p) => p.identity === ex.identity);
    return {
      key: `${prefix}-extra-${i}`,
      identity: ex.identity,
      overlay: <ViewerOverlay side={ex} navigate={navigate} />,
      videoEl: exLk?.videoEl,
      audioEl: exLk?.audioEl,
      audioMuted: exLk?.audioMuted,
      placeholderTitle: ex.display_name,
      placeholderSubtitle: ex.stance ? `e ${ex.stance.economic?.toFixed?.(1)} · s ${ex.stance.social?.toFixed?.(1)}` : `Joined ${sideLabel}`,
      placeholderFooter: isLive ? (lk.status === "connected" ? "Waiting for camera…" : "Connecting…") : "Debate ended",
    };
  });

  const tiles = [
    {
      key: "a",
      identity: debate.side_a.identity,
      overlay: <ViewerOverlay side={debate.side_a} navigate={navigate} />,
      videoEl: sideA_lk?.videoEl,
      audioEl: sideA_lk?.audioEl,
      audioMuted: sideA_lk?.audioMuted,
      placeholderTitle: debate.side_a.display_name,
      placeholderSubtitle: debate.side_a.stance ? `e ${debate.side_a.stance.economic?.toFixed?.(1)} · s ${debate.side_a.stance.social?.toFixed?.(1)}` : null,
      placeholderFooter: isLive ? (lk.status === "connected" ? "Waiting for camera…" : "Connecting…") : "Debate ended",
    },
    ...extraTiles(debate.side_a_extra, "a", "Side A"),
    {
      key: "b",
      identity: debate.side_b.identity || "side-b-open",
      overlay: <ViewerOverlay side={debate.side_b} navigate={navigate} />,
      videoEl: sideB_lk?.videoEl,
      audioEl: sideB_lk?.audioEl,
      audioMuted: sideB_lk?.audioMuted,
      placeholderTitle: debate.side_b.open ? "Open seat" : debate.side_b.display_name,
      placeholderSubtitle: debate.side_b.stance ? `e ${debate.side_b.stance.economic?.toFixed?.(1)} · s ${debate.side_b.stance.social?.toFixed?.(1)}` : null,
      placeholderFooter: debate.side_b.open ? "Waiting for a debater to join" : (isLive ? (lk.status === "connected" ? "Waiting for camera…" : "Connecting…") : "Debate ended"),
    },
    ...extraTiles(debate.side_b_extra, "b", "Side B"),
  ];
  const pickableSides = [
    { identity: debate.side_a.identity, label: "Side A" },
    ...(debate.side_a_extra || []).map((ex, i) => ({ identity: ex.identity, label: `A #${i + 2}` })),
    ...(debate.side_b.identity ? [{ identity: debate.side_b.identity, label: "Side B" }] : []),
    ...(debate.side_b_extra || []).map((ex, i) => ({ identity: ex.identity, label: `B #${i + 2}` })),
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-muted)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/watch")} className="btn-ghost text-sm" data-testid="nav-back-watch">← All debates</button>
          <div className="flex items-center gap-3 text-sm">
            {isLive
              ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span>
              : <span className="chip">Ended</span>}
            <span className="text-[var(--fg-subtle)] hidden sm:inline">{spectatorCount} watching</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={share} className="btn-outline text-sm" data-testid="btn-share">Share</button>
            <ThemeToggle />
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex gap-6 items-start">
        <RelatedDebates category={debate.categories?.[0]} excludeRoomId={roomId} navigate={navigate} />

        <main className="min-w-0 flex-1 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 flex flex-col relative">
            <div className="flex flex-col min-h-[45vh] md:min-h-[55vh]">
              <VideoStage
                tiles={tiles}
                viewMode={viewMode}
                spotlightIdentity={spotlightIdentity}
                onSpotlightChange={setSpotlightIdentity}
                mobileSpotlightIdentity={debate.side_a.identity}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <VideoControls
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                spotlightIdentity={spotlightIdentity}
                sides={pickableSides}
                onSpotlightChange={setSpotlightIdentity}
              />
              {debate.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {debate.categories.map((c) => <span key={c} className="chip">{c}</span>)}
                </div>
              )}
            </div>

            {debate.topics?.length > 0 && (
              <div className="mt-6 card p-5">
                <div className="eyebrow mb-2">Debate prompts</div>
                <ol className="space-y-2">
                  {debate.topics.map((t, i) => (
                    <li key={i} className="text-sm leading-snug border-l-2 border-[var(--accent)] pl-3" data-testid={`watch-topic-${i}`}>{t}</li>
                  ))}
                </ol>
              </div>
            )}

            {isLive && <JoinRequestPanel roomId={roomId} debate={debate} navigate={navigate} />}

            <div className="mt-6 card overflow-hidden">
              <div className="px-4 h-12 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-sm font-medium">Transcript</span>
                <span className={`text-xs ${connected ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]"}`}>
                  {connected ? "● Live" : "○ Replay"}
                </span>
              </div>
              <div className="max-h-[45vh] md:max-h-[420px] overflow-y-auto p-4 space-y-3" data-testid="transcript">
                {chat.length === 0 && <div className="text-sm text-[var(--fg-subtle)]">Waiting for the first move…</div>}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.speaker_side === "b" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.speaker_side === "b" ? "bg-[var(--fg)] text-white" : "bg-[var(--bg-muted)] border border-[var(--border)]"}`}>
                      <div className={`text-[10px] uppercase tracking-wider mb-1 ${m.speaker_side === "b" ? "text-white/60" : "text-[var(--fg-subtle)]"}`}>
                        {m.speaker} · Side {m.speaker_side?.toUpperCase()}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={like} className="btn-accent relative" data-testid="btn-like">
                ♥ {likes}
                {likeBurst > 0 && <span key={likeBurst} className="absolute -top-3 -right-3 text-lg text-[var(--accent)] animate-pulse">+1</span>}
              </button>
              <button onClick={share} className="btn-outline" data-testid="btn-share-2">Share</button>
              {debate.opposition_score != null && (
                <div className="text-xs text-[var(--fg-subtle)]">
                  Opposition score {debate.opposition_score?.toFixed?.(1) ?? debate.opposition_score}
                </div>
              )}
            </div>
          </div>

          <aside className="min-w-0">
            <div className="card overflow-hidden">
              <div className="px-4 h-12 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-sm font-medium">Spectator chat</span>
                <span className="text-xs text-[var(--fg-subtle)]">{spectatorCount} here</span>
              </div>
              <div className="min-h-[240px] max-h-[45vh] md:max-h-[520px] overflow-y-auto p-3 space-y-3 flex flex-col-reverse" data-testid="spectator-comments">
                <div ref={commentEndRef} />
                {comments.length === 0 && <div className="text-sm text-[var(--fg-subtle)] text-center py-4">No comments yet.</div>}
                {comments.map((c, i) => (
                  <div key={i} className="border-l-2 border-[var(--border-strong)] pl-3">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)]">
                      {c.author}{!c.authed && " · anon"}
                    </div>
                    <div className="text-sm break-words">{c.text}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--border)] p-3 flex gap-2">
                <input
                  data-testid="comment-input"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder={user ? "Add a comment…" : "Comment as anonymous…"}
                  maxLength={280}
                  className="field"
                />
                <button onClick={sendComment} className="btn-primary px-3" data-testid="btn-send-comment">Post</button>
              </div>
            </div>
          </aside>
        </main>
      </div>

      <button
        onClick={notInterested}
        className="fixed bottom-4 right-4 z-30 btn-outline text-xs shadow-lg bg-[var(--surface)]"
        data-testid="btn-not-interested"
        title="Not interested"
      >
        Not interested
      </button>
    </div>
  );
}
