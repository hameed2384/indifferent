import { setVisibleInterval } from "./poll";

let hidden = false;
beforeAll(() => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
beforeEach(() => { jest.useFakeTimers(); hidden = false; });
afterEach(() => jest.useRealTimers());

it("polls while visible", () => {
  const fn = jest.fn();
  const stop = setVisibleInterval(fn, 1000);
  jest.advanceTimersByTime(3000);
  expect(fn).toHaveBeenCalledTimes(3);
  stop();
});

it("pauses while hidden and catches up when visible again", () => {
  const fn = jest.fn();
  const stop = setVisibleInterval(fn, 1000);
  hidden = true;
  jest.advanceTimersByTime(5000);
  expect(fn).not.toHaveBeenCalled();

  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(fn).toHaveBeenCalledTimes(1);
  stop();
});

it("stops completely after cleanup", () => {
  const fn = jest.fn();
  const stop = setVisibleInterval(fn, 1000);
  stop();
  jest.advanceTimersByTime(5000);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(fn).not.toHaveBeenCalled();
});
