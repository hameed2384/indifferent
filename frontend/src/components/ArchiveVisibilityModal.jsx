import { useState } from "react";
import { Globe, Link2, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useModalA11y } from "@/hooks/useModalA11y";

export const DEFAULT_VISIBILITY = "private";
export const VISIBILITY_LABEL = { private: "Private", unlisted: "Unlisted", public: "Public" };
// Lock/link/globe — the same metaphor Google Docs/Notion use for the same
// three states, so it's recognizable without reading the label.
export const VISIBILITY_ICON = { private: Lock, unlisted: Link2, public: Globe };

const RANK = { private: 0, unlisted: 1, public: 2 };

const OPTIONS = [
  { value: "private", label: "Private", hint: "Only participants can view it", Icon: Lock },
  { value: "unlisted", label: "Unlisted", hint: "Viewable via direct link only, not listed", Icon: Link2 },
  { value: "public", label: "Public", hint: "Shows in the feed and search", Icon: Globe },
];

/** Moving to MORE privacy applies immediately (either debater can always
 * do that alone). Moving to LESS privacy is a request the OTHER founding
 * debater has to approve — it's never public "even for a second" without
 * that, because nothing else ever sets archive_visibility to a less-
 * private value (see backend/app/routers/rooms.py). */
export default function ArchiveVisibilityModal({ debate, viewerId, onClose, onSaved }) {
  const current = debate.archive_visibility || DEFAULT_VISIBILITY;
  const [visibility, setVisibility] = useState(current);
  const [saving, setSaving] = useState(false);
  const ref = useModalA11y(onClose);

  const pending = debate.pending_visibility_request;
  const iRequested = pending && pending.requested_by === viewerId;
  const theyRequested = pending && !iRequested;

  const save = async () => {
    setSaving(true);
    try {
      if (RANK[visibility] > RANK[current]) {
        await api.post(`/rooms/${debate.room_id}/archive-visibility/request`, { visibility });
        toast.success("Request sent — waiting for the other debater to approve");
        onSaved(current, { pending: true, target: visibility });
      } else {
        const { data } = await api.post(`/rooms/${debate.room_id}/archive-visibility`, { visibility });
        toast.success("Visibility updated");
        onSaved(data.archive_visibility, { pending: false });
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't update visibility");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (approve) => {
    setSaving(true);
    try {
      const { data } = await api.post(`/rooms/${debate.room_id}/archive-visibility/decide`, { approve });
      toast.success(approve ? "Approved" : "Declined");
      onSaved(data.archive_visibility, { pending: false });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't record your decision");
    } finally {
      setSaving(false);
    }
  };

  if (theyRequested) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Visibility request" className="card w-full max-w-md p-6 sm:p-8">
          <div className="eyebrow">Debate archive</div>
          <h2 className="font-heading text-2xl font-semibold mt-2">
            Make this {VISIBILITY_LABEL[pending.target_visibility]?.toLowerCase()}?
          </h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">The other debater wants to change this debate's visibility. It stays exactly as private as it is now unless you approve.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button className="btn-outline" onClick={() => decide(false)} disabled={saving} data-testid="btn-deny-visibility">Decline</button>
            <button className="btn-accent" onClick={() => decide(true)} disabled={saving} data-testid="btn-approve-visibility">Approve</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Debate archive" className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Debate archive</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Who can see this?</h2>
        {iRequested && (
          <p className="mt-2 text-sm text-[var(--accent)]">
            Waiting for the other debater to approve making this {VISIBILITY_LABEL[pending.target_visibility]?.toLowerCase()}. You can still make it more private any time below.
          </p>
        )}
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
          <button className="btn-accent" onClick={save} disabled={saving || visibility === current} data-testid="btn-save-visibility">
            {saving ? "Saving…" : RANK[visibility] > RANK[current] ? "Request" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
