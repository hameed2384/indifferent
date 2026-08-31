import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLiveKit } from "@/lib/livekit";
import { VideoStage } from "@/components/VideoStage";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import BackButton from "@/components/BackButton";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_COMPACT } from "@/lib/layout";

/** Client brief #14 — private friend chat/call. Its own page, its own
 * component tree: nothing here imports anything debate/coach-related, so
 * there is no code path by which this content could end up in front of an
 * AI call. "AI-blind" is a fact about this file's imports, not a setting. */
export default function PrivateChat() {
  const { friendId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [inCall, setInCall] = useState(false);
  const [publicRoomId, setPublicRoomId] = useState(null);
  const [goingPublic, setGoingPublic] = useState(false);
  const [notFriends, setNotFriends] = useState(false);

  const sinceRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastPromptedRoomRef = useRef(null);

  useEffect(() => {
    api.get(`/friends`).then(({ data }) => {
      const f = data.friends.find((x) => x.user_id === friendId);
      if (!f) { setNotFriends(true); return; }
      setFriend(f);
    }).catch(() => setNotFriends(true));
  }, [friendId]);

  const pollOnce = async () => {
    try {
      const { data } = await api.get(`/private/messages/${friendId}`, { params: { since: sinceRef.current || undefined } });
      sinceRef.current = data.server_time;
      if (data.messages?.length) setMessages((m) => [...m, ...data.messages]);
      setPublicRoomId(data.public_room_id || null);
      if (data.public_room_id && data.public_room_id !== lastPromptedRoomRef.current) {
        lastPromptedRoomRef.current = data.public_room_id;
        toast(`${friend?.display_name || "Your friend"} turned this into a public debate.`, {
          duration: 15000,
          action: { label: "Join", onClick: () => navigate(`/room/${data.public_room_id}`) },
        });
      }
    } catch { /* transient — next tick retries */ }
  };

  useEffect(() => {
    if (notFriends) return;
    pollOnce();
    const iv = setInterval(pollOnce, 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, notFriends]);

  // block: "nearest" — see WatchRoom.jsx's identical fix: the default
  // ("start") drags every scrollable ancestor, including the page itself,
  // toward aligning this element to the top, not just the chat panel.
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await api.post(`/private/messages/${friendId}`, { text: t });
      pollOnce();
    } catch {
      toast.error("Message failed to send");
    }
  };

  const lk = useLiveKit({
    roomId: `private-${friendId}`,
    mode: "participant",
    enabled: inCall,
    tokenEndpoint: `/private/calls/${friendId}/token`,
  });

  const goPublic = async () => {
    setGoingPublic(true);
    try {
      const { data } = await api.post(`/private/calls/${friendId}/go-public`);
      navigate(`/room/${data.room_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't start a public debate");
    } finally {
      setGoingPublic(false);
    }
  };

  const dismissPublicPrompt = async () => {
    try { await api.post(`/private/calls/${friendId}/clear`); } catch { /* noop */ }
    setPublicRoomId(null);
  };

  if (notFriends) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="eyebrow">Private chat</div>
        <p className="text-[var(--fg-muted)]">This chat is friends-only, and you two aren't friends.</p>
        <Link to="/friends" className="btn-outline text-sm">Back to friends</Link>
      </div>
    );
  }

  const myIdentity = user ? `user-${user.user_id}` : "me";
  const remote = lk.remoteParticipants[0];
  const tiles = [
    { key: "local", identity: myIdentity, label: "You", videoEl: lk.camEnabled ? lk.localVideoEl : null, audioMuted: !lk.micEnabled, placeholderTitle: lk.camEnabled ? "Connecting…" : "Camera off" },
    { key: "remote", identity: remote?.identity || "friend", label: friend?.display_name || "Friend", videoEl: remote?.videoEl, audioEl: remote?.audioEl, audioMuted: remote?.audioMuted, placeholderTitle: friend?.display_name || "Waiting…", placeholderFooter: lk.status === "connected" ? "Waiting for your friend…" : "Connecting…" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <nav className={STICKY_NAV}>
        <div className={`${CONTAINER_COMPACT} mx-auto px-6 h-14 flex items-center justify-between gap-3`}>
          <BackButton to="/friends" label="Friends" data-testid="nav-back-friends" />
          <div className="text-sm font-medium truncate">{friend?.display_name || "…"}</div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
      </nav>

      {publicRoomId && (
        <div className="shrink-0 bg-[var(--accent-soft)] text-[color:var(--accent)] px-4 py-2 text-xs text-center border-b border-[var(--border)] flex items-center justify-center gap-3">
          <span>This call went public — jump into the debate room.</span>
          <button onClick={() => navigate(`/room/${publicRoomId}`)} className="btn-accent !px-2 !py-1 !text-[11px]">Join</button>
          <button onClick={dismissPublicPrompt} className="btn-ghost !px-2 !py-1 !text-[11px]">Dismiss</button>
        </div>
      )}

      <main className={`flex-1 ${CONTAINER_COMPACT} w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4 min-h-0`}>
        <div className="flex flex-wrap items-center gap-2">
          {!inCall ? (
            <button onClick={() => setInCall(true)} className="btn-accent text-sm" data-testid="btn-start-call">Start call</button>
          ) : (
            <button onClick={() => setInCall(false)} className="btn-danger text-sm" data-testid="btn-end-call">End call</button>
          )}
          <button onClick={goPublic} disabled={goingPublic} className="btn-outline text-sm" data-testid="btn-go-public">
            {goingPublic ? "…" : "Make this a public debate"}
          </button>
          <span className="text-[11px] text-[var(--fg-subtle)] ml-auto">Private — never seen by AI features</span>
        </div>

        {inCall && (
          <div className="h-[40vh] shrink-0">
            <VideoStage tiles={tiles} viewMode="normal" spotlightIdentity={myIdentity} mobileSpotlightIdentity={tiles[1].identity} />
          </div>
        )}

        <div className="flex-1 min-h-0 card overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" data-testid="private-messages">
            {messages.length === 0 && <div className="text-sm text-[var(--fg-subtle)] text-center py-6">Say hello.</div>}
            {messages.map((m, i) => {
              const mine = m.sender_id === user?.user_id;
              return (
                <div key={i} className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${mine ? "ml-auto bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bg-muted)] border border-[var(--border)]"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="shrink-0 p-3 border-t border-[var(--border)] flex gap-2">
            <input
              data-testid="private-chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message…"
              className="field"
            />
            <button onClick={send} className="btn-primary px-4 text-sm" data-testid="btn-send-private">Send</button>
          </div>
        </div>
      </main>
    </div>
  );
}
