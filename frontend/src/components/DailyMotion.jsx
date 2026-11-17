import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getSource } from "@/lib/referral";
import { saveGuestToken } from "@/lib/guest";
import { dailyIndex } from "@/lib/daily";

/** "Today's motion" — one curated motion a day, two buttons straight into a
 * sparring round. Works signed in or not (a signed-in user's round is
 * claimed into their account when the Spar page opens). */
export default function DailyMotion() {
  const navigate = useNavigate();
  const [motion, setMotion] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/spar/guest/motions")
      .then(({ data }) => { const m = data.motions || []; if (m.length) setMotion(m[dailyIndex(m.length)]); })
      .catch(() => {});
  }, []);

  if (!motion) return null;

  const go = async (side) => {
    setBusy(true);
    try {
      const { data } = await api.post("/spar/guest/start", { motion_id: motion.id, side, source: getSource() });
      saveGuestToken(data.debate_id, data.guest_token);
      navigate(`/try/${data.debate_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't start. Try again in a bit.");
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-testid="daily-motion">
      <div>
        <div className="eyebrow mb-1">Today's motion · {motion.tag}</div>
        <div className="font-heading text-lg sm:text-xl font-semibold">{motion.motion}</div>
        <p className="text-xs text-[var(--fg-subtle)] mt-1">Pick a side. An AI argues the other, then scores you.</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => go("for")} disabled={busy} className="btn-accent text-sm" data-testid="daily-agree">I agree</button>
        <button onClick={() => go("against")} disabled={busy} className="btn-outline text-sm" data-testid="daily-disagree">I disagree</button>
      </div>
    </div>
  );
}
