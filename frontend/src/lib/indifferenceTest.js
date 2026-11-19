/** "How Indifferent Are You?": picks the questions and works out the result.
 * Pure functions, so the scoring can be tested without a browser. */

export const QUESTION_COUNT = 10;
const MAX_PER_TAG = 2;
export const MIN_CROWD = 5; // fewer other voters than this says nothing about "the crowd"

/** A light, varied deck: politics stays out, and the fun categories come first. */
export function buildDeck(motions, rand = Math.random, count = QUESTION_COUNT) {
  const shuffled = motions.filter((m) => m.tag !== "Politics")
    .map((m) => [rand(), m]).sort((a, b) => a[0] - b[0]).map(([, m]) => m);
  const first = ["Unhinged", "Gaming", "Relationships", "Movies & TV"];
  const ordered = [...shuffled.filter((m) => first.includes(m.tag)), ...shuffled.filter((m) => !first.includes(m.tag))];
  const used = {};
  const deck = [];
  ordered.forEach((m) => {
    if (deck.length < count && (used[m.tag] || 0) < MAX_PER_TAG) {
      used[m.tag] = (used[m.tag] || 0) + 1;
      deck.push(m);
    }
  });
  return deck.map((m) => [rand(), m]).sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}

/** Whether this answer is the minority view among the OTHER voters; null if unknown. */
export function isMinority(choice, tally) {
  if (!tally || choice === "skip") return null;
  const forOthers = tally.votes_for - (choice === "for" ? 1 : 0);
  const againstOthers = tally.votes_against - (choice === "against" ? 1 : 0);
  const others = forOthers + againstOthers;
  if (others < MIN_CROWD || forOthers === againstOthers) return null;
  return choice === "for" ? forOthers < againstOthers : againstOthers < forOthers;
}

const TYPES = {
  indifferent: ["Truly Indifferent", "Nothing gets to you. Everyone is shouting, and you are wondering what's for dinner."],
  shrugger: ["The Shrugger", "You pick your battles, and most of them aren't worth picking."],
  contrarian: ["The Contrarian", "If the room agrees, you are already looking for the door."],
  believer: ["The Optimist", "You hear a bold claim and think: fair enough, go on."],
  sceptic: ["The Sceptic", "You have never met a confident opinion you couldn't doubt."],
  machine: ["The Hot Take Machine", "You answered before the question finished loading. No regrets."],
  referee: ["The Referee", "You weigh it up, make the call, and let them argue about it afterwards."],
};

export function scoreTest(answers) {
  const total = answers.length || 1;
  const count = (c) => answers.filter((a) => a.choice === c).length;
  const skipped = count("skip");
  const agreed = count("for");
  const disagreed = count("against");
  const opinions = agreed + disagreed;
  const known = answers.filter((a) => a.minority === true || a.minority === false);
  const contrarian = known.length >= 3 ? Math.round((known.filter((a) => a.minority).length / known.length) * 100) : null;
  const averageSecs = answers.reduce((sum, a) => sum + a.secs, 0) / total;
  const indifference = Math.round((skipped / total) * 100);
  let key = "referee";
  if (indifference >= 60) key = "indifferent";
  else if (indifference >= 30) key = "shrugger";
  else if (contrarian !== null && contrarian >= 50) key = "contrarian";
  else if (averageSecs < 2.2) key = "machine";
  else if (opinions && agreed / opinions >= 0.7) key = "believer";
  else if (opinions && disagreed / opinions >= 0.7) key = "sceptic";
  const [title, line] = TYPES[key];
  return { indifference, agreed, disagreed, skipped, contrarian, averageSecs, key, title, line };
}
