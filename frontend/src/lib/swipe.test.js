import { LEVELS, UNLOCK, level, nextTakes, position, shareText, withMe } from "./swipe";
import { makeRandom } from "./arenaEngine";

const TAGS = ["Gaming", "Money & Work", "Relationships", "Society", "Technology", "Food"];
// n swipes cycling through the topics; `yesEvery` controls the yes-rate, `crowd` the share of others with me
function swipes(n, { yesEvery = 2, crowd = 0.7 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, text: `take ${i}`, tag: TAGS[i % TAGS.length], v: i % yesEvery === 0 ? 1 : -1,
    with: typeof crowd === "function" ? crowd(i) : crowd,
  }));
}

it("unlocks at 30 swipes and keeps levelling up, with no end to swiping", () => {
  expect(UNLOCK).toBe(30);
  expect(position(swipes(29))).toBeNull();
  expect(level(29)).toMatchObject({ current: null, next: LEVELS[0], toNext: 1 });
  expect(level(30).current.name).toBe("First read");
  expect(level(80)).toMatchObject({ index: 2, toNext: 70 });
  expect(level(5000)).toMatchObject({ index: LEVELS.length, next: null, toNext: 0 });
});

it("works out the share of other people who swiped my way", () => {
  expect(withMe(8, 2, 1)).toBeCloseTo(7 / 9);
  expect(withMe(8, 2, -1)).toBeCloseTo(1 / 9);
  expect(withMe(2, 1, 1)).toBeNull(); // too few others to mean anything
});

it("gives a type from the yes-rate and how often you're outnumbered", () => {
  expect(position(swipes(40, { yesEvery: 1, crowd: 0.8 })).type.key).toBe("hype");
  expect(position(swipes(40, { yesEvery: 1, crowd: 0.2 })).type.key).toBe("believer");
  expect(position(swipes(40, { yesEvery: 1000, crowd: 0.2 })).type.key).toBe("hater");
  expect(position(swipes(40, { yesEvery: 1000, crowd: 0.9 })).type.key).toBe("realist");
  expect(position(swipes(40, { yesEvery: 2, crowd: 0.9 })).type.key).toBe("normal");
  expect(position(swipes(40, { yesEvery: 2, crowd: 0.1 })).type.key).toBe("wildcard");
  const p = position(swipes(40, { yesEvery: 2, crowd: null }));
  expect(p.against).toBeNull(); // no crowd data yet: the type still works from the yes-rate
  expect(p.type.key).toBe("normal");
});

it("the more you swipe, the more the position shows", () => {
  const crowd = (i) => (i % 6 === 0 ? 0.1 : 0.8); // always outnumbered on Gaming
  const p30 = position(swipes(30, { crowd }));
  expect(p30.topics.length).toBe(3);
  expect(p30.rarest).toBeNull();
  expect(p30.rebelZone).toBeNull();
  const p80 = position(swipes(80, { crowd }));
  expect(p80.topics.length).toBe(5);
  expect(p80.rarest.tag).toBe("Gaming");
  const p160 = position(swipes(160, { crowd }));
  expect(p160.topics.length).toBe(6);
  expect(p160.rebelZone.tag).toBe("Gaming");
  expect(p160.rebelZone.label).toBe("Against the crowd");
  expect(p160.comfortZone.label).toBe("With the crowd");
  expect(p160.hills).toEqual([]);
  const p320 = position(swipes(320, { crowd }));
  expect(p320.hills.map((h) => h.tag)).toEqual(["Gaming"]);
  expect(p320.confidence).toBeGreaterThan(p30.confidence);
});

it("deals every unseen take once, shuffled, avoiding the same topic twice in a row", () => {
  const catalog = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, tag: TAGS[i % 3] }));
  const out = nextTakes(catalog, ["t0", "t1"], makeRandom(7));
  expect(out.length).toBe(58);
  expect(new Set(out.map((t) => t.id)).size).toBe(58);
  expect(out.some((t) => t.id === "t0")).toBe(false);
  for (let i = 1; i < out.length; i += 1) expect(out[i].tag).not.toBe(out[i - 1].tag);
});

it("writes a share line", () => {
  expect(shareText(position(swipes(40, { yesEvery: 1000, crowd: 0.2 })))).toMatch(/^I'm The Hater on indifferent Swipe: I agree with 3% of takes, against the crowd 100% of the time/);
});
