import { excludeCategories, readNotInterested } from "./notInterested";

beforeEach(() => localStorage.clear());

it("starts empty", () => {
  expect([...readNotInterested()]).toEqual([]);
});

it("excludes categories and can undo", () => {
  excludeCategories(["Politics"]);
  const undo = excludeCategories(["Sport", "Politics"]);
  expect([...readNotInterested()].sort()).toEqual(["Politics", "Sport"]);

  undo();
  expect([...readNotInterested()]).toEqual(["Politics"]);
});

it("survives corrupted storage", () => {
  localStorage.setItem("indifferent-not-interested-categories", "{not json");
  expect([...readNotInterested()]).toEqual([]);
});
