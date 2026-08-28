import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLiveKit } from "@/lib/livekit";
import { VideoControls, VideoStage } from "@/components/VideoStage";
import ThemeToggle from "@/components/ThemeToggle";

export default function WatchRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [debate, setDebate] = useState(null);
  const [chat, setChat] = useState([]);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [likeBurst, setLikeBurst] = useState(0);

  const sinceRef = useRef(null);
  const likesRef = useRef(0);
  const clientIdRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `spectator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const chatEndRef = useRef(null);
  const commentEndRef = useRef(null);

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
    if (!debate) return;
    pollOnce();
    const iv = setInterval(pollOnce, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debate, roomId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);
  useEffect(() => { commentEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments.length]);

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

  const lk = useLiveKit({ roomId, mode: "spectator", enabled: !!debate && debate.status === "active" });
  const sideA_lk = debate ? lk.remoteParticipants.find((p) => p.identity === debate.side_a.identity) : null;
  const sideB_lk = debate ? lk.remoteParticipants.find((p) => p.identity === debate.side_b.identity) : null;

  const [viewMode, setViewMode] = useState("normal");
  const [spotlightIdentity, setSpotlightIdentity] = useState(null);
  useEffect(() => {
    if (debate && !spotlightIdentity) setSpotlightIdentity(debate.side_a.identity);
  }, [debate, spotlightIdentity]);

  if (!debate) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;
  const isLive = debate.status === "active";

  const tiles = [
    {
      key: "a",
      identity: debate.side_a.identity,
      label: `Side A · ${debate.side_a.display_name}`,
      videoEl: sideA_lk?.videoEl,
      audioEl: sideA_lk?.audioEl,
      audioMuted: sideA_lk?.audioMuted,
      placeholderTitle: debate.side_a.display_name,
      placeholderSubtitle: debate.side_a.stance ? `e ${debate.side_a.stance.economic?.toFixed?.(1)} · s ${debate.side_a.stance.social?.toFixed?.(1)}` : null,
      placeholderFooter: isLive ? (lk.status === "connected" ? "Waiting for camera…" : "Connecting…") : "Debate ended",
    },
    {
      key: "b",
      identity: debate.side_b.identity,
      label: `Side B · ${debate.side_b.display_name}`,
      videoEl: sideB_lk?.videoEl,
      audioEl: sideB_lk?.audioEl,
      audioMuted: sideB_lk?.audioMuted,
      placeholderTitle: debate.side_b.display_name,
      placeholderSubtitle: debate.side_b.stance ? `e ${debate.side_b.stance.economic?.toFixed?.(1)} · s ${debate.side_b.stance.social?.toFixed?.(1)}` : null,
      placeholderFooter: isLive ? (lk.status === "connected" ? "Waiting for camera…" : "Connecting…") : "Debate ended",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-muted)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
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
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 flex flex-col">
          <div className="flex flex-col min-h-[45vh] md:min-h-[55vh]">
            <VideoStage
              tiles={tiles}
              viewMode={viewMode}
              spotlightIdentity={spotlightIdentity}
              onSpotlightChange={setSpotlightIdentity}
              mobileSpotlightIdentity={debate.side_a.identity}
            />
          </div>

          <div className="mt-4">
            <VideoControls
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              spotlightIdentity={spotlightIdentity}
              sides={[
                { identity: debate.side_a.identity, label: "Side A" },
                { identity: debate.side_b.identity, label: "Side B" },
              ]}
              onSpotlightChange={setSpotlightIdentity}
            />
          </div>

          <div className="mt-6 card p-5">
            <div className="eyebrow mb-2">Debate prompts</div>
            <ol className="space-y-2">
              {(debate.topics || []).map((t, i) => (
                <li key={i} className="text-sm leading-snug border-l-2 border-[var(--accent)] pl-3" data-testid={`watch-topic-${i}`}>{t}</li>
              ))}
            </ol>
          </div>

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
            <div className="text-xs text-[var(--fg-subtle)]">
              Opposition score {debate.opposition_score?.toFixed?.(1) ?? debate.opposition_score}
            </div>
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
  );
}
