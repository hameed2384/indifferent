import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Ping specific friends that this room is live, rather than only relying
 * on them stumbling onto it in the feed or the passive "debater_live"
 * subscriber notification (which only fires for people already
 * subscribed to this debater, not friends generally). */
export default function InviteFriendsModal({ roomId, onClose }) {
  const ref = useModalA11y(onClose);
  const [friends, setFriends] = useState(null); // null = loading
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get("/friends").then(({ data }) => setFriends(data.friends || [])).catch(() => setFriends([]));
  }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const { data } = await api.post(`/rooms/${roomId}/invite`, { friend_ids: Array.from(selected) });
      toast.success(`Invited ${data.invited.length} friend${data.invited.length === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't send invites");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Invite friends" className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Invite</div>
        <h2 className="font-heading text-2xl font-semibold mt-2">Bring your friends in</h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">They'll get a notification linking straight to this stream.</p>

        <div className="mt-6 max-h-72 overflow-y-auto space-y-1.5">
          {friends === null && <div className="text-sm text-[var(--fg-subtle)]">Loading friends…</div>}
          {friends?.length === 0 && <div className="text-sm text-[var(--fg-subtle)]">No friends yet — add some from a profile page first.</div>}
          {friends?.map((f) => (
            <label
              key={f.user_id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--bg-muted)] cursor-pointer"
              data-testid={`invite-friend-${f.user_id}`}
            >
              <input
                type="checkbox"
                checked={selected.has(f.user_id)}
                onChange={() => toggle(f.user_id)}
                className="checkbox"
              />
              {f.picture
                ? <img src={f.picture} alt="" className="w-7 h-7 rounded-full object-cover" />
                : <div className="w-7 h-7 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-xs font-medium">{(f.display_name || "?")[0]}</div>}
              <span className="text-sm font-medium">{f.display_name}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} data-testid="invite-cancel">Cancel</button>
          <button className="btn-accent" onClick={send} disabled={sending || selected.size === 0} data-testid="btn-send-invites">
            {sending ? "Sending…" : `Invite${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
