// Shared between App.js (captures ?ref= on landing) and AuthCallback.jsx
// (reads it back once sign-in actually completes) and Settings.jsx (builds
// the invite link). A plain module constant, not exported from a page
// component, so neither side has to import the other.
export const REFERRAL_KEY = "indifferent-referral-code";

// Landing channel (instagram, youtube, google, direct...) for the admin Growth
// tab. Worked out once per visit from ?utm_source= (our own links: Instagram
// bio, YouTube descriptions) or else the referrer, kept for 30 days, and sent
// with guest round starts and sign-ups. Only a short slug, never a full URL.
export const SOURCE_KEY = "indifferent-source";
const VISIT_PINGED_KEY = "indifferent-visit-pinged";
const SOURCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFERRER_SOURCES = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "twitter"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
];

function slug(v) {
  const s = String(v || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 32);
  return s || null;
}

export function detectSource(search = window.location.search, referrer = document.referrer, host = window.location.hostname) {
  const params = new URLSearchParams(search);
  const utm = slug(params.get("utm_source") || params.get("src"));
  if (utm) return utm;
  if (!referrer) return "direct";
  let refHost = "";
  try { refHost = new URL(referrer).hostname.toLowerCase(); } catch { return "direct"; }
  if (!refHost || refHost === host.toLowerCase()) return "direct";
  for (const [re, name] of REFERRER_SOURCES) if (re.test(refHost)) return name;
  return slug(refHost.replace(/^www\./, "")) || "other";
}

export function getSource() {
  try {
    const saved = JSON.parse(localStorage.getItem(SOURCE_KEY) || "null");
    if (saved && Date.now() - saved.at < SOURCE_TTL_MS) return saved.source;
  } catch { /* noop */ }
  return null;
}

// Called once on app load. Returns the source to ping for this session, or
// null when this tab already pinged (or it's the OAuth return trip).
export function captureSource() {
  if (window.location.pathname.startsWith("/auth/")) return null; // Google's redirect back, not a real landing
  const source = detectSource();
  try {
    // a real channel replaces the stored one; a plain direct visit keeps it
    if (source !== "direct" || !getSource()) localStorage.setItem(SOURCE_KEY, JSON.stringify({ source, at: Date.now() }));
  } catch { /* noop */ }
  try {
    if (sessionStorage.getItem(VISIT_PINGED_KEY)) return null;
    sessionStorage.setItem(VISIT_PINGED_KEY, "1");
  } catch { /* noop */ }
  return source;
}
