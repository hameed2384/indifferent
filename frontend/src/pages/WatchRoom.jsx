import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Flag, GitBranch, Heart, Share2, ThumbsDown, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLiveKit } from "@/lib/livekit";
import { VideoControls, VideoStage } from "@/components/VideoStage";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import AdSlot from "@/components/AdSlot";
import BackButton from "@/components/BackButton";
import ReportModal from "@/components/ReportModal";
import RecordClipModal from "@/components/RecordClipModal";
import RecordedDebatePlayer from "@/components/RecordedDebatePlayer";
import { excludeCategories } from "@/lib/notInterested";
import { startGoogleLogin } from "@/lib/auth";
import { STICKY_NAV } from "@/lib/navChrome";

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

/** allowCollapse (mobile only): once the viewer already has a vote in,
 * collapse to a one-line summary instead of leaving the full picker +
 * reasoning box open every time they land on this tab — there's nothing
 * left to fill in, so an open form reads as unfinished business. Desktop
 * doesn't pass this prop, so its behavior is exactly what it always was. */
function VotePanel({ votes, onVote, signedIn, sideALabel, sideBLabel, sideBOpen, allowCollapse }) {
  const [reasoning, setReasoning] = useState("");
  const [picked, setPicked] = useState(votes.my_vote);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(!votes.my_vote);

  useEffect(() => { setPicked(votes.my_vote); }, [votes.my_vote]);

  const total = (votes.votes_a || 0) + (votes.votes_b || 0);
  const pctA = total > 0 ? Math.round((votes.votes_a / total) * 100) : 50;

  const submit = async () => {
    if (!picked) return;
    setSubmitting(true);
    try {
      await onVote(picked, reasoning);
      if (allowCollapse) setExpanded(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (allowCollapse && votes.my_vote && !expanded) {
    return (
      <div className="card p-4 flex items-center justify-between gap-3" data-testid="vote-collapsed-summary">
        <span className="text-sm text-[var(--fg-muted)]">
          You voted <strong className="text-[var(--fg)]">{votes.my_vote === "a" ? sideALabel : sideBLabel}</strong>
        </span>
        <button onClick={() => setExpanded(true)} className="btn-outline text-xs shrink-0" data-testid="btn-change-vote">Change</button>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="eyebrow mb-3">Who do you agree with?</div>
      <div className="flex rounded-lg overflow-hidden border border-[var(--border-strong)] h-8 mb-2" data-testid="vote-bar">
        <div className="bg-[var(--accent)] flex items-center justify-center text-white text-[11px] font-medium transition-all" style={{ width: `${pctA}%` }}>
          {total > 0 && pctA > 12 ? `${pctA}%` : ""}
        </div>
        <div className="bg-[var(--fg)] flex items-center justify-center text-[var(--bg)] text-[11px] font-medium transition-all" style={{ width: `${100 - pctA}%` }}>
          {total > 0 && 100 - pctA > 12 ? `${100 - pctA}%` : ""}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-[var(--fg-subtle)] mb-4">
        <span className="truncate">{sideALabel} · {votes.votes_a || 0}</span>
        <span className="truncate">{sideBLabel} · {votes.votes_b || 0}</span>
      </div>

      {!signedIn ? (
        <p className="text-sm text-[var(--fg-subtle)]">Sign in to vote and refine your own topic profile.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setPicked("a")} className={picked === "a" ? "btn-accent flex-1" : "btn-outline flex-1"} data-testid="vote-side-a">{sideALabel}</button>
            <button
              onClick={() => setPicked("b")}
              disabled={sideBOpen}
              className={`${picked === "b" ? "btn-accent" : "btn-outline"} flex-1 disabled:opacity-40`}
              title={sideBOpen ? "Nobody's taken this side yet" : undefined}
              data-testid="vote-side-b"
            >
              {sideBLabel}
            </button>
          </div>
          {picked && (
            <>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Optional: why? (sharpens your own topic profile)"
                rows={2}
                maxLength={1000}
                className="textarea mb-2"
                data-testid="vote-reasoning"
              />
              <button onClick={submit} disabled={submitting} className="btn-primary w-full text-sm" data-testid="btn-submit-vote">
                {submitting ? "Saving…" : votes.my_vote ? "Update vote" : "Submit vote"}
              </button>
              {allowCollapse && votes.my_vote && (
                <button onClick={() => setExpanded(false)} className="btn-ghost w-full text-xs mt-1" data-testid="btn-cancel-change-vote">Cancel</button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function RelatedDebates({ category, excludeRoomId, navigate, collapsed, onToggleCollapsed }) {
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
    <aside className={`hidden lg:flex flex-col shrink-0 transition-[width] duration-150 ${collapsed ? "w-12" : "w-64"}`}>
      <button
        onClick={onToggleCollapsed}
        className={`btn-ghost !justify-start gap-3 mb-3 ${collapsed ? "!justify-center !px-0" : ""}`}
        title={collapsed ? "Expand suggested content" : "Collapse suggested content"}
        data-testid="btn-toggle-related"
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        {!collapsed && <span className="text-sm">Collapse</span>}
      </button>
      {!collapsed && (
        <>
          <div className="eyebrow mb-3">Suggested</div>
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
        </>
      )}
    </aside>
  );
}

/** Debater chat (read-only mirror of the debate's own transcript) + viewer
 * chat (spectator comments, read/write), unified into one collapsible
 * sidebar with a tab per side — same shape as ChatRoom.jsx's chat sidebar,
 * so a viewer and a debater get a consistent chat surface instead of two
 * differently-built ones. Desktop only — see MobileWatch for the phone
 * layout's own version of this same content. */
function WatchChatSidebar({
  collapsed, onToggleCollapsed, chatTab, setChatTab, unreadDebater, unreadViewer,
  chat, isLive, connected, chatEndRef,
  comments, commentEndRef, commentText, setCommentText, sendComment, user, spectatorCount,
}) {
  return (
    <aside className="hidden lg:flex min-w-0 flex-col border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
      <div className={`shrink-0 h-12 flex items-center border-b border-[var(--border)] ${collapsed ? "justify-center" : "justify-between px-3"}`}>
        {!collapsed && (
          <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">
            <button
              onClick={() => setChatTab("debater")}
              className={`relative px-3 py-1 text-xs font-medium ${chatTab !== "viewer" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
              data-testid="watch-chat-tab-debater"
            >
              Debater chat
              {unreadDebater && chatTab !== "debater" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--danger)]" data-testid="watch-chat-tab-debater-unread-dot" />
              )}
            </button>
            <button
              onClick={() => setChatTab("viewer")}
              className={`relative px-3 py-1 text-xs font-medium border-l border-[var(--border-strong)] ${chatTab === "viewer" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
              data-testid="watch-chat-tab-viewer"
            >
              Viewer chat{spectatorCount > 0 && ` · ${spectatorCount}`}
              {unreadViewer && chatTab !== "viewer" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--danger)]" data-testid="watch-chat-tab-viewer-unread-dot" />
              )}
            </button>
          </div>
        )}
        <button
          onClick={onToggleCollapsed}
          className="btn-ghost !px-2 relative"
          title={collapsed ? "Expand chat" : "Collapse chat"}
          data-testid="btn-toggle-watch-chat-sidebar"
        >
          {collapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          {collapsed && (unreadDebater || unreadViewer) && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]" data-testid="watch-chat-collapsed-unread-dot" />
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="shrink-0 p-3 border-b border-[var(--border)]">
            <AdSlot variant="banner" />
          </div>
          {chatTab === "viewer" ? (
            <ViewerChatBody comments={comments} commentEndRef={commentEndRef} commentText={commentText} setCommentText={setCommentText} sendComment={sendComment} user={user} maxHeightClass="min-h-[240px] max-h-[50vh] md:max-h-[520px]" />
          ) : (
            <DebaterChatBody chat={chat} isLive={isLive} connected={connected} chatEndRef={chatEndRef} maxHeightClass="min-h-[240px] max-h-[50vh] md:max-h-[520px]" />
          )}
        </>
      )}
    </aside>
  );
}

function ViewerChatBody({ comments, commentEndRef, commentText, setCommentText, sendComment, user, maxHeightClass }) {
  return (
    <>
      <div className={`${maxHeightClass} overflow-y-auto p-3 space-y-3 flex flex-col-reverse`} data-testid="spectator-comments">
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
      <div className="shrink-0 border-t border-[var(--border)] p-3 flex gap-2">
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
    </>
  );
}

function DebaterChatBody({ chat, isLive, connected, chatEndRef, maxHeightClass }) {
  // isLive is the debate's own status, not the poll connection — connected
  // only means "the last poll for updates succeeded," which is equally true
  // for an ended debate being replayed. Confirmed live: this previously said
  // "● Live" on a debate that had already ended, right next to "Debate
  // ended" on both video tiles. A replay isn't reconnecting to anything, so
  // it always just reads "Replay"; only a genuinely live debate's own
  // connection state is worth surfacing.
  const statusLabel = !isLive ? "○ Replay" : connected ? "● Live" : "○ Reconnecting…";
  const statusClass = isLive && connected ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]";
  return (
    <div className={`${maxHeightClass} overflow-y-auto p-3 space-y-3`} data-testid="transcript">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] text-[var(--fg-subtle)]">Debate transcript</span>
        <span className={`text-[11px] ${statusClass}`}>{statusLabel}</span>
      </div>
      {chat.length === 0 && <div className="text-sm text-[var(--fg-subtle)]">Waiting for the first move…</div>}
      {chat.map((m, i) => (
        <div key={i} className={`flex ${m.speaker_side === "b" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${m.speaker_side === "b" ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bg-muted)] border border-[var(--border)]"}`}>
            <div className={`text-[10px] uppercase tracking-wider mb-1 ${m.speaker_side === "b" ? "text-[var(--bg)]/60" : "text-[var(--fg-subtle)]"}`}>
              {m.speaker} · Side {m.speaker_side?.toUpperCase()}
            </div>
            <div className="whitespace-pre-wrap break-words">{m.text}</div>
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
}

/** Phone layout: the debaters' cameras stay pinned on screen and everything
 * else — chat (both kinds), voting — lives in a tab strip underneath,
 * instead of a long column the viewer has to scroll through. Built as its
 * own layout rather than reusing the desktop column, since "video always
 * visible, no scrolling" is a different page shape, not a narrower version
 * of the same one. */
function MobileWatch({
  debate, isLive, tiles, viewMode, spotlightIdentity, setSpotlightIdentity, pickableSides,
  mobileTab, setMobileTab, unreadDebater, unreadViewer,
  chat, connected, chatEndRef,
  comments, commentEndRef, commentText, setCommentText, sendComment, user, spectatorCount,
  likes, dislikes, myReaction, like, dislike,
  votes, castVote, notInterested, roomId, navigate,
}) {
  return (
    <div className="lg:hidden flex flex-col h-[calc(100dvh-56px)]">
      {/* VideoStage's own tree is a flex-1/min-h-0 cascade all the way down —
          it needs a flex ancestor with a genuinely resolved height to anchor
          to, same requirement that shaped the desktop column's own
          min-h-[45vh]/[80vh]. h-[42dvh] (not vh, to match the app-shell's
          own dvh-based height budget above) gives this wrapper a real
          pixel height, but that alone isn't enough: VideoStage's top-level
          element is itself a flex-1 item, and flex-1 only does anything
          inside a flex parent. Without `flex` here this div stayed a plain
          block box, so VideoStage's flex-1 chain had nothing to grow into
          and still collapsed to ~0 even with the height fixed — confirmed
          live, the whole video area rendered as blank space. */}
      <div className="shrink-0 h-[42dvh] p-2 flex">
        {!isLive && debate.recording ? (
          <RecordedDebatePlayer recording={debate.recording} sideALabel={debate.side_a.display_name} sideBLabel={debate.side_b.display_name} />
        ) : (
          <VideoStage
            tiles={tiles}
            viewMode={viewMode}
            spotlightIdentity={spotlightIdentity}
            onSpotlightChange={setSpotlightIdentity}
            mobileSpotlightIdentity={debate.side_a.identity}
          />
        )}
      </div>

      <div className="shrink-0 px-3 pb-2 flex items-center justify-between gap-2">
        {debate.categories?.[0] ? <span className="chip !py-0.5 !px-2 !text-[10px]">{debate.categories[0]}</span> : <span />}
        <button onClick={notInterested} className="btn-ghost !text-[11px] !px-2 !py-1" data-testid="btn-not-interested-mobile">Not interested</button>
      </div>

      {isLive && (
        <div className="shrink-0 px-3">
          <JoinRequestPanel roomId={roomId} debate={debate} navigate={navigate} />
        </div>
      )}

      <div className="shrink-0 flex border-b border-[var(--border)]">
        {[
          { key: "debater", label: "Debater chat", dot: unreadDebater },
          { key: "viewer", label: `Viewer chat${spectatorCount > 0 ? ` · ${spectatorCount}` : ""}`, dot: unreadViewer },
          { key: "vote", label: "Vote", dot: false },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setMobileTab(t.key)}
            className={`relative flex-1 px-2 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${mobileTab === t.key ? "border-[var(--accent)] text-[var(--fg)]" : "border-transparent text-[var(--fg-subtle)]"}`}
            data-testid={`mobile-watch-tab-${t.key}`}
          >
            {t.label}
            {t.dot && mobileTab !== t.key && (
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[var(--danger)]" data-testid={`mobile-watch-tab-${t.key}-unread-dot`} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {mobileTab === "viewer" && (
          <ViewerChatBody comments={comments} commentEndRef={commentEndRef} commentText={commentText} setCommentText={setCommentText} sendComment={sendComment} user={user} maxHeightClass="h-full" />
        )}
        {mobileTab === "debater" && (
          <DebaterChatBody chat={chat} isLive={isLive} connected={connected} chatEndRef={chatEndRef} maxHeightClass="h-full" />
        )}
        {mobileTab === "vote" && (
          <div className="h-full overflow-y-auto p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={like}
                aria-pressed={myReaction === "like"}
                className={`inline-flex items-center gap-1.5 ${myReaction === "like" ? "btn-accent" : "btn-outline"}`}
                data-testid="btn-like-mobile"
              >
                <Heart className="w-4 h-4" /> {likes}
              </button>
              <button
                onClick={dislike}
                aria-pressed={myReaction === "dislike"}
                className={`inline-flex items-center gap-1.5 ${myReaction === "dislike" ? "btn-danger" : "btn-outline"}`}
                data-testid="btn-dislike-mobile"
              >
                <ThumbsDown className="w-4 h-4" /> {dislikes}
              </button>
            </div>
            <VotePanel
              votes={votes}
              onVote={castVote}
              signedIn={!!user}
              sideALabel={debate.side_a.display_name}
              sideBLabel={debate.side_b.open ? "Side B" : debate.side_b.display_name}
              sideBOpen={debate.side_b.open}
              allowCollapse
            />
          </div>
        )}
      </div>
    </div>
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
  const [dislikes, setDislikes] = useState(0);
  const [myReaction, setMyReaction] = useState(null); // "like" | "dislike" | null
  const [votes, setVotes] = useState({ votes_a: 0, votes_b: 0, my_vote: null });
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [relatedCollapsed, setRelatedCollapsed] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [chatTab, setChatTab] = useState("debater"); // "debater" | "viewer" — desktop sidebar
  const [mobileTab, setMobileTab] = useState("debater"); // "debater" | "viewer" | "vote" — phone tab strip
  const [unreadDebater, setUnreadDebater] = useState(false);
  const [unreadViewer, setUnreadViewer] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTurnIntoClaim, setShowTurnIntoClaim] = useState(false);
  const [allCategories, setAllCategories] = useState([]);

  const sinceRef = useRef(null);
  // Bumped by applyReaction (a like/dislike click), never by pollOnce itself.
  // pollOnce's own likes/dislikes are stale the moment a click resolves more
  // recently, since the two race independently every ~3s — without this, a
  // poll already in flight when the user clicks can land afterward and
  // briefly clobber the fresh count/highlight back to the pre-click value.
  const reactionSeqRef = useRef(0);
  const clientIdRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `spectator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const chatEndRef = useRef(null);
  const commentEndRef = useRef(null);
  const collapseTimerRef = useRef(null);
  // pollOnce runs inside a setInterval set up once per effect (deps don't
  // include the tab/visibility state below, so switching tabs doesn't
  // restart the poll) — reading those directly would close over stale
  // values forever, same reasoning as ChatRoom.jsx's identical refs. Two
  // surfaces can show this content now (the desktop sidebar, the mobile tab
  // strip), so a "seen" check has to pass on either one.
  const chatVisibleRef = useRef(true);
  const chatTabRef = useRef(chatTab);
  const mobileTabRef = useRef(mobileTab);
  useEffect(() => { chatVisibleRef.current = chatSidebarOpen; }, [chatSidebarOpen]);
  useEffect(() => { chatTabRef.current = chatTab; }, [chatTab]);
  useEffect(() => { mobileTabRef.current = mobileTab; }, [mobileTab]);
  useEffect(() => {
    const debaterVisible = (chatSidebarOpen && chatTab === "debater") || mobileTab === "debater";
    const viewerVisible = (chatSidebarOpen && chatTab === "viewer") || mobileTab === "viewer";
    if (debaterVisible) setUnreadDebater(false);
    if (viewerVisible) setUnreadViewer(false);
  }, [chatSidebarOpen, chatTab, mobileTab]);

  useEffect(() => {
    api.get("/categories").then(({ data }) => setAllCategories(data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/debates/${roomId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setDebate(data);
        setChat(data.chat || []);
        setComments((data.comments || []).slice().reverse());
        setLikes(data.likes || 0);
        setDislikes(data.dislikes || 0);
        setMyReaction(data.my_reaction || null);
        setVotes({ votes_a: data.votes_a || 0, votes_b: data.votes_b || 0, my_vote: data.my_vote || null });
        setSpectatorCount(data.spectator_count || 0);
        sinceRef.current = data.server_time;
      })
      .catch(() => { toast.error("Debate not available"); navigate("/watch"); });
    return () => { cancelled = true; };
  }, [roomId, navigate]);

  const pollOnce = async () => {
    const seq = reactionSeqRef.current;
    try {
      const { data } = await api.get(`/public/debates/${roomId}/updates`, {
        params: { since: sinceRef.current || undefined, client_id: clientIdRef.current },
      });
      sinceRef.current = data.server_time;
      setConnected(true);
      if (seq === reactionSeqRef.current) {
        setLikes(data.likes);
        setDislikes(data.dislikes || 0);
      }
      setVotes((v) => ({ ...v, votes_a: data.votes_a || 0, votes_b: data.votes_b || 0 }));
      setSpectatorCount(data.spectator_count);
      // sinceRef only ever advances past the debate's already-loaded history
      // (set from the initial /public/debates/{roomId} fetch above), so
      // every event pollOnce sees here is genuinely new since this viewer
      // arrived — no "was this the initial load" check needed, unlike
      // ChatRoom.jsx's pollOnce, which conflates that fetch with polling.
      let newDebaterChat = false;
      let newViewerComment = false;
      for (const evt of data.events || []) {
        if (evt.type === "debate-chat") {
          setChat((c) => [...c, { text: evt.text, speaker: evt.speaker, speaker_side: evt.speaker_side, created_at: evt.ts }]);
          newDebaterChat = true;
        } else if (evt.type === "comment") {
          setComments((c) => [{ text: evt.text, author: evt.author, authed: evt.authed, created_at: evt.ts }, ...c]);
          newViewerComment = true;
        }
      }
      const debaterVisible = (chatVisibleRef.current && chatTabRef.current === "debater") || mobileTabRef.current === "debater";
      const viewerVisible = (chatVisibleRef.current && chatTabRef.current === "viewer") || mobileTabRef.current === "viewer";
      if (newDebaterChat && !debaterVisible) setUnreadDebater(true);
      if (newViewerComment && !viewerVisible) setUnreadViewer(true);
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

  // block: "nearest" is load-bearing, not cosmetic: the default ("start")
  // walks up every scrollable ancestor trying to align this element to the
  // top of each, including the page itself — which reliably auto-scrolled
  // the whole page ~300px on load, shoving the video tiles (and the follow
  // button on them) off-screen the moment chat/comments first populated.
  // "nearest" keeps the scroll scoped to the panel's own overflow-y-auto.
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [chat]);
  useEffect(() => { commentEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [comments.length]);
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

  const applyReaction = ({ likes: l, dislikes: d, my_reaction }) => {
    reactionSeqRef.current++; // invalidate any poll already in flight (see reactionSeqRef)
    setLikes(l);
    setDislikes(d);
    setMyReaction(my_reaction);
  };

  const like = () => {
    if (!user) { toast.info("Sign in to like"); return; }
    api.post(`/public/debates/${roomId}/like`).then(({ data }) => applyReaction(data)).catch(() => toast.error("Couldn't record that — try again"));
  };

  const dislike = () => {
    if (!user) { toast.info("Sign in to react"); return; }
    api.post(`/public/debates/${roomId}/dislike`).then(({ data }) => applyReaction(data)).catch(() => toast.error("Couldn't record that — try again"));
  };

  const castVote = async (side, reasoning) => {
    if (!user) { toast.info("Sign in to vote"); return; }
    try {
      const { data } = await api.post(`/public/debates/${roomId}/vote`, { side, reasoning });
      setVotes({ votes_a: data.votes_a, votes_b: data.votes_b, my_vote: data.my_vote });
      toast.success("Vote recorded — thanks for weighing in.");
    } catch {
      toast.error("Couldn't record your vote");
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "indifferent — live debate", url });
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
      <nav className={STICKY_NAV}>
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <BackButton to="/watch" label="All debates" data-testid="nav-back-watch" />
          <div className="flex items-center gap-3 text-sm">
            {isLive
              ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span>
              : <span className="chip">Ended</span>}
            <span className="text-[var(--fg-subtle)] hidden sm:inline">{spectatorCount} {isLive ? "viewers" : "views"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={share} className="btn-outline text-sm inline-flex items-center gap-1.5" data-testid="btn-share"><Share2 className="w-4 h-4" /> Share</button>
            <ThemeToggle />
            {user && <NotificationBell />}
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
      </nav>

      <MobileWatch
        debate={debate} isLive={isLive} tiles={tiles} viewMode={viewMode}
        spotlightIdentity={spotlightIdentity} setSpotlightIdentity={setSpotlightIdentity} pickableSides={pickableSides}
        mobileTab={mobileTab} setMobileTab={setMobileTab} unreadDebater={unreadDebater} unreadViewer={unreadViewer}
        chat={chat} connected={connected} chatEndRef={chatEndRef}
        comments={comments} commentEndRef={commentEndRef} commentText={commentText} setCommentText={setCommentText} sendComment={sendComment} user={user} spectatorCount={spectatorCount}
        likes={likes} dislikes={dislikes} myReaction={myReaction} like={like} dislike={dislike}
        votes={votes} castVote={castVote} notInterested={notInterested} roomId={roomId} navigate={navigate}
      />

      <div className="hidden lg:flex px-4 sm:px-6 py-6 sm:py-8 gap-6 items-start">
        <RelatedDebates
          category={debate.categories?.[0]} excludeRoomId={roomId} navigate={navigate}
          collapsed={relatedCollapsed} onToggleCollapsed={() => setRelatedCollapsed((v) => !v)}
        />

        <main className={`min-w-0 flex-1 grid gap-6 ${chatSidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)_64px]"}`}>
          <div className="min-w-0 flex flex-col relative">
            <div className={`flex flex-col min-h-0 ${viewMode === "cinema" ? "lg:min-h-[80vh]" : ""}`}>
              {!isLive && debate.recording ? (
                <RecordedDebatePlayer recording={debate.recording} sideALabel={debate.side_a.display_name} sideBLabel={debate.side_b.display_name} />
              ) : (
                <VideoStage
                  tiles={tiles}
                  viewMode={viewMode}
                  spotlightIdentity={spotlightIdentity}
                  onSpotlightChange={setSpotlightIdentity}
                  mobileSpotlightIdentity={debate.side_a.identity}
                />
              )}
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

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={like}
                aria-pressed={myReaction === "like"}
                className={`inline-flex items-center gap-1.5 ${myReaction === "like" ? "btn-accent" : "btn-outline"}`}
                data-testid="btn-like"
              >
                <Heart className="w-4 h-4" /> {likes}
              </button>
              <button
                onClick={dislike}
                aria-pressed={myReaction === "dislike"}
                className={`inline-flex items-center gap-1.5 ${myReaction === "dislike" ? "btn-danger" : "btn-outline"}`}
                data-testid="btn-dislike"
              >
                <ThumbsDown className="w-4 h-4" /> {dislikes}
              </button>
              <button onClick={share} className="btn-outline inline-flex items-center gap-1.5" data-testid="btn-share-2"><Share2 className="w-4 h-4" /> Share</button>
              {!isLive && (
                <button
                  onClick={() => { if (!user) { toast.info("Sign in to post a claim"); return; } setShowTurnIntoClaim(true); }}
                  className="btn-outline inline-flex items-center gap-1.5"
                  title="Post a video claim inspired by this debate"
                  data-testid="btn-turn-into-claim"
                >
                  <GitBranch className="w-4 h-4" /> Turn into a claim
                </button>
              )}
              <button
                onClick={() => { if (!user) { toast.info("Sign in to report"); return; } setShowReportModal(true); }}
                className="btn-ghost !px-2.5"
                title="Report this debate"
                aria-label="Report this debate"
                data-testid="btn-report-room"
              >
                <Flag className="w-4 h-4" />
              </button>
              {debate.opposition_score != null && (
                <div className="text-xs text-[var(--fg-subtle)]">
                  Opposition score {debate.opposition_score?.toFixed?.(1) ?? debate.opposition_score}
                </div>
              )}
            </div>

            <div className="mt-6">
              <VotePanel
                votes={votes}
                onVote={castVote}
                signedIn={!!user}
                sideALabel={debate.side_a.display_name}
                sideBLabel={debate.side_b.open ? "Side B" : debate.side_b.display_name}
                sideBOpen={debate.side_b.open}
              />
            </div>
          </div>

          <WatchChatSidebar
            collapsed={!chatSidebarOpen}
            onToggleCollapsed={() => setChatSidebarOpen((v) => !v)}
            chatTab={chatTab}
            setChatTab={setChatTab}
            unreadDebater={unreadDebater}
            unreadViewer={unreadViewer}
            chat={chat}
            isLive={isLive}
            connected={connected}
            chatEndRef={chatEndRef}
            comments={comments}
            commentEndRef={commentEndRef}
            commentText={commentText}
            setCommentText={setCommentText}
            sendComment={sendComment}
            user={user}
            spectatorCount={spectatorCount}
          />
        </main>
      </div>

      <button
        onClick={notInterested}
        className="hidden lg:block fixed bottom-4 right-4 z-30 btn-outline text-xs shadow-lg bg-[var(--surface)]"
        data-testid="btn-not-interested"
        title="Not interested"
      >
        Not interested
      </button>

      {showTurnIntoClaim && (
        <RecordClipModal
          categories={allCategories}
          sourceRoomId={roomId}
          initialCategory={debate.categories?.[0]}
          onClose={() => setShowTurnIntoClaim(false)}
          onPosted={(id) => { setShowTurnIntoClaim(false); navigate(`/claims/${id}`); }}
        />
      )}

      {showReportModal && <ReportModal targetType="room" targetId={roomId} onClose={() => setShowReportModal(false)} />}
    </div>
  );
}
