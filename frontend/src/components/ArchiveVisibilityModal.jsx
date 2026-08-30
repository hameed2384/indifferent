import { useState } from "react";
import { Globe, Link2, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const DEFAULT_VISIBILITY = "private";
export const VISIBILITY_LABEL = { private: "Private", unlisted: "Unlisted", public: "Public" };
// Lock/link/globe — the same metaphor Google Docs/Notion use for the same
// three states, so it's recognizable without reading the label.
export const VISIBILITY_ICON = { private: Lock, unlisted: Link2, public: Globe };

const OPTIONS = [
  { value: "private", label: "Private", hint: "Only participants can view it", Icon: Lock },
  { value: "unlisted", label: "Unlisted", hint: "Viewable via direct link only, not listed", Icon: Link2 },
  { value: "public", label: "Public", hint: "Shows in the feed and search", Icon: Globe },
];

export default function ArchiveVisibilityModal({ debate, onClose, onSaved }) {
  const [visibility, setVisibility] = useState(debate.archive_visibility || DEFAULT_VISIBILITY);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/rooms/${debate.room_id}/archive-visibility`, { visibility });
      toast.success("Visibility updated");
      onSaved(data.archive_visibility);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't update visibility");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Debate archive</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Who can see this?</h2>
        <div className="mt-6 space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setVisibility(o.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition ${visibility === o.value ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]" : "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"}`}
              data-testid={`visibility-option-${o.value}`}
            >
              <div className="text-sm font-medium flex items-center gap-1.5"><o.Icon className="w-3.5 h-3.5" /> {o.label}</div>
              <div className={`text-xs mt-0.5 ${visibility === o.value ? "text-[var(--bg)]/70" : "text-[var(--fg-subtle)]"}`}>{o.hint}</div>
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="visibility-cancel">Cancel</button>
          <button className="btn-accent" onClick={save} disabled={saving} data-testid="btn-save-visibility">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
