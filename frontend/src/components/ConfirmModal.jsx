import { useModalA11y } from "@/hooks/useModalA11y";

/** Generic "are you sure?" dialog — the same fixed-inset `card` pattern
 * DeleteClipModal already established, extracted so every irreversible-
 * feeling action (unfriend, kick-vote, ...) gets one instead of firing on
 * a single click. */
export default function ConfirmModal({ title, body, confirmLabel = "Confirm", danger = true, busy, onConfirm, onClose, testIdPrefix = "confirm" }) {
  const ref = useModalA11y(onClose);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="card w-full max-w-md p-6 sm:p-8">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        {body && <p className="mt-2 text-sm text-[var(--fg-muted)]">{body}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} disabled={busy} data-testid={`${testIdPrefix}-cancel`}>Cancel</button>
          <button className={danger ? "btn-danger" : "btn-accent"} onClick={onConfirm} disabled={busy} data-testid={`${testIdPrefix}-confirm`}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
