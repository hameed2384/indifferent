/** The indifferent hub: each area of the site is its own named product.
 * One list, used by the home page hub and the side menu, so names stay in step.
 * `sub` is the planned subdomain (e.g. split.indifferentapp.com); the paths are
 * today's addresses and should keep redirecting once subdomains go live. */
export const PRODUCTS = [
  {
    key: "be", name: "BeIndifferent", sub: "be", path: "/watch", match: ["/watch", "/try", "/spar", "/match"],
    pitch: "Debate someone who disagrees with you, live or against an AI, and get scored.",
    cta: "Start a debate", start: "/try", accent: "#3ae4a4",
  },
  {
    key: "split", name: "The Split Test", sub: "split", path: "/split-test", match: ["/split-test"],
    pitch: "Answer 12 hot takes, send it to a friend, and see exactly where you split.",
    cta: "Take it with a friend", accent: "#ff5c7a", badge: "New",
  },
  {
    key: "mirror", name: "The Mirror", sub: "mirror", path: "/how-indifferent-are-you", match: ["/how-indifferent-are-you"],
    pitch: "Ten takes, one honest reflection: how indifferent are you, really?",
    cta: "Look in the mirror", accent: "#a78bfa",
  },
  {
    key: "arena", name: "The Arena", sub: "arena", path: "/arena", match: ["/arena"],
    pitch: "Pick a side and watch your ball smash its way out of the rings.",
    cta: "Enter the Arena", accent: "#fbbf24",
  },
  {
    key: "claims", name: "Claims", sub: "claims", path: "/claims", match: ["/claims"],
    pitch: "Video arguments you can reply to, branching into full claim trees.",
    cta: "Browse claims", accent: "#60a5fa",
  },
  {
    key: "bothsides", name: "Both Sides", sub: "bothsides", path: "/motions", match: ["/motions"],
    pitch: "The strongest case for and against today's biggest questions.",
    cta: "Read both sides", accent: "#f472b6",
  },
];

export function productFor(pathname) {
  return PRODUCTS.find((p) => p.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))) || null;
}
