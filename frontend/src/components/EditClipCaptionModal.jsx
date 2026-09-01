import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useModalA11y } from "@/hooks/useModalA11y";

const MAX_CAPTION = 200;

export default function EditClipCaptionModal({ clip, onClose, onSaved }) {
  const [caption, setCaption] = useState(clip.caption);
  const [saving, setSaving] = useState(false);
  const ref = useModalA11y(onClose);

  const save = async () => {
    const trimmed = caption.trim();
    if (!trimmed) { toast.error("Say what your claim or rebuttal is"); return; }
    setSaving(true);
    try {
      const { data } = await api.patch(`/clips/${clip.clip_id}`, { caption: trimmed });
      toast.success("Caption updated");
      onSaved(data.caption);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't update caption");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Edit claim" className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Edit claim</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Update your caption</h2>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={MAX_CAPTION}
          rows={3}
          className="textarea mt-6"
          data-testid="edit-caption-input"
        />
        <div className="mt-1 text-xs text-[var(--fg-subtle)] text-right">{caption.length}/{MAX_CAPTION}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="edit-caption-cancel">Cancel</button>
          <button className="btn-accent" onClick={save} disabled={saving} data-testid="btn-save-caption">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
