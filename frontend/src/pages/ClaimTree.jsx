import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Flag, GitBranch, Heart, Pencil, ThumbsDown, Trash2 } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import BackButton from "@/components/BackButton";
import RecordClipModal from "@/components/RecordClipModal";
import EditClipCaptionModal from "@/components/EditClipCaptionModal";
import DeleteClipModal from "@/components/DeleteClipModal";
import ReportModal from "@/components/ReportModal";
import ClaimTreeView from "@/components/ClaimTreeView";
import { VISIBILITY_ICON } from "@/components/ArchiveVisibilityModal";
import { startGoogleLogin } from "@/lib/auth";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_MEDIUM } from "@/lib/layout";

export default function ClaimTree() {
  const { clipId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [clip, setClip] = useState(null);
  const [replies, setReplies] = useState([]);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [treeNodes, setTreeNodes] = useState([]);
  const [treeRootId, setTreeRootId] = useState(null);
  const [showTree, setShowTree] = useState(false);

  const load = () => {
    api.get(`/clips/${clipId}`).then(({ data }) => setClip(data)).catch(() => {
      toast.error("Clip not found"); navigate("/claims");
    });
    api.get(`/clips/${clipId}/replies`).then(({ data }) => setReplies(data.replies || [])).catch(() => {});
    api.get(`/clips/${clipId}/tree`).then(({ data }) => { setTreeNodes(data.nodes || []); setTreeRootId(data.root_clip_id); }).catch(() => {});
  };
  useEffect(load, [clipId]); // eslint-disable-line react-hooks/exhaustive-deps

  const like = () => {
    if (!user) { toast.info("Sign in to like"); return; }
    api.post(`/clips/${clipId}/like`).then(({ data }) => setClip((c) => ({ ...c, likes: data.likes }))).catch(() => {});
  };
  const dislike = () => {
    if (!user) { toast.info("Sign in to react"); return; }
    api.post(`/clips/${clipId}/dislike`).then(({ data }) => setClip((c) => ({ ...c, dislikes: data.dislikes }))).catch(() => {});
  };

  const openReply = () => {
    if (!user) { toast.info("Sign in to reply"); return; }
    setShowReplyModal(true);
  };

  if (!clip) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;
  }

  const isOwner = !!user && clip.uploader_id === user.user_id;
  // The chip shows the clip's CURRENT state; the toggle button is an action
  // verb ("Make public"/"Make unlisted"), so its icon previews the TARGET
  // state instead — the two are deliberately not the same lookup.
  const CurrentVisibilityIcon = VISIBILITY_ICON.unlisted;
  const TargetVisibilityIcon = VISIBILITY_ICON[clip.unlisted ? "public" : "unlisted"];

  const onCaptionSaved = (newCaption) => { setClip((c) => ({ ...c, caption: newCaption })); setShowEditModal(false); };
  const onClipDeleted = (hardDeleted) => {
    if (hardDeleted) { navigate("/claims"); return; }
    setClip((c) => ({ ...c, deleted: true, caption: "[deleted]" }));
    setShowDeleteModal(false);
  };
  const toggleVisibility = async () => {
    const next = !clip.unlisted;
    setClip((c) => ({ ...c, unlisted: next }));
    try {
      await api.patch(`/clips/${clipId}`, { unlisted: next });
      toast.success(next ? "Now unlisted" : "Now public");
    } catch (e) {
      setClip((c) => ({ ...c, unlisted: !next }));
      toast.error(e.response?.data?.detail || "Couldn't update visibility");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className={STICKY_NAV}>
        <div className={`${CONTAINER_MEDIUM} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3`}>
          <BackButton to="/claims" label="Claims" data-testid="nav-back-claims" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && <NotificationBell />}
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm" data-testid="nav-enter">Sign in</button>}
          </div>
        </div>
      </nav>

      <main className={`${CONTAINER_MEDIUM} mx-auto px-4 sm:px-6 py-8`}>
        {clip.parent && (
          <button onClick={() => navigate(`/claims/${clip.parent.clip_id}`)} className="text-xs text-[var(--fg-subtle)] hover:underline mb-3 block text-left" data-testid="link-parent-claim">
            ↑ Replying to {clip.parent.uploader_name}: "{clip.parent.caption}"
          </button>
        )}

        <div className="card overflow-hidden">
          {clip.deleted ? (
            <div className="p-10 text-center text-sm text-[var(--fg-subtle)]">This clip was deleted by its creator.</div>
          ) : (
            <video key={clip.clip_id} src={`${API}/clips/${clip.clip_id}/video`} controls className="w-full aspect-video bg-black" data-testid="claim-video" />
          )}
          <div className="p-5">
            {!clip.deleted && (
              <div className="flex items-center gap-1.5">
                <span className="chip !py-0 !px-1.5 text-[10px]">{clip.category}</span>
                {clip.unlisted && (
                  <span className="chip !py-0 !px-1.5 text-[10px]"><CurrentVisibilityIcon className="w-3 h-3" /> Unlisted</span>
                )}
              </div>
            )}
            <h1 className="font-heading text-xl font-semibold mt-2">"{clip.caption}"</h1>
            <button onClick={() => navigate(`/u/${clip.uploader_id}`)} className="text-sm text-[var(--fg-subtle)] hover:underline mt-1">{clip.uploader_name}</button>
            {!clip.deleted && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={like} className="btn-accent inline-flex items-center gap-1.5" data-testid="btn-like-clip"><Heart className="w-4 h-4" /> {clip.likes}</button>
                <button onClick={dislike} className="btn-outline inline-flex items-center gap-1.5" data-testid="btn-dislike-clip"><ThumbsDown className="w-4 h-4" /> {clip.dislikes}</button>
                <button onClick={openReply} className="btn-primary" data-testid="btn-reply-clip">Reply with video</button>
                {isOwner && (
                  <>
                    <button onClick={toggleVisibility} className="btn-outline inline-flex items-center gap-1.5" data-testid="btn-toggle-clip-visibility">
                      <TargetVisibilityIcon className="w-4 h-4" /> {clip.unlisted ? "Make public" : "Make unlisted"}
                    </button>
                    <button onClick={() => setShowEditModal(true)} className="btn-outline inline-flex items-center gap-1.5" data-testid="btn-edit-clip"><Pencil className="w-4 h-4" /> Edit caption</button>
                    <button onClick={() => setShowDeleteModal(true)} className="btn-danger inline-flex items-center gap-1.5" data-testid="btn-delete-clip"><Trash2 className="w-4 h-4" /> Delete</button>
                  </>
                )}
                {!isOwner && (
                  <button
                    onClick={() => { if (!user) { toast.info("Sign in to report"); return; } setShowReportModal(true); }}
                    className="btn-ghost !px-2.5"
                    title="Report this claim"
                    aria-label="Report this claim"
                    data-testid="btn-report-clip"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {treeNodes.length > 1 && (
          <div className="mt-6 card p-4">
            <button
              onClick={() => setShowTree((v) => !v)}
              className="w-full flex items-center justify-between text-left"
              data-testid="btn-toggle-tree"
            >
              <span className="text-sm font-medium inline-flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-[var(--fg-subtle)]" /> Full tree ({treeNodes.length} clips)
              </span>
              <span className="text-xs text-[var(--fg-subtle)]">{showTree ? "Hide" : "Show"}</span>
            </button>
            {showTree && (
              <div className="mt-3 max-h-80 overflow-y-auto">
                <ClaimTreeView nodes={treeNodes} rootClipId={treeRootId} currentClipId={clipId} onNavigate={(id) => navigate(`/claims/${id}`)} />
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <div className="eyebrow mb-3">{replies.length} {replies.length === 1 ? "rebuttal" : "rebuttals"}</div>
          {replies.length === 0 && <p className="text-sm text-[var(--fg-subtle)]">No rebuttals yet — be the first to push back.</p>}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {replies.map((r) => (
              <button key={r.clip_id} onClick={() => navigate(`/claims/${r.clip_id}`)} className="card overflow-hidden text-left hover:border-[var(--fg)] transition-colors" data-testid={`reply-card-${r.clip_id}`}>
                {r.deleted ? (
                  <div className="w-full aspect-video bg-[var(--bg-muted)] flex items-center justify-center text-xs text-[var(--fg-subtle)]">Deleted</div>
                ) : (
                  <video src={`${API}/clips/${r.clip_id}/video`} muted preload="metadata" className="w-full aspect-video object-cover bg-black" />
                )}
                <div className="p-3">
                  <div className="text-sm font-medium line-clamp-2">{r.deleted ? "Deleted" : `"${r.caption}"`}</div>
                  <div className="text-[11px] text-[var(--fg-subtle)] mt-1 inline-flex items-center gap-1 flex-wrap">
                    <span>{r.uploader_name} ·</span>
                    <Heart className="w-3 h-3" /> <span>{r.likes} · {r.reply_count} {r.reply_count === 1 ? "reply" : "replies"}</span>
                    {r.unlisted && !r.deleted && (
                      <span className="inline-flex items-center gap-0.5">· <CurrentVisibilityIcon className="w-3 h-3" /> Unlisted</span>
                    )}
                  </div>
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
      {showEditModal && <EditClipCaptionModal clip={clip} onClose={() => setShowEditModal(false)} onSaved={onCaptionSaved} />}
      {showDeleteModal && <DeleteClipModal clip={clip} onClose={() => setShowDeleteModal(false)} onDeleted={onClipDeleted} />}
      {showReportModal && <ReportModal targetType="clip" targetId={clip.clip_id} onClose={() => setShowReportModal(false)} />}
    </div>
  );
}
