import { detectSource } from "./referral";

const HOST = "www.indifferentapp.com";

test("utm_source wins and is slugged", () => {
  expect(detectSource("?utm_source=Instagram&utm_medium=bio", "", HOST)).toBe("instagram");
  expect(detectSource("?src=YouTube", "https://google.com/", HOST)).toBe("youtube");
  expect(detectSource("?utm_source=<b>x</b>", "", HOST)).toBe("bxb");
});

test("known referrers map to a channel", () => {
  expect(detectSource("", "https://l.instagram.com/?u=x", HOST)).toBe("instagram");
  expect(detectSource("", "https://www.google.co.uk/", HOST)).toBe("google");
  expect(detectSource("", "https://m.youtube.com/watch", HOST)).toBe("youtube");
  expect(detectSource("", "https://t.co/abc", HOST)).toBe("twitter");
});

test("no referrer or own site is direct, unknown sites keep their host", () => {
  expect(detectSource("", "", HOST)).toBe("direct");
  expect(detectSource("", "https://www.indifferentapp.com/motions", HOST)).toBe("direct");
  expect(detectSource("", "https://www.somebigblog.net/post", HOST)).toBe("somebigblog.net");
});
