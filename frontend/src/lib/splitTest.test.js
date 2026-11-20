import {
  compare, splitDeck, SPLIT_QUESTIONS, rememberOwned, ownedTests, rememberAnswered, answeredTests,
  toValue, profile, rankResponses, answerLabel,
} from "./splitTest";
import { makeRandom } from "./arenaEngine";

const F = "for";
const X = "against";

it("reads old for/against answers as strong ones, so old tests score the same", () => {
  expect(toValue(F)).toBe(2);
  expect(toValue(X)).toBe(-2);
  expect(toValue(1)).toBe(1);
  expect(toValue(9)).toBe(2);
  expect(answerLabel(F)).toBe("Strongly agree");
  const r = compare([F, F, X, X], [F, X, X, F], [{ motion: "a" }, { motion: "b" }, { motion: "c" }, { motion: "d" }]);
  expect(r.split).toBe(50);
  expect(r.match).toBe(50);
  expect(r.splits).toBe(2);
  expect(r.together).toBe(2);
  expect(r.items.map((x) => x.split)).toEqual([false, true, false, true]);
  expect(r.items[1]).toMatchObject({ motion: "b", a: F, b: X, gap: 4 });
  expect(r.title).toBe("Healthy Debate");
});

it("counts how far apart people are, not just which side", () => {
  const close = compare([2, 1, -1], [1, 1, -2]);
  expect(close.splits).toBe(0);
  expect(close.items.every((x) => x.close)).toBe(true);
  expect(close.split).toBe(Math.round((2 / 12) * 100));
  const far = compare([2], [-2]);
  expect(far.split).toBe(100);
  const unsure = compare([0], [2]);
  expect(unsure.items[0].split).toBe(false);
  expect(unsure.items[0].gap).toBe(2);
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

it("finds the biggest clash, strongest bond and the areas where you click and clash", () => {
  const deck = [
    { motion: "pizza", tag: "Food" }, { motion: "pineapple", tag: "Food" },
    { motion: "consoles", tag: "Gaming" }, { motion: "speedruns", tag: "Gaming" },
    { motion: "texting", tag: "Relationships" },
  ];
  const r = compare([2, 1, -2, -1, 1], [2, 1, 2, 2, 0], deck);
  expect(r.bond.motion).toBe("pizza");
  expect(r.clash.motion).toBe("consoles");
  expect(r.click.map((t) => t.tag)).toEqual(["Food", "Relationships"]);
  expect(r.clashAreas.map((t) => t.tag)).toEqual(["Gaming"]);
  expect(r.areas.find((t) => t.tag === "Food").match).toBe(100);
});

it("gives each person a type from how strongly and which way they answer", () => {
  expect(profile([2, 2, 2, 1, -2]).key).toBe("champion");
  expect(profile([-2, -2, -1, -2, 2]).key).toBe("critic");
  expect(profile([1, 1, 1, 0, -1]).key).toBe("easygoer");
  expect(profile([-1, -1, 0, -1, 1]).key).toBe("sceptic");
  expect(profile([2, -2, 2, -2]).key).toBe("wildcard");
  expect(profile([0, 0, 1, -1]).key).toBe("diplomat");
  const p = profile([2, 2, 0, 0]);
  expect(p.conviction).toBe(50);
  expect(p.agree).toBe(100);
  expect(profile([F, F, X]).key).toBe("champion");
});

it("ranks friends by who matches best", () => {
  const ranked = rankResponses([2, 2, 2], [
    { name: "Far", answers: [-2, -2, -2] },
    { name: "Near", answers: [2, 2, 1] },
    { name: "Mid", answers: [2, -2, 0] },
  ]);
  expect(ranked.map((r) => r.name)).toEqual(["Near", "Mid", "Far"]);
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
