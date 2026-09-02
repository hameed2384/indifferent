// Single source of truth for "what do we call this debate" — used to be
// duplicated as `d.topics?.[0] || "An unrecorded disagreement"` across
// DebateCard, Profile, and WatchRoom, all showing a pre-match AI guess as
// if it were a confirmed record. Preference order: a human actually set
// one (custom_title — either a Go-Live broadcaster's own words, or both
// matched debaters agreeing on one of the pre-generated candidates), then
// the pre-generated guess, then an honest fallback that doesn't pretend
// there's a topic when there genuinely isn't one yet.
export function titleFor(d) {
  if (d.custom_title) return d.custom_title;
  if (d.topics?.[0]) return d.topics[0];
  if (d.categories?.[0]) return `${d.categories[0]} debate`;
  return "Untitled debate";
}

// True once the title is either human-confirmed or the debate is over (no
// more live conversation left to drift away from a pre-match guess).
// False = still just a pre-generated candidate while the debate is live —
// the UI should visibly hedge ("Suggested topic"), not present it with the
// same confidence as a settled one.
export function isTitleConfirmed(d) {
  return !!d.custom_title || d.status !== "active";
}
