import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ThumbsDown } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import RecordClipModal from "@/components/RecordClipModal";
import { startGoogleLogin } from "@/lib/auth";

export default function ClaimTree() {
  const { clipId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [clip, setClip] = useState(null);
  const [replies, setReplies] = useState([]);
  const [showReplyModal, setShowReplyModal] = useState(false);

  const load = () => {
    api.get(`/clips/${clipId}`).then(({ data }) => setClip(data)).catch(() => {
      toast.error("Clip not found"); navigate("/claims");
    });
    api.get(`/clips/${clipId}/replies`).then(({ data }) => setReplies(data.replies || [])).catch(() => {});
  };
  useEffect(load, [clipId]); // eslint-disable-line react-hooks/exhaustive-deps

  const like = () => api.post(`/clips/${clipId}/like`).then(({ data }) => setClip((c) => ({ ...c, likes: data.likes }))).catch(() => {});
  const dislike = () => api.post(`/clips/${clipId}/dislike`).then(({ data }) => setClip((c) => ({ ...c, dislikes: data.dislikes }))).catch(() => {});

  const openReply = () => {
    if (!user) { toast.info("Sign in to reply"); return; }
    setShowReplyModal(true);
  };

  if (!clip) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/claims")} className="btn-ghost text-sm" data-testid="nav-back-claims">← Claims</button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {clip.parent && (
          <button onClick={() => navigate(`/claims/${clip.parent.clip_id}`)} className="text-xs text-[var(--fg-subtle)] hover:underline mb-3 block text-left" data-testid="link-parent-claim">
            ↑ Replying to {clip.parent.uploader_name}: "{clip.parent.caption}"
          </button>
        )}

        <div className="card overflow-hidden">
          <video key={clip.clip_id} src={`${API}/clips/${clip.clip_id}/video`} controls className="w-full aspect-video bg-black" data-testid="claim-video" />
          <div className="p-5">
            <span className="chip !py-0 !px-1.5 text-[10px]">{clip.category}</span>
            <h1 className="font-heading text-xl font-semibold mt-2">"{clip.caption}"</h1>
            <button onClick={() => navigate(`/u/${clip.uploader_id}`)} className="text-sm text-[var(--fg-subtle)] hover:underline mt-1">{clip.uploader_name}</button>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={like} className="btn-accent" data-testid="btn-like-clip">♥ {clip.likes}</button>
              <button onClick={dislike} className="btn-outline inline-flex items-center gap-1.5" data-testid="btn-dislike-clip"><ThumbsDown className="w-4 h-4" /> {clip.dislikes}</button>
              <button onClick={openReply} className="btn-primary" data-testid="btn-reply-clip">Reply with video</button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="eyebrow mb-3">{replies.length} {replies.length === 1 ? "rebuttal" : "rebuttals"}</div>
          {replies.length === 0 && <p className="text-sm text-[var(--fg-subtle)]">No rebuttals yet — be the first to push back.</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            {replies.map((r) => (
              <button key={r.clip_id} onClick={() => navigate(`/claims/${r.clip_id}`)} className="card overflow-hidden text-left hover:border-[var(--fg)] transition-colors" data-testid={`reply-card-${r.clip_id}`}>
                <video src={`${API}/clips/${r.clip_id}/video`} muted preload="metadata" className="w-full aspect-video object-cover bg-black" />
                <div className="p-3">
                  <div className="text-sm font-medium line-clamp-2">"{r.caption}"</div>
                  <div className="text-[11px] text-[var(--fg-subtle)] mt-1">{r.uploader_name} · ♥ {r.likes} · {r.reply_count} {r.reply_count === 1 ? "reply" : "replies"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {showReplyModal && (
        <RecordClipModal
          lockCategory
          parentClipId={clip.clip_id}
          onClose={() => setShowReplyModal(false)}
          onPosted={(id) => { setShowReplyModal(false); navigate(`/claims/${id}`); }}
        />
      )}
    </div>
  );
}
