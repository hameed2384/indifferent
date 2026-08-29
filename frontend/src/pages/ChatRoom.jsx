import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLiveKit } from "@/lib/livekit";
import { VideoControls, VideoStage } from "@/components/VideoStage";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";

export default function ChatRoom() {
  const { roomId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [publishState, setPublishState] = useState({ publish_a: false, publish_b: false, is_public: false });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(4);
  const [mindChanged, setMindChanged] = useState(false);
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatTab, setChatTab] = useState("debater"); // "debater" | "viewer"
  const [viewerComments, setViewerComments] = useState([]);
  const [decidingId, setDecidingId] = useState(null);

  const sinceRef = useRef(null);
  const viewerSinceRef = useRef(null);
  const startedAtRef = useRef(Date.now());
  const messagesEndRef = useRef(null);

  const loadRoom = () => api.get(`/rooms/${roomId}`).then(({ data }) => setRoom(data)).catch(() => {
    toast.error("Room not accessible"); navigate("/dashboard");
  });

  useEffect(() => { loadRoom(); }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Roster/governance can change without a chat message ever being sent (a
  // join request gets approved, a kick vote lands) — poll the room doc
  // itself on its own cadence, separate from the chat/coach poll below.
  useEffect(() => {
    if (!room) return;
    const iv = setInterval(loadRoom, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomId]);

  const lk = useLiveKit({ roomId, mode: "participant", enabled: !!room });

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const wasPublicRef = useRef(false);

  const pollOnce = async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}/messages`, { params: { since: sinceRef.current || undefined } });
      sinceRef.current = data.server_time;
      setConnected(true);
      if (data.is_public && !wasPublicRef.current) toast.success("You're live on the public feed.");
      wasPublicRef.current = data.is_public;
      setPublishState((p) => ({ ...p, is_public: data.is_public, publish_a: data.publish_a, publish_b: data.publish_b }));
      if (data.events?.length) {
        setMessages((m) => [...m, ...data.events]);
        for (const evt of data.events) {
          if (evt.type === "coach") toast(`Coach: ${evt.nudge}`, { duration: 7000 });
        }
      }
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    if (!room || !user) return;
    pollOnce();
    const iv = setInterval(pollOnce, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, user, roomId]);

  // Viewer live chat — a read surface onto the public spectator comments,
  // separate from the debater's own private text channel above. Only polls
  // while the room is actually public; reuses the same public endpoint
  // WatchRoom polls, since a debater watching their own public comments
  // needs nothing a spectator doesn't already get.
  const pollViewerChat = async () => {
    try {
      const { data } = await api.get(`/public/debates/${roomId}/updates`, { params: { since: viewerSinceRef.current || undefined } });
      viewerSinceRef.current = data.server_time;
      const newComments = (data.events || []).filter((e) => e.type === "comment");
      if (newComments.length) setViewerComments((c) => [...c, ...newComments]);
    } catch { /* not public yet, or a transient miss — next tick retries */ }
  };

  useEffect(() => {
    if (!publishState.is_public) return;
    pollViewerChat();
    const iv = setInterval(pollViewerChat, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishState.is_public, roomId]);

  const sendChat = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await api.post(`/rooms/${roomId}/chat`, { text: t });
      pollOnce(); // don't wait for the next tick to see your own message
    } catch {
      toast.error("Message failed to send");
    }
  };

  const togglePublish = async () => {
    try {
      const { data } = await api.post(`/rooms/${roomId}/publish`);
      setPublishState(data);
    } catch { toast.error("Failed to update publish state"); }
  };

  const endDebate = () => setShowFeedback(true);

  const submitFeedback = async () => {
    try {
      await api.post(`/rooms/${roomId}/feedback`, { room_id: roomId, rating, mind_changed: mindChanged, notes });
      toast.success("Thanks. That's how discourse gets better.");
      navigate("/dashboard");
    } catch { toast.error("Feedback failed"); }
  };

  const decideJoinRequest = async (requesterId, approve) => {
    setDecidingId(requesterId);
    try {
      await api.post(`/rooms/${roomId}/join-requests/${requesterId}/decide`, { approve });
      loadRoom();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't record your decision");
    } finally {
      setDecidingId(null);
    }
  };

  const castKickVote = async (targetUserId) => {
    try {
      const { data } = await api.post(`/rooms/${roomId}/kick-votes`, { target_user_id: targetUserId });
      toast(data.status === "kicked" ? "Removed from the debate." : `Vote recorded (${data.votes?.length || 0}/${data.needed?.length || "?"})`);
      loadRoom();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't cast vote");
    }
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const myConsent = room?.my_role === "a" ? publishState.publish_a : publishState.publish_b;
  const partnerConsent = room?.my_role === "a" ? publishState.publish_b : publishState.publish_a;

  const participants = room?.participants || [];
  const others = participants.filter((p) => !p.is_self);
  const me = participants.find((p) => p.is_self);
  const hasCoDebater = participants.filter((p) => p.is_founding).length > 1;
  const canTogglePublish = !!me?.is_primary && hasCoDebater;

  const myIdentity = user ? `user-${user.user_id}` : "me";

  const [viewMode, setViewMode] = useState("normal");
  const [spotlightIdentity, setSpotlightIdentity] = useState(myIdentity);
  useEffect(() => {
    // Default spotlight to the first arrival on the other side (once) — never
    // yanks it away again afterward, including when a 2nd/3rd joiner arrives.
    if (others.length > 0 && spotlightIdentity === myIdentity) {
      setSpotlightIdentity(`user-${others[0].user_id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [others.length]);

  if (!room) {
    return <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-sm text-[var(--fg-subtle)]">Loading room…</div>;
  }

  const tiles = [
    {
      key: "local",
      identity: myIdentity,
      label: "You",
      videoEl: lk.camEnabled ? lk.localVideoEl : null,
      audioMuted: !lk.micEnabled,
      placeholderTitle: lk.camEnabled ? (lk.status === "connecting" ? "Connecting…" : "Camera off") : "Camera off",
    },
    ...others.map((p) => {
      const identity = `user-${p.user_id}`;
      const lkP = lk.remoteParticipants.find((rp) => rp.identity === identity);
      const canKick = room.is_founding && !p.is_founding;
      return {
        key: p.user_id,
        identity,
        label: `${p.display_name}${p.id_verified ? " ✓" : ""}`,
        videoEl: lkP?.videoEl,
        audioEl: lkP?.audioEl,
        audioMuted: lkP?.audioMuted,
        placeholderTitle: p.display_name,
        placeholderFooter: lk.status === "connected" ? "Waiting for camera…" : "Connecting…",
        overlay: canKick ? (
          <button
            onClick={() => castKickVote(p.user_id)}
            className="absolute top-2 right-2 bg-[var(--danger)]/90 text-white text-[10px] font-medium px-2 py-1 rounded-full hover:bg-[var(--danger)]"
            data-testid={`btn-kick-${p.user_id}`}
          >
            Vote to kick
          </button>
        ) : undefined,
      };
    }),
  ];

  return (
    <div className="h-screen bg-[var(--bg-muted)] text-[var(--fg)] flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {publishState.is_public
            ? <span className="chip-accent"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live</span>
            : <span className="chip">Private</span>}
          {lk.status === "connected" && <span className="text-xs text-[var(--fg-subtle)] hidden sm:inline">HD</span>}
        </div>
        <div className="font-mono-ui text-base tabular-nums text-[var(--fg)]" data-testid="room-timer">{mm}:{ss}</div>
        <div className="flex items-center gap-2">
          {canTogglePublish && (
            <button
              onClick={togglePublish}
              data-testid="btn-toggle-publish"
              className={myConsent ? "btn-accent text-xs px-3 py-1.5" : "btn-outline text-xs px-3 py-1.5"}
            >
              {myConsent ? "✓ Publish" : "Go public"}
            </button>
          )}
          <button onClick={endDebate} className="btn-danger text-xs px-3 py-1.5" data-testid="btn-end-debate">End</button>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="btn-outline text-xs px-3 py-1.5 hidden lg:inline-flex"
            data-testid="btn-toggle-chat-sidebar"
          >
            {sidebarOpen ? "Hide chat" : `Chat${messages.length > 0 ? ` · ${messages.length}` : ""}`}
          </button>
          <ThemeToggle />
          <AccountMenu user={user} logout={logout} />
        </div>
      </header>

      {canTogglePublish && (myConsent || partnerConsent) && !publishState.is_public && (
        <div className="shrink-0 bg-[var(--accent-soft)] text-[color:var(--accent)] px-4 py-2 text-xs text-center border-b border-[var(--border)]">
          {myConsent ? "Waiting for your opposite to consent to publish…" : "Your opposite wants to go public — tap 'Go public' to agree."}
        </div>
      )}

      {room.is_founding && room.join_requests?.length > 0 && (
        <div className="shrink-0 bg-[var(--accent-soft)] border-b border-[var(--border)] px-4 py-2 space-y-1.5">
          {room.join_requests.map((r) => (
            <div key={r.user_id} className="flex items-center justify-between gap-3 text-xs">
              <span>
                <strong>{r.display_name}</strong> wants to join side {String(r.side).toUpperCase()}
                {" "}({(r.approvals || []).length} approved)
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => decideJoinRequest(r.user_id, true)}
                  disabled={decidingId === r.user_id}
                  className="btn-accent !px-2 !py-1 !text-[11px]"
                  data-testid={`btn-approve-join-${r.user_id}`}
                >
                  Approve
                </button>
                <button
                  onClick={() => decideJoinRequest(r.user_id, false)}
                  disabled={decidingId === r.user_id}
                  className="btn-outline !px-2 !py-1 !text-[11px]"
                  data-testid={`btn-reject-join-${r.user_id}`}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`flex-1 min-h-0 grid grid-cols-1 ${sidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-1"}`}>
        <div className="min-h-0 flex flex-col p-3 sm:p-6 gap-3 sm:gap-4 overflow-hidden">
          <VideoStage
            tiles={tiles}
            viewMode={viewMode}
            spotlightIdentity={spotlightIdentity}
            onSpotlightChange={setSpotlightIdentity}
            mobileSpotlightIdentity={others[0] ? `user-${others[0].user_id}` : myIdentity}
          />

          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
            <VideoControls
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              micEnabled={lk.micEnabled}
              onToggleMic={lk.toggleMic}
              camEnabled={lk.camEnabled}
              onToggleCamera={lk.toggleCamera}
              spotlightIdentity={spotlightIdentity}
              sides={[
                { identity: myIdentity, label: "You" },
                ...others.map((p) => ({ identity: `user-${p.user_id}`, label: p.display_name })),
              ]}
              onSpotlightChange={setSpotlightIdentity}
            />
          </div>

          <div className="hidden sm:block shrink-0 card p-4 max-h-[22vh] overflow-y-auto">
            <div className="eyebrow mb-2">Debate prompts</div>
            <ol className="space-y-2">
              {(room.topics || []).map((t, i) => (
                <li key={i} className="text-sm leading-snug border-l-2 border-[var(--accent)] pl-3" data-testid={`topic-${i}`}>{t}</li>
              ))}
            </ol>
          </div>
        </div>

        {sidebarOpen && (
          <aside className="hidden lg:flex flex-col border-l border-[var(--border)] bg-[var(--surface)] min-h-0">
            <ChatPanel
              connected={connected} messages={messages} user={user} participants={participants} text={text} setText={setText} sendChat={sendChat} messagesEndRef={messagesEndRef}
              isPublic={publishState.is_public} chatTab={chatTab} setChatTab={setChatTab} viewerComments={viewerComments}
            />
          </aside>
        )}
      </div>

      <button
        onClick={() => setChatOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-30 btn-primary shadow-lg"
        data-testid="btn-open-chat-mobile"
      >
        Chat{messages.length > 0 && ` · ${messages.length}`}
      </button>
      {chatOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[var(--surface)] flex flex-col">
          <div className="shrink-0 border-b border-[var(--border)] px-4 h-12 flex items-center justify-between">
            <span className="font-medium text-sm">Text channel</span>
            <button onClick={() => setChatOpen(false)} className="btn-ghost text-sm" data-testid="btn-close-chat-mobile">Close</button>
          </div>
          <ChatPanel
            connected={connected} messages={messages} user={user} participants={participants} text={text} setText={setText} sendChat={sendChat} messagesEndRef={messagesEndRef}
            isPublic={publishState.is_public} chatTab={chatTab} setChatTab={setChatTab} viewerComments={viewerComments}
          />
        </div>
      )}

      {showFeedback && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg p-6 sm:p-8">
            <div className="eyebrow">Post-debate</div>
            <h2 className="font-heading text-2xl sm:text-3xl font-semibold mt-2">How did that go?</h2>
            <div className="mt-6">
              <div className="eyebrow mb-2">Rate the conversation</div>
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} data-testid={`rating-${n}`}
                    className={`h-12 rounded-lg border text-sm font-medium transition ${rating === n ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]" : "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 mt-6 cursor-pointer">
              <input type="checkbox" checked={mindChanged} onChange={(e) => setMindChanged(e.target.checked)} data-testid="checkbox-mind-changed" className="w-4 h-4 accent-[var(--accent)]" />
              <span className="text-sm">Did it change your mind on anything?</span>
            </label>
            <textarea data-testid="feedback-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional notes to yourself…" className="textarea mt-4" />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button className="btn-outline" onClick={() => setShowFeedback(false)} data-testid="btn-feedback-cancel">Not yet</button>
              <button className="btn-accent" onClick={submitFeedback} data-testid="btn-feedback-submit">Submit & exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatPanel({ connected, messages, user, participants, text, setText, sendChat, messagesEndRef, isPublic, chatTab, setChatTab, viewerComments }) {
  const showingViewer = isPublic && chatTab === "viewer";
  const nameFor = (userId) => participants.find((p) => p.user_id === userId)?.display_name || "Them";
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:flex shrink-0 h-12 px-4 border-b border-[var(--border)] items-center justify-between">
        {isPublic ? (
          <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">
            <button
              onClick={() => setChatTab("debater")}
              className={`px-3 py-1 text-xs font-medium ${chatTab !== "viewer" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
              data-testid="chat-tab-debater"
            >
              Debater chat
            </button>
            <button
              onClick={() => setChatTab("viewer")}
              className={`px-3 py-1 text-xs font-medium border-l border-[var(--border-strong)] ${chatTab === "viewer" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
              data-testid="chat-tab-viewer"
            >
              Viewer chat{viewerComments.length > 0 && ` · ${viewerComments.length}`}
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium">Text channel</span>
        )}
        <span className={`text-xs ${connected ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]"}`}>
          {connected ? "● Live" : "○ Offline"}
        </span>
      </div>

      {showingViewer ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" data-testid="viewer-chat-messages">
          {viewerComments.length === 0 && <div className="text-sm text-[var(--fg-subtle)]">No viewer comments yet.</div>}
          {viewerComments.map((c, i) => (
            <div key={i} className="border-l-2 border-[var(--border-strong)] pl-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)]">
                {c.author}{!c.authed && " · anon"}
              </div>
              <div className="text-sm break-words">{c.text}</div>
            </div>
          ))}
        </div>
      ) : (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" data-testid="chat-messages">
        {messages.map((m, i) => {
          if (m.type === "coach") {
            return (
              <div key={i} className="mx-auto max-w-full px-3 py-3 rounded-lg border border-dashed border-[var(--accent)] bg-[var(--accent-soft)]" data-testid={`coach-msg-${i}`}>
                <div className="text-[11px] uppercase tracking-widest text-[color:var(--accent)] font-medium mb-1 flex items-center justify-between">
                  <span>◈ Debate Coach</span>
                  <span className="opacity-70">{m.kind}</span>
                </div>
                <div className="text-sm text-[var(--fg)]">{m.nudge}</div>
              </div>
            );
          }
          const mine = m.from === user?.user_id;
          return (
            <div key={i} className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${mine ? "ml-auto bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bg-muted)] border border-[var(--border)]"}`}>
              <div className={`text-[10px] uppercase tracking-wider mb-1 ${mine ? "text-[var(--bg)]/60" : "text-[var(--fg-subtle)]"}`}>
                {mine ? "You" : nameFor(m.from)}
              </div>
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      )}

      {!showingViewer && (
        <div className="shrink-0 p-3 border-t border-[var(--border)] flex gap-2">
          <input
            data-testid="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Say what you mean…"
            className="field"
          />
          <button className="btn-primary px-4 text-sm" onClick={sendChat} data-testid="btn-send-chat">Send</button>
        </div>
      )}
    </div>
  );
}
