import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, PanelRightClose, PanelRightOpen, Settings, ThumbsDown, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Track } from "livekit-client";
import { useLiveKit } from "@/lib/livekit";
import { pickMimeType } from "@/lib/mediaRecording";
import { VideoControls, VideoStage } from "@/components/VideoStage";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import ConfirmModal from "@/components/ConfirmModal";
import StreamSettingsModal from "@/components/StreamSettingsModal";
import InviteFriendsModal from "@/components/InviteFriendsModal";
import { useModalA11y } from "@/hooks/useModalA11y";

function PostDebateFeedbackModal({ rating, setRating, mindChanged, setMindChanged, notes, setNotes, onCancel, onSubmit }) {
  const modalRef = useModalA11y(onCancel);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Post-debate" className="card w-full max-w-lg p-6 sm:p-8">
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
          <input type="checkbox" checked={mindChanged} onChange={(e) => setMindChanged(e.target.checked)} data-testid="checkbox-mind-changed" className="checkbox" />
          <span className="text-sm">Did it change your mind on anything?</span>
        </label>
        <textarea data-testid="feedback-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional notes to yourself…" className="textarea mt-4" />
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onCancel} data-testid="btn-feedback-cancel">Not yet</button>
          <button className="btn-accent" onClick={onSubmit} data-testid="btn-feedback-submit">Submit & exit</button>
        </div>
      </div>
    </div>
  );
}

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
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatTab, setChatTab] = useState("debater"); // "debater" | "viewer"
  const [viewerComments, setViewerComments] = useState([]);
  const [decidingId, setDecidingId] = useState(null);
  const [kickTarget, setKickTarget] = useState(null); // {user_id, display_name} pending confirmation, or null
  const [kicking, setKicking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  // Live viewer-facing stats — piggybacks on pollViewerChat below (same
  // public poll WatchRoom uses), so a debater gets a passive read on how
  // their own stream is landing without a separate request.
  const [liveStats, setLiveStats] = useState({ spectator_count: 0, likes: 0, dislikes: 0 });
  // Unread indicators (a boolean per tab, not a count — one red dot no
  // matter how many messages piled up while you weren't looking).
  const [unreadDebater, setUnreadDebater] = useState(false);
  const [unreadViewer, setUnreadViewer] = useState(false);

  const sinceRef = useRef(null);
  const viewerSinceRef = useRef(null);
  const startedAtRef = useRef(Date.now());
  const messagesEndRef = useRef(null);
  // pollOnce/pollViewerChat run inside a setInterval set up once per effect
  // (deps deliberately don't include sidebarOpen/chatOpen/chatTab — the
  // interval shouldn't restart every time the user switches tabs), so they'd
  // otherwise close over stale versions of those three forever. Refs instead
  // of dependencies: read the live value without restarting the poll.
  const chatVisibleRef = useRef(true); // sidebar expanded (desktop) or drawer open (mobile)
  const chatTabRef = useRef(chatTab);
  useEffect(() => { chatVisibleRef.current = sidebarOpen || chatOpen; }, [sidebarOpen, chatOpen]);
  useEffect(() => { chatTabRef.current = chatTab; }, [chatTab]);
  // Whichever tab is actually on screen right now counts as read, the
  // instant it becomes the visible one — covers switching tabs, expanding
  // the sidebar, and opening the mobile drawer, all in one place instead of
  // duplicating the clear in every place chatTab/sidebarOpen/chatOpen changes.
  useEffect(() => {
    if (!(sidebarOpen || chatOpen)) return;
    if (chatTab === "debater") setUnreadDebater(false);
    if (chatTab === "viewer") setUnreadViewer(false);
  }, [sidebarOpen, chatOpen, chatTab]);

  // Initial fetch: a real failure here means the room genuinely isn't
  // accessible (not a participant, doesn't exist) — leaving is correct.
  const loadRoom = () => api.get(`/rooms/${roomId}`).then(({ data }) => setRoom(data)).catch(() => {
    toast.error("Room not accessible"); navigate("/");
  });

  useEffect(() => { loadRoom(); }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Roster/governance can change without a chat message ever being sent (a
  // join request gets approved, a kick vote lands) — poll the room doc
  // itself on its own cadence, separate from the chat/coach poll below.
  // This must NOT navigate away on failure like the initial loadRoom does:
  // it was previously reusing loadRoom directly, so a single transient
  // network blip mid-debate — a cold start, a momentary 5xx — would boot a
  // participant out of their own live debate. A poll miss here just skips
  // this cycle; the next tick tries again.
  const pollRoom = () => api.get(`/rooms/${roomId}`).then(({ data }) => setRoom(data)).catch(() => {});

  useEffect(() => {
    if (!room) return;
    const iv = setInterval(pollRoom, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomId]);

  const lk = useLiveKit({ roomId, mode: "participant", enabled: !!room });

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Free-tier self-recording: no LiveKit Egress (real per-minute cost), no
  // server-side compositing — each participant's own browser records ITS
  // OWN local camera+mic in ~15s chunks and uploads them progressively
  // (see rooms.py upload_recording_chunk's docstring for the full
  // reasoning). Depending on `hasCoDebaterNow` (a boolean, not the
  // participants array) matters: `room` gets replaced by a new object on
  // every ~4s poll even when nothing changed, and using the array itself
  // as a dependency would tear down and restart the recorder every poll,
  // fragmenting the recording into near-useless few-second chunks.
  const chunkSeqRef = useRef(0);
  const hasCoDebaterNow = (room?.participants || []).filter((p) => p.is_founding).length > 1;
  useEffect(() => {
    const videoTrack = lk.localVideoEl?.srcObject?.getVideoTracks?.()[0];
    const micPub = lk.room?.localParticipant?.getTrackPublication?.(Track.Source.Microphone);
    const audioTrack = micPub?.audioTrack?.mediaStreamTrack;
    if (!videoTrack || !audioTrack || !hasCoDebaterNow || !roomId) return;

    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(new MediaStream([videoTrack, audioTrack]), {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 800_000,
        audioBitsPerSecond: 64_000,
      });
    } catch {
      return; // a device/codec that can't record just skips recording — never blocks the debate itself
    }
    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      const form = new FormData();
      form.append("seq", String(chunkSeqRef.current++));
      form.append("video", e.data, "chunk.webm");
      api.post(`/rooms/${roomId}/recording-chunk`, form).catch(() => { /* best-effort — a dropped chunk is a gap in playback later, not a failed debate */ });
    };
    recorder.start(15000);
    return () => { if (recorder.state !== "inactive") recorder.stop(); };
  }, [lk.localVideoEl, lk.room, hasCoDebaterNow, roomId]);
  // block: "nearest" — see WatchRoom.jsx's identical fix: the default
  // ("start") drags every scrollable ancestor, including the page itself,
  // toward aligning this element to the top, not just the chat panel.
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);

  const wasPublicRef = useRef(false);

  const pollOnce = async () => {
    // sinceRef starts null, so the very first call fetches the room's whole
    // existing history — that's not "new" activity the user hasn't seen,
    // it's just the conversation as it already stood when they joined.
    const isInitialLoad = !sinceRef.current;
    try {
      const { data } = await api.get(`/rooms/${roomId}/messages`, { params: { since: sinceRef.current || undefined } });
      sinceRef.current = data.server_time;
      setConnected(true);
      if (data.is_public && !wasPublicRef.current) toast.success("You're live on the public feed.");
      wasPublicRef.current = data.is_public;
      setPublishState((p) => ({ ...p, is_public: data.is_public, publish_a: data.publish_a, publish_b: data.publish_b }));
      if (data.events?.length) {
        setMessages((m) => [...m, ...data.events]);
        // Coach nudges already get their own toast below — they aren't a
        // chat message from a person, so they don't also drive the dot.
        const hasNewChat = data.events.some((e) => e.type !== "coach");
        if (!isInitialLoad && hasNewChat && !(chatVisibleRef.current && chatTabRef.current === "debater")) {
          setUnreadDebater(true);
        }
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
    const isInitialLoad = !viewerSinceRef.current;
    try {
      const { data } = await api.get(`/public/debates/${roomId}/updates`, { params: { since: viewerSinceRef.current || undefined } });
      viewerSinceRef.current = data.server_time;
      setLiveStats({ spectator_count: data.spectator_count || 0, likes: data.likes || 0, dislikes: data.dislikes || 0 });
      const newComments = (data.events || []).filter((e) => e.type === "comment");
      if (newComments.length) {
        setViewerComments((c) => [...c, ...newComments]);
        if (!isInitialLoad && !(chatVisibleRef.current && chatTabRef.current === "viewer")) {
          setUnreadViewer(true);
        }
      }
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

  const pickTopic = async (index) => {
    try {
      const { data } = await api.post(`/rooms/${roomId}/topic-preference`, { topic_index: index });
      setRoom((r) => ({ ...r, topic_pref_a: data.topic_pref_a, topic_pref_b: data.topic_pref_b, custom_title: data.custom_title }));
      if (data.custom_title) toast.success("Title set — you both picked the same one.");
    } catch (e) { toast.error(e.response?.data?.detail || "Couldn't set topic preference"); }
  };

  const endDebate = () => setShowFeedback(true);

  const submitFeedback = async () => {
    try {
      await api.post(`/rooms/${roomId}/feedback`, { room_id: roomId, rating, mind_changed: mindChanged, notes });
      toast.success("Thanks. That's how discourse gets better.");
      navigate("/");
    } catch { toast.error("Feedback failed"); }
  };

  const decideJoinRequest = async (requesterId, approve) => {
    setDecidingId(requesterId);
    try {
      await api.post(`/rooms/${roomId}/join-requests/${requesterId}/decide`, { approve });
      pollRoom();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't record your decision");
    } finally {
      setDecidingId(null);
    }
  };

  const castKickVote = async (targetUserId) => {
    setKicking(true);
    try {
      const { data } = await api.post(`/rooms/${roomId}/kick-votes`, { target_user_id: targetUserId });
      toast(data.status === "kicked" ? "Removed from the debate." : `Vote recorded (${data.votes?.length || 0}/${data.needed?.length || "?"})`);
      setKickTarget(null);
      pollRoom();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't cast vote");
    } finally {
      setKicking(false);
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
      // camEnabled can be true for a moment before localVideoEl actually
      // arrives (re-acquiring the device takes a beat) — "Camera off" here
      // would be actively wrong during that window, not just imprecise.
      placeholderTitle: !lk.camEnabled ? "Camera off" : lk.status === "connecting" ? "Connecting…" : "Turning camera on…",
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
            onClick={() => setKickTarget({ user_id: p.user_id, display_name: p.display_name })}
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
          {room.is_founding && (
            <button
              onClick={() => setShowInvite(true)}
              className="btn-ghost !px-2.5"
              title="Invite friends"
              aria-label="Invite friends"
              data-testid="btn-invite-friends"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost !px-2.5"
            title="Stream settings"
            aria-label="Stream settings"
            data-testid="btn-stream-settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={endDebate} className="btn-danger text-xs px-3 py-1.5" data-testid="btn-end-debate">End</button>
          <ThemeToggle />
          <NotificationBell />
          <AccountMenu user={user} logout={logout} />
        </div>
      </header>

      {canTogglePublish && (myConsent || partnerConsent) && !publishState.is_public && (
        <div className="shrink-0 bg-[var(--accent-soft)] text-[color:var(--accent)] px-4 py-2 text-xs text-center border-b border-[var(--border)]">
          {myConsent ? "Waiting for your opposite to consent to publish…" : "Your opposite wants to go public — tap 'Go public' to agree."}
        </div>
      )}

      {hasCoDebater && !room.custom_title && room.topics?.length > 0 && (
        <div className="shrink-0 bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--fg-subtle)] mb-1.5">
            {(() => {
              const myPref = room.my_role === "a" ? room.topic_pref_a : room.topic_pref_b;
              const partnerPref = room.my_role === "a" ? room.topic_pref_b : room.topic_pref_a;
              if (myPref != null && partnerPref != null) return "You picked different topics — the debate stays untitled until you agree";
              if (myPref != null) return "Waiting for your opposite to pick a topic too…";
              return "Pick the topic that best matches this debate (optional — needs agreement from both sides)";
            })()}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {room.topics.map((t, i) => {
              const myPref = room.my_role === "a" ? room.topic_pref_a : room.topic_pref_b;
              const selected = myPref === i;
              return (
                <button
                  key={i}
                  onClick={() => pickTopic(i)}
                  data-testid={`btn-topic-${i}`}
                  className={selected ? "chip-accent text-xs" : "chip text-xs hover:bg-[var(--bg-muted)]"}
                >
                  {t}
                </button>
              );
            })}
          </div>
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

      <div className={`flex-1 min-h-0 grid grid-cols-1 ${sidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-[minmax(0,1fr)_64px]"}`}>
        {/* pb-20: the "Prompts"/"Chat" buttons below are fixed to the viewport's
            bottom corners (not part of this flex column), so nothing in normal
            flow reserves space for them — VideoControls, sized by its own
            content, could end up rendering at the same bottom-left screen
            position as "Prompts" on a phone-height viewport, since it has no
            clearance forcing it up and out of the way. Confirmed live: the
            camera-toggle button and "Prompts" genuinely overlapped, not just
            visually crowded — a real tap there could hit either one. Removed
            at lg: and up, where both floating buttons are already hidden
            (replaced by the docked sidebar) and this padding is not needed. */}
        <div className="min-h-0 flex flex-col px-3 sm:px-6 pt-3 sm:pt-6 pb-20 lg:pb-6 gap-3 sm:gap-4 overflow-hidden">
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
            {publishState.is_public && (
              <div className="flex items-center gap-3 text-xs text-[var(--fg-subtle)]" data-testid="live-stats">
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {liveStats.spectator_count}</span>
                <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {liveStats.likes}</span>
                <span className="inline-flex items-center gap-1"><ThumbsDown className="w-3.5 h-3.5" /> {liveStats.dislikes}</span>
              </div>
            )}
          </div>

          {room.topics?.length > 0 ? (
            <div className="hidden sm:block shrink-0 card p-4 max-h-[22vh] overflow-y-auto">
              <div className="eyebrow mb-2">Debate prompts</div>
              <ol className="space-y-2">
                {room.topics.map((t, i) => (
                  <li key={i} className="text-sm leading-snug border-l-2 border-[var(--accent)] pl-3" data-testid={`topic-${i}`}>{t}</li>
                ))}
              </ol>
            </div>
          ) : room.custom_title && (
            <div className="hidden sm:block shrink-0 card p-4 max-h-[22vh] overflow-y-auto">
              <div className="eyebrow mb-2">About this stream</div>
              <div className="text-sm font-medium leading-snug" data-testid="chatroom-title">{room.custom_title}</div>
              {room.description && (
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-[var(--fg-muted)]" data-testid="chatroom-description">{room.description}</p>
              )}
            </div>
          )}
        </div>

        <aside className="hidden lg:flex flex-col border-l border-[var(--border)] bg-[var(--surface)] min-h-0 overflow-hidden">
          <div className={`shrink-0 h-12 flex items-center border-b border-[var(--border)] ${sidebarOpen ? "justify-start px-2" : "justify-center"}`}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="btn-ghost !px-2 relative"
              title={sidebarOpen ? "Collapse chat" : "Expand chat"}
              data-testid="btn-toggle-chat-sidebar"
            >
              {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              {!sidebarOpen && (unreadDebater || unreadViewer) && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]" data-testid="chat-collapsed-unread-dot" />
              )}
            </button>
          </div>
          {sidebarOpen && (
            <ChatPanel
              connected={connected} messages={messages} user={user} participants={participants} text={text} setText={setText} sendChat={sendChat} messagesEndRef={messagesEndRef}
              isPublic={publishState.is_public} chatTab={chatTab} setChatTab={setChatTab} viewerComments={viewerComments}
              unreadDebater={unreadDebater} unreadViewer={unreadViewer}
            />
          )}
        </aside>
      </div>

      {(room.topics || []).length > 0 && (
        <button
          onClick={() => setTopicsOpen(true)}
          className="sm:hidden fixed bottom-4 left-4 z-30 btn-outline shadow-lg bg-[var(--surface)]"
          data-testid="btn-open-topics-mobile"
        >
          Prompts
        </button>
      )}
      {topicsOpen && (
        <div className="sm:hidden fixed inset-0 z-40 bg-[var(--surface)] flex flex-col">
          <div className="shrink-0 border-b border-[var(--border)] px-4 h-12 flex items-center justify-between">
            <span className="font-medium text-sm">Debate prompts</span>
            <button onClick={() => setTopicsOpen(false)} className="btn-ghost text-sm" data-testid="btn-close-topics-mobile">Close</button>
          </div>
          <ol className="flex-1 overflow-y-auto p-4 space-y-3">
            {(room.topics || []).map((t, i) => (
              <li key={i} className="text-sm leading-snug border-l-2 border-[var(--accent)] pl-3" data-testid={`topic-mobile-${i}`}>{t}</li>
            ))}
          </ol>
        </div>
      )}

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
            unreadDebater={unreadDebater} unreadViewer={unreadViewer}
          />
        </div>
      )}

      {kickTarget && (
        <ConfirmModal
          title={`Vote to remove ${kickTarget.display_name}?`}
          body="This needs every founding debater to agree before it takes effect. It can't be undone once the vote is unanimous."
          confirmLabel="Vote to kick"
          busy={kicking}
          onConfirm={() => castKickVote(kickTarget.user_id)}
          onClose={() => setKickTarget(null)}
          testIdPrefix="confirm-kick"
        />
      )}

      {showFeedback && (
        <PostDebateFeedbackModal
          rating={rating} setRating={setRating}
          mindChanged={mindChanged} setMindChanged={setMindChanged}
          notes={notes} setNotes={setNotes}
          onCancel={() => setShowFeedback(false)}
          onSubmit={submitFeedback}
        />
      )}

      {showSettings && (
        <StreamSettingsModal
          room={room}
          micEnabled={lk.micEnabled} camEnabled={lk.camEnabled}
          toggleMic={lk.toggleMic} toggleCamera={lk.toggleCamera} switchDevice={lk.switchDevice}
          onClose={() => setShowSettings(false)}
          onInfoSaved={(data) => setRoom((r) => ({ ...r, custom_title: data.custom_title, description: data.description }))}
        />
      )}

      {showInvite && <InviteFriendsModal roomId={roomId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

function ChatPanel({ connected, messages, user, participants, text, setText, sendChat, messagesEndRef, isPublic, chatTab, setChatTab, viewerComments, unreadDebater, unreadViewer }) {
  const showingViewer = isPublic && chatTab === "viewer";
  const nameFor = (userId) => participants.find((p) => p.user_id === userId)?.display_name || "Them";
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:flex shrink-0 h-12 px-4 border-b border-[var(--border)] items-center justify-between">
        {isPublic ? (
          <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">
            <button
              onClick={() => setChatTab("debater")}
              className={`relative px-3 py-1 text-xs font-medium ${chatTab !== "viewer" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
              data-testid="chat-tab-debater"
            >
              Debater chat
              {unreadDebater && chatTab !== "debater" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--danger)]" data-testid="chat-tab-debater-unread-dot" />
              )}
            </button>
            <button
              onClick={() => setChatTab("viewer")}
              className={`relative px-3 py-1 text-xs font-medium border-l border-[var(--border-strong)] ${chatTab === "viewer" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
              data-testid="chat-tab-viewer"
            >
              Viewer chat{viewerComments.length > 0 && ` · ${viewerComments.length}`}
              {unreadViewer && chatTab !== "viewer" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--danger)]" data-testid="chat-tab-viewer-unread-dot" />
              )}
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
        {messages.length === 0 && <div className="text-sm text-[var(--fg-subtle)]">Say something to get started.</div>}
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
