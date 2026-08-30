import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function DeleteClipModal({ clip, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const hasReplies = (clip.reply_count || 0) > 0;

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { data } = await api.delete(`/clips/${clip.clip_id}`);
      toast.success("Clip deleted");
      onDeleted(data.hard_deleted);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't delete that clip");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Delete claim</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Are you sure?</h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          {hasReplies
            ? "This clip has replies, so its place in the tree stays — but the video and caption are permanently removed and can't be undone."
            : "This permanently removes the video and caption. This can't be undone."}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="delete-clip-cancel">Cancel</button>
          <button className="btn-danger" onClick={confirmDelete} disabled={deleting} data-testid="btn-confirm-delete-clip">
            <Trash2 className="w-4 h-4" /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
