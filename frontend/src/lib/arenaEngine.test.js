import { createFight, seedFrom, voteEdge, STEP } from "./arenaEngine";

const FRAMES = Math.ceil(45 / STEP);

function play(fight, onStep) {
  for (let i = 0; i < FRAMES && fight.winner === null; i += 1) {
    if (onStep) onStep(fight, i);
    fight.step();
  }
  return fight;
}

it("always finishes with a winner, across many fights", () => {
  for (let seed = 0; seed < 60; seed += 1) {
    const f = play(createFight({ seed: seed * 7919 }));
    expect([0, 1]).toContain(f.winner);
    expect(f.t).toBeLessThan(40);
  }
});

it("is exactly repeatable from the same seed", () => {
  const a = play(createFight({ seed: 42 }));
  const b = play(createFight({ seed: 42 }));
  expect([a.winner, a.t, a.broken]).toEqual([b.winner, b.t, b.broken]);
});

it("is a real contest: both sides win, and no side wins every time", () => {
  const wins = [0, 0];
  for (let seed = 0; seed < 80; seed += 1) wins[play(createFight({ seed: seed * 104729 })).winner] += 1;
  expect(Math.min(...wins)).toBeGreaterThan(20);
});

it("every brick is gone once someone escapes", () => {
  const f = play(createFight({ seed: 5 }));
  expect(f.alive.flat().some(Boolean)).toBe(false);
});

it("a boost has a cooldown and stops after the win", () => {
  const f = createFight({ seed: 9 });
  expect(f.boost(0)).toBe(true);
  expect(f.boost(0)).toBe(false);
  for (let i = 0; i < 1 / STEP + 2; i += 1) f.step();
  expect(f.boost(0)).toBe(true);
  play(f);
  expect(f.boost(1)).toBe(false);
});

it("vote edge stays small with few votes and within limits", () => {
  expect(voteEdge(0, 0)).toBe(0);
  expect(Math.abs(voteEdge(1, 0))).toBeLessThan(0.1);
  expect(voteEdge(100000, 0)).toBeLessThanOrEqual(1);
  expect(voteEdge(0, 100000)).toBeGreaterThanOrEqual(-1);
});

it("seeds differ between debates", () => {
  expect(seedFrom("a")).not.toBe(seedFrom("b"));
});
