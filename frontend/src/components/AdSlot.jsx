import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Client brief #3/#29 — ad slots that disappear for £9/mo ad-free
 * subscribers. No third-party ad network is wired up yet (that needs the
 * client's own AdSense/network account, a business decision, not something
 * to sign up for on their behalf) — this renders an honest house placement
 * that also pitches the upgrade, and is the single place a real network's
 * tag would get dropped in later without touching any page that uses it. */
export default function AdSlot({ variant = "card" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.ad_free) return null;

  const goUpgrade = () => navigate(user ? "/dashboard" : "/");

  if (variant === "banner") {
    return (
      <div
        onClick={goUpgrade}
        className="card p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--fg)] transition-colors"
        data-testid="ad-slot-banner"
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">Sponsored</div>
          <div className="text-sm truncate">Debates load faster, and look better, without ads in the way.</div>
        </div>
        <span className="btn-outline !py-1 !px-2 !text-xs shrink-0">Remove ads — £9/mo</span>
      </div>
    );
  }

  return (
    <div
      onClick={goUpgrade}
      className="card p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[var(--fg)] transition-colors aspect-video"
      data-testid="ad-slot-card"
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)] mb-2">Sponsored</div>
      <div className="text-sm text-[var(--fg-muted)] max-w-[220px]">This spot is a placeholder — a real ad network can drop in here later.</div>
      <span className="btn-outline !py-1 !px-2 !text-xs mt-3">Remove ads — £9/mo</span>
    </div>
  );
}
