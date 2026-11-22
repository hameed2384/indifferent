/** Swipe: a never-ending stack of takes (right = agree, left = disagree).
 * Pure functions, tested without a browser.
 *
 * Your position is built only from your own swipes (kept in this browser) and
 * the crowd's counts for each take, which come back from the server after each
 * swipe. It unlocks at 30 swipes and keeps sharpening: every level adds more of
 * the picture, but there's no end: you can swipe as long as you like. */

export const UNLOCK = 30;
const STORE_KEY = "indifferent-swipes";
const MAX_STORED = 5000;
const MIN_CROWD = 3; // other people needed on a take before "with / against the crowd" counts

export const LEVELS = [
  { at: 30, name: "First read", adds: "your type, yes-rate and crowd score, top topics" },
  { at: 75, name: "Taking shape", adds: "your rarest opinion and more topics" },
  { at: 150, name: "Sharp", adds: "every topic, your rebel zone and comfort zone" },
  { at: 300, name: "Deep cut", adds: "the takes you'd die on, topic by topic" },
  { at: 600, name: "Fully mapped", adds: "the sharpest possible picture" },
];

/** Where n swipes put you: the level reached (or null before 30), the next one and how far it is. */
export function level(n) {
  const reached = LEVELS.filter((l) => n >= l.at);
  const current = reached[reached.length - 1] || null;
  const next = LEVELS.find((l) => n < l.at) || null;
  return { current, next, index: reached.length, toNext: next ? next.at - n : 0 };
}

/** The share of OTHER people who swiped the same way as me, from the counts after my vote. null if too few. */
export function withMe(agree, disagree, v) {
  const mine = (v === 1 ? agree : disagree) - 1;
  const others = agree + disagree - 1;
  return others >= MIN_CROWD ? Math.max(0, mine) / others : null;
}

const TYPES = {
  hype: ["The Hype Machine", "You back almost everything, and so does everyone else. Group chat royalty."],
  believer: ["The Lone Believer", "You say yes to things other people roll their eyes at. Respect."],
  realist: ["The Realist", "You shoot down bad takes, and the crowd usually backs you up."],
  hater: ["The Hater", "Nothing gets past you. Not even the popular stuff. Especially not the popular stuff."],
  normal: ["The Mirror", "You think what most people think. Scarily, perfectly normal."],
  wildcard: ["The Wildcard", "No pattern at all. You pick takes off a dartboard and defend them anyway."],
};

function typeFor(yes, against) {
  const rebel = against != null && against >= 35;
  let key;
  if (yes >= 58) key = rebel ? "believer" : "hype";
  else if (yes <= 42) key = rebel ? "hater" : "realist";
  else key = rebel ? "wildcard" : "normal";
  const [title, line] = TYPES[key];
  return { key, title, line };
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

function topicLabel(withCrowd) {
  if (withCrowd == null) return "Not enough crowd data yet";
  if (withCrowd >= 60) return "With the crowd";
  if (withCrowd <= 40) return "Against the crowd";
  return "Split down the middle";
}

/** Your position from your swipes. swipes: [{ id, text, tag, v: 1|-1, with: 0..1|null }]. null before UNLOCK. */
export function position(swipes) {
  const n = swipes.length;
  if (n < UNLOCK) return null;
  const lv = level(n);
  const yes = pct(swipes.filter((s) => s.v === 1).length, n);
  const judged = swipes.filter((s) => s.with != null);
  const against = judged.length >= 10 ? pct(judged.filter((s) => s.with < 0.5).length, judged.length) : null;
  const type = typeFor(yes, against);

  const byTag = {};
  swipes.forEach((s) => { (byTag[s.tag] = byTag[s.tag] || []).push(s); });
  const topics = Object.entries(byTag)
    .filter(([, list]) => list.length >= 4)
    .map(([tag, list]) => {
      const j = list.filter((s) => s.with != null);
      const withCrowd = j.length >= 3 ? Math.round((j.reduce((a, s) => a + s.with, 0) / j.length) * 100) : null;
      return { tag, count: list.length, yes: pct(list.filter((s) => s.v === 1).length, list.length), withCrowd, label: topicLabel(withCrowd) };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const showTopics = lv.index >= 3 ? topics : topics.slice(0, lv.index >= 2 ? 5 : 3);

  const rarest = lv.index >= 2 && judged.length
    ? judged.reduce((best, s) => (s.with < best.with ? s : best))
    : null;
  const scored = topics.filter((t) => t.withCrowd != null);
  const rebelZone = lv.index >= 3 && scored.length ? scored.reduce((a, b) => (b.withCrowd < a.withCrowd ? b : a)) : null;
  const comfortZone = lv.index >= 3 && scored.length > 1 ? scored.reduce((a, b) => (b.withCrowd > a.withCrowd ? b : a)) : null;
  // Deep cut: the takes where you're most outnumbered, one per topic, i.e. the hills you'd die on.
  const hills = lv.index >= 4
    ? Object.values(judged.reduce((acc, s) => {
      if (!acc[s.tag] || s.with < acc[s.tag].with) acc[s.tag] = s;
      return acc;
    }, {})).filter((s) => s.with < 0.5).sort((a, b) => a.with - b.with).slice(0, 6)
    : [];
  const confidence = Math.min(97, Math.round(40 + 57 * (1 - Math.exp(-n / 150))));

  return {
    n, level: lv, yes, against, judged: judged.length, type, topics: showTopics, hiddenTopics: topics.length - showTopics.length,
    rarest, rebelZone, comfortZone: comfortZone && rebelZone && comfortZone.tag !== rebelZone.tag ? comfortZone : null,
    hills, confidence,
  };
}

/** The next takes to show: everything not swiped yet, shuffled, never two of the same topic back to back when avoidable. */
export function nextTakes(catalog, swipedIds, rand = Math.random) {
  const seen = new Set(swipedIds);
  const left = catalog.filter((t) => !seen.has(t.id));
  for (let i = left.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  // Greedy: next is the first (shuffled) take from the topic with the most left, other than the last one shown.
  const remaining = {};
  left.forEach((t) => { remaining[t.tag] = (remaining[t.tag] || 0) + 1; });
  const out = [];
  while (left.length) {
    const last = out.length ? out[out.length - 1].tag : null;
    let best = -1;
    left.forEach((t, idx) => {
      if (t.tag === last) return;
      if (best < 0 || remaining[t.tag] > remaining[left[best].tag]) best = idx;
    });
    if (best < 0) best = 0;
    const [t] = left.splice(best, 1);
    remaining[t.tag] -= 1;
    out.push(t);
  }
  return out;
}

export function shareText(p) {
  if (!p) return "How do your takes stack up against everyone else's?";
  const crowd = p.against != null ? `, against the crowd ${p.against}% of the time` : "";
  return `I'm ${p.type.title} on indifferent Swipe: I agree with ${p.yes}% of takes${crowd}. What are you?`;
}

export function loadSwipes() {
  try {
    const list = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function saveSwipes(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX_STORED))); } catch { /* private mode: still works this visit */ }
}
