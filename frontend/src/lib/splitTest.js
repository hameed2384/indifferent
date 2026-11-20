/** The Split Test: compares two people's answers. Pure functions, tested without a browser.
 *
 * Borrowed from the big personality and values tests:
 *  - a 5-point agree/disagree scale (16Personalities, 8values), so "how much" counts, not just "which side";
 *  - each person gets a type built from two traits, shown as bars (8values axes, 16Personalities types);
 *  - the pair gets a match score, the areas where they click and clash (Truity-style compatibility),
 *    plus their biggest clash and strongest bond.
 * Old tests stored "for"/"against"; those read as a strong agree or disagree. */
import { buildDeck } from "./indifferenceTest";

export const SPLIT_QUESTIONS = 12;
const OWNED_KEY = "indifferent-split-owned";
const ANSWERED_KEY = "indifferent-split-answered";

/** The answer scale, left to right. */
export const SCALE = [
  { value: -2, label: "Strongly disagree", short: "Strongly disagree" },
  { value: -1, label: "Disagree", short: "Disagree" },
  { value: 0, label: "Not sure", short: "Not sure" },
  { value: 1, label: "Agree", short: "Agree" },
  { value: 2, label: "Strongly agree", short: "Strongly agree" },
];

export function splitDeck(motions, rand = Math.random) {
  return buildDeck(motions, rand, SPLIT_QUESTIONS);
}

/** Any stored answer as a number from -2 to 2. */
export function toValue(answer) {
  if (answer === "for") return 2;
  if (answer === "against") return -2;
  const n = Number(answer);
  return Number.isFinite(n) ? Math.max(-2, Math.min(2, Math.round(n))) : 0;
}

export const answerLabel = (answer) => SCALE.find((s) => s.value === toValue(answer)).label;

const LEVELS = [
  [0, "Same Brain", "One brain cell, shared perfectly. Slightly worrying, honestly."],
  [17, "Basically Twins", "You'd finish each other's hot takes."],
  [34, "Mostly Together", "Enough in common to get along, enough differences to keep it interesting."],
  [50, "Healthy Debate", "Every dinner together is a podcast episode."],
  [67, "Agree to Disagree", "You love each other. You just can't let the other one be wrong."],
  [84, "Opposite Ends", "If one of you says left, the other is already walking right."],
  [100, "Total Opposites", "Honestly, how do you two even get along?"],
];

/** Each person's type: how strongly they answer (conviction) and which way they lean. */
const TYPES = {
  champion: ["The Champion", "Big yes energy. You back things loudly and mean it."],
  critic: ["The Critic", "You came to disagree and you brought receipts."],
  easygoer: ["The Easygoer", "Mostly on board, rarely fussed. Hard to fall out with."],
  sceptic: ["The Sceptic", "Quietly unconvinced by most things. Prove it first."],
  wildcard: ["The Wildcard", "All-in both ways. Nobody can predict your next take."],
  diplomat: ["The Diplomat", "You see both sides of everything, sometimes at the same time."],
};

/** One person's traits (0-100) and type, from their answers. */
export function profile(answers) {
  const v = answers.map(toValue);
  const n = v.length || 1;
  const conviction = Math.round((v.reduce((s, x) => s + Math.abs(x), 0) / (2 * n)) * 100);
  const opinions = v.filter((x) => x !== 0);
  const agree = opinions.length ? Math.round((opinions.filter((x) => x > 0).length / opinions.length) * 100) : 50;
  const bold = conviction >= 60;
  let key;
  if (agree >= 60) key = bold ? "champion" : "easygoer";
  else if (agree <= 40) key = bold ? "critic" : "sceptic";
  else key = bold ? "wildcard" : "diplomat";
  const [title, line] = TYPES[key];
  return { key, title, line, conviction, agree };
}

/** How split two people are, how close on each take, and where they click and clash. */
export function compare(a, b, deck = []) {
  const n = Math.min(a.length, b.length);
  const items = Array.from({ length: n }, (_, i) => {
    const va = toValue(a[i]);
    const vb = toValue(b[i]);
    const gap = Math.abs(va - vb); // 0..4
    return {
      ...(deck[i] || {}), a: a[i], b: b[i], va, vb, gap,
      split: va * vb < 0, // opposite sides
      close: gap <= 1 && va * vb >= 0,
    };
  });
  const splits = items.filter((x) => x.split).length;
  const split = n ? Math.round((items.reduce((s, x) => s + x.gap, 0) / (4 * n)) * 100) : 0;
  const [, title, line] = LEVELS.find(([max]) => split <= max);

  // Biggest clash: furthest apart, strongest feelings first. Strongest bond: same answer, strongest first.
  const byClash = items.filter((x) => x.gap >= 2).sort((x, y) => y.gap - x.gap || (Math.abs(y.va) + Math.abs(y.vb)) - (Math.abs(x.va) + Math.abs(x.vb)));
  const byBond = items.filter((x) => x.gap === 0 && x.va !== 0).sort((x, y) => Math.abs(y.va) - Math.abs(x.va));

  const tags = {};
  items.forEach((x) => {
    if (!x.tag) return;
    tags[x.tag] = tags[x.tag] || { tag: x.tag, gap: 0, count: 0 };
    tags[x.tag].gap += x.gap;
    tags[x.tag].count += 1;
  });
  const areas = Object.values(tags)
    .map((t) => ({ tag: t.tag, match: Math.round(100 - (t.gap / (4 * t.count)) * 100), count: t.count }))
    .sort((x, y) => y.match - x.match || x.tag.localeCompare(y.tag));

  return {
    split, match: 100 - split, splits, together: n - splits, total: n, title, line, items,
    clash: byClash[0] || null, bond: byBond[0] || null,
    click: areas.filter((t) => t.match >= 75).slice(0, 3),
    clashAreas: areas.filter((t) => t.match < 50).reverse().slice(0, 3),
    areas,
  };
}

/** Friends who took the creator's test, closest match first (the "who knows you best" list). */
export function rankResponses(answers, responses) {
  return responses
    .map((r) => ({ ...r, result: compare(answers, r.answers) }))
    .sort((x, y) => x.result.split - y.result.split);
}

function readList(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}

function writeList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* private mode: still works this visit */ }
}

/** Tests this browser made: code -> { key, name }. */
export const ownedTests = () => readList(OWNED_KEY);
export function rememberOwned(code, key, name) {
  writeList(OWNED_KEY, { ...readList(OWNED_KEY), [code]: { key, name, at: Date.now() } });
}

/** Tests this browser answered: code -> the full result, so it can be shown again. */
export const answeredTests = () => readList(ANSWERED_KEY);
export function rememberAnswered(code, result) {
  writeList(ANSWERED_KEY, { ...readList(ANSWERED_KEY), [code]: result });
}
