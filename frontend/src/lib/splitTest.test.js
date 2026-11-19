import { compare, splitDeck, SPLIT_QUESTIONS, rememberOwned, ownedTests, rememberAnswered, answeredTests } from "./splitTest";
import { makeRandom } from "./arenaEngine";

const F = "for";
const X = "against";

it("finds where two people split", () => {
  const r = compare([F, F, X, X], [F, X, X, F], [{ motion: "a" }, { motion: "b" }, { motion: "c" }, { motion: "d" }]);
  expect(r.split).toBe(50);
  expect(r.splits).toBe(2);
  expect(r.together).toBe(2);
  expect(r.items.map((x) => x.split)).toEqual([false, true, false, true]);
  expect(r.items[1]).toMatchObject({ motion: "b", a: F, b: X });
  expect(r.title).toBe("Healthy Debate");
});

it("gives a verdict across the whole range", () => {
  const twelve = (splits) => compare(Array(12).fill(F), [...Array(splits).fill(X), ...Array(12 - splits).fill(F)]);
  expect(twelve(0).title).toBe("Same Brain");
  expect(twelve(2).title).toBe("Basically Twins");
  expect(twelve(4).title).toBe("Mostly Together");
  expect(twelve(7).title).toBe("Agree to Disagree");
  expect(twelve(10).title).toBe("Opposite Ends");
  expect(twelve(12).title).toBe("Total Opposites");
  expect(twelve(12).split).toBe(100);
});

it("builds a 12-take deck", () => {
  const motions = ["Unhinged", "Gaming", "Relationships", "Movies & TV", "Technology", "Society", "Science", "Sports"]
    .flatMap((tag) => [0, 1, 2].map((i) => ({ slug: `${tag}-${i}`, tag, motion: `${tag} ${i}` })));
  const deck = splitDeck(motions, makeRandom(3));
  expect(deck).toHaveLength(SPLIT_QUESTIONS);
  expect(new Set(deck.map((m) => m.slug)).size).toBe(SPLIT_QUESTIONS);
});

it("remembers tests made and answered in this browser", () => {
  rememberOwned("abc123", "secret", "Sam");
  expect(ownedTests().abc123).toMatchObject({ key: "secret", name: "Sam" });
  rememberAnswered("xyz789", { name: "Sam" });
  expect(answeredTests().xyz789).toEqual({ name: "Sam" });
});
