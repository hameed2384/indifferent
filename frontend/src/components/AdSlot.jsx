import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MEMBERSHIP_PRICE } from "@/lib/pricing";

// Matches the publisher ID already loaded site-wide in public/index.html
// (that script alone only proved site ownership to Google; it doesn't
// render anything by itself).
const ADSENSE_CLIENT = "ca-pub-4056972798544833";
const SLOT_BY_VARIANT = {
  card: process.env.REACT_APP_ADSENSE_SLOT_CARD,
  banner: process.env.REACT_APP_ADSENSE_SLOT_BANNER,
};

/** One real AdSense unit. adsbygoogle.push() may only run once per <ins>
 * node or Google throws — a plain ref-guard (not a module-level one) is
 * enough since React hands this a fresh DOM node on every mount.
 *
 * `tall` (the "card" variant, dropped into Watch's DebateCard grid): height
 * is deliberately NOT aspect-video — DebateCard is a plain text card with no
 * fixed ratio, so pinning the ad to 16:9 let it render taller than its
 * siblings, and since the grid has no explicit row height, CSS Grid's
 * default row-sizing stretched the *entire row* to match the tallest cell
 * (the ad), leaving visible dead space under every other card in that row.
 *
 * Confirmed live (via computed styles, not just theory): Google's push()
 * sets an explicit inline height on the <ins> itself (e.g. height: 280px).
 * A *percentage* wrapper height doesn't reliably escape that — the wrapper
 * and the row it's in resolve circularly (row height depends on the
 * wrapper's contribution, the wrapper's h-full depends on the row), so the
 * browser falls back to the wrapper's uncapped natural size — Google's
 * 280px included — to seed the auto-row-sizing pass in the first place.
 * overflow-hidden doesn't help there either: it only clips *after* a size
 * is resolved, not during that first contribution pass.
 * max-height in a fixed px unit isn't circular the same way, so it reliably
 * caps what the wrapper can contribute — set close to DebateCard's own
 * typical height. The <ins> then needs an !important height to actually
 * fill that capped wrapper instead of Google's inline px value winning on
 * specificity (inline beats a plain class; !important beats inline). */
function RealAd({ slot, tall }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* adsbygoogle.js hasn't finished loading (slow network, blocked) —
         nothing useful to do here; Google's own script doesn't retry into
         a failed push, but a future navigation mounts a fresh <ins>. */
    }
  }, []);
  return (
    <div className={`card w-full p-3 overflow-hidden flex flex-col ${tall ? "h-full max-h-[240px]" : ""}`} data-testid="adsense-unit">
      <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)] mb-1 shrink-0">Sponsored</div>
      <ins
        className="adsbygoogle block w-full flex-1 min-h-0 !h-full"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

/** Client brief #3/#29 — ad slots that disappear for £9/mo members
 * (routers/payments.py: "membership," not "subscription" — that word is
 * reserved for the separate £2/mo per-debater relationship). Renders a real
 * AdSense unit once REACT_APP_ADSENSE_SLOT_CARD/_BANNER is set (create the
 * matching ad unit in the AdSense dashboard, copy its data-ad-slot digits
 * in as that env var) — until then, falls back to an honest house
 * placement that pitches membership instead of rendering nothing. */
export default function AdSlot({ variant = "card" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.ad_free) return null;

  const slot = SLOT_BY_VARIANT[variant];
  if (slot) return <RealAd slot={slot} tall={variant === "card"} />;

  const goUpgrade = () => navigate(user ? "/settings" : "/");

  if (variant === "banner") {
    return (
      <button
        type="button"
        onClick={goUpgrade}
        className="card w-full p-3 flex items-center justify-between gap-3 text-left cursor-pointer hover:border-[var(--fg)] transition-colors"
        data-testid="ad-slot-banner"
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">Sponsored</div>
          <div className="text-sm truncate">Debates load faster, and look better, without ads in the way.</div>
        </div>
        <span className="btn-outline !py-1 !px-2 !text-xs shrink-0">Remove ads — {MEMBERSHIP_PRICE}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={goUpgrade}
      className="card w-full p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[var(--fg)] transition-colors aspect-video"
      data-testid="ad-slot-card"
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)] mb-2">Sponsored</div>
      <div className="text-sm text-[var(--fg-muted)] max-w-[220px]">This spot is a placeholder — a real ad network can drop in here later.</div>
      <span className="btn-outline !py-1 !px-2 !text-xs mt-3">Remove ads — {MEMBERSHIP_PRICE}</span>
    </button>
  );
}
