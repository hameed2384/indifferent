import { buildDeck, isMinority, scoreTest, QUESTION_COUNT } from "./indifferenceTest";
import { makeRandom } from "./arenaEngine";

const motions = ["Unhinged", "Gaming", "Relationships", "Movies & TV", "Technology", "Society", "Science", "Sports", "Politics"]
  .flatMap((tag) => [0, 1, 2, 3].map((i) => ({ slug: `${tag}-${i}`, tag, motion: `${tag} ${i}` })));
const a = (choice, secs = 4, minority = null) => ({ choice, secs, minority });

it("builds a varied deck with no politics or repeats", () => {
  const deck = buildDeck(motions, makeRandom(1));
  expect(deck).toHaveLength(QUESTION_COUNT);
  expect(new Set(deck.map((m) => m.slug)).size).toBe(QUESTION_COUNT);
  expect(deck.some((m) => m.tag === "Politics")).toBe(false);
  const perTag = {};
  deck.forEach((m) => { perTag[m.tag] = (perTag[m.tag] || 0) + 1; });
  expect(Math.max(...Object.values(perTag))).toBeLessThanOrEqual(2);
});

it("compares you only with other voters, and only with enough of them", () => {
  expect(isMinority("for", { votes_for: 3, votes_against: 8 })).toBe(true);
  expect(isMinority("against", { votes_for: 3, votes_against: 8 })).toBe(false);
  expect(isMinority("for", { votes_for: 2, votes_against: 3 })).toBeNull();
  expect(isMinority("for", { votes_for: 6, votes_against: 5 })).toBeNull();
  expect(isMinority("skip", { votes_for: 9, votes_against: 9 })).toBeNull();
  expect(isMinority("for", null)).toBeNull();
});

it("scores indifference from Don't care answers", () => {
  const r = scoreTest([...Array(7).fill(a("skip")), ...Array(3).fill(a("for"))]);
  expect(r.indifference).toBe(70);
  expect(r.title).toBe("Truly Indifferent");
});

it("gives each personality for its own pattern", () => {
  expect(scoreTest([...Array(4).fill(a("skip")), ...Array(6).fill(a("for"))]).key).toBe("shrugger");
  expect(scoreTest(Array(4).fill(a("for", 4, true))).key).toBe("contrarian");
  expect(scoreTest(Array(10).fill(a("against", 1))).key).toBe("machine");
  expect(scoreTest(Array(10).fill(a("for"))).key).toBe("believer");
  expect(scoreTest(Array(10).fill(a("against"))).key).toBe("sceptic");
  expect(scoreTest([...Array(5).fill(a("for")), ...Array(5).fill(a("against"))]).key).toBe("referee");
});

it("makes no crowd claim without enough crowd data", () => {
  expect(scoreTest([a("for", 4, true), a("for", 4, false)]).contrarian).toBeNull();
});
