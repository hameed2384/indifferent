import { isTitleConfirmed, titleFor } from "./debateTitle";

describe("titleFor", () => {
  it("prefers a human-set custom title", () => {
    expect(titleFor({ custom_title: "Cats > dogs", topics: ["AI guess"] })).toBe("Cats > dogs");
  });

  it("falls back to the first generated topic", () => {
    expect(titleFor({ topics: ["Is remote work better?", "other"] })).toBe("Is remote work better?");
  });

  it("falls back to the category", () => {
    expect(titleFor({ topics: [], categories: ["Music"] })).toBe("Music debate");
  });

  it("never pretends there is a topic", () => {
    expect(titleFor({})).toBe("Untitled debate");
  });
});

describe("isTitleConfirmed", () => {
  it("is confirmed once a human set the title", () => {
    expect(isTitleConfirmed({ custom_title: "x", status: "active" })).toBe(true);
  });

  it("is confirmed once the debate is over", () => {
    expect(isTitleConfirmed({ status: "ended" })).toBe(true);
  });

  it("is only a suggestion while live with no custom title", () => {
    expect(isTitleConfirmed({ status: "active", topics: ["guess"] })).toBe(false);
  });
});
