import { dailyIndex } from "./daily";

it("is stable within a UTC day and changes the next day", () => {
  const a = dailyIndex(10, new Date("2026-11-15T00:30:00Z"));
  const b = dailyIndex(10, new Date("2026-11-15T23:30:00Z"));
  const c = dailyIndex(10, new Date("2026-11-16T00:30:00Z"));
  expect(a).toBe(b);
  expect(c).toBe((a + 1) % 10);
});

it("stays in range and handles an empty list", () => {
  for (let d = 1; d <= 31; d++) {
    const i = dailyIndex(7, new Date(Date.UTC(2026, 0, d)));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(7);
  }
  expect(dailyIndex(0)).toBe(0);
});
