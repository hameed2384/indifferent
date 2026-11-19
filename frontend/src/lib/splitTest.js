/** The Split Test: compares two people's answers. Pure functions, tested without a browser. */
import { buildDeck } from "./indifferenceTest";

export const SPLIT_QUESTIONS = 12;
const OWNED_KEY = "indifferent-split-owned";
const ANSWERED_KEY = "indifferent-split-answered";

export function splitDeck(motions, rand = Math.random) {
  return buildDeck(motions, rand, SPLIT_QUESTIONS);
}

const LEVELS = [
  [0, "Same Brain", "One brain cell, shared perfectly. Slightly worrying, honestly."],
  [17, "Basically Twins", "You'd finish each other's hot takes."],
  [34, "Mostly Together", "Enough in common to get along, enough differences to keep it interesting."],
  [50, "Healthy Debate", "Every dinner together is a podcast episode."],
  [67, "Agree to Disagree", "You love each other. You just can't let the other one be wrong."],
  [84, "Opposite Ends", "If one of you says left, the other is already walking right."],
  [100, "Total Opposites", "Honestly, how do you two even get along?"],
];

/** How split two people are: share of takes they answered differently, plus a verdict. */
export function compare(a, b, deck = []) {
  const n = Math.min(a.length, b.length);
  const items = Array.from({ length: n }, (_, i) => ({ ...(deck[i] || {}), a: a[i], b: b[i], split: a[i] !== b[i] }));
  const splits = items.filter((x) => x.split).length;
  const split = n ? Math.round((splits / n) * 100) : 0;
  const [, title, line] = LEVELS.find(([max]) => split <= max);
  return { split, splits, together: n - splits, total: n, title, line, items };
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
