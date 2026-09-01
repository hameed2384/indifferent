import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useModalA11y } from "@/hooks/useModalA11y";

const REASONS = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "unsafe_content", label: "Unsafe or graphic content" },
  { value: "other", label: "Something else" },
];

/** Minimum-viable report capture — writes to the backend's `reports`
 * collection (see backend/app/routers/reports.py). No moderation UI reads
 * this back yet; it exists so reporting is possible at all before
 * moderation tooling gets built. */
export default function ReportModal({ targetType, targetId, onClose }) {
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useModalA11y(onClose);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/reports", { target_type: targetType, target_id: targetId, reason, details });
      toast.success("Report submitted. Thanks for flagging this.");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't submit report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Report" className="card w-full max-w-md p-6 sm:p-8">
        <div className="eyebrow">Report</div>
        <h2 className="font-heading text-xl font-semibold mt-2">What's wrong?</h2>
        <div className="mt-4 space-y-1">
          {REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <input
                type="radio"
                name="report-reason"
                className="accent-[var(--accent)]"
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                data-testid={`report-reason-${r.value}`}
              />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          className="field mt-3 w-full text-sm"
          rows={3}
          placeholder="Anything else we should know? (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          data-testid="report-details"
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={onClose} disabled={busy} data-testid="report-cancel">Cancel</button>
          <button className="btn-danger" onClick={submit} disabled={busy} data-testid="btn-submit-report">
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
