// Responsive container widths — every page capped its content at a fixed
// max-w-* with no upper breakpoint, so on anything wider than a laptop
// (a 2xl+ monitor, ~1536px and up) the content sat in a fixed-width column
// with the extra space just left blank on the side(s) instead of the layout
// adapting to it, the same way it already adapts down to mobile. These
// four tiers match the max-w-* values already chosen per page (respecting
// the existing narrow-form vs. wide-grid intent), just letting each one
// keep growing at 2xl instead of going flat.
// Feed/grid/video pages: Watch, Claims, WatchRoom. The previous cap
// (max-w-7xl 2xl:max-w-[1600px]) is exactly why these pages stopped
// scaling past a laptop-sized window while YouTube's own feed keeps
// adding tiles as the window widens — FEED_GRID below is the part that
// actually does that scaling (more columns, not wider ones), so the
// outer cap just needs to stay out of its way. Not fully uncapped
// (max-w-none): a single-CTA banner card sharing this same container
// would stretch to the same width as the grid and look sparse/broken on
// a genuinely huge display — 2400px comfortably covers a 3440px
// ultrawide's usable column count without doing that.
export const CONTAINER_WIDE = "max-w-[2400px]";
// auto-fill computes however many >=280px columns fit and stretches them
// to share the row evenly — column COUNT grows with window width (same
// as YouTube's home grid), rather than card width growing unbounded or
// being capped at a hand-picked breakpoint count that goes flat past 2xl.
export const FEED_GRID = "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]";
export const CONTAINER_MEDIUM = "max-w-4xl 2xl:max-w-5xl"; // browse/detail pages with card grids: Profile, ClaimTree
export const CONTAINER_COMPACT = "max-w-3xl 2xl:max-w-4xl"; // single-flow pages: Onboarding, Match, PrivateChat
export const CONTAINER_NARROW = "max-w-2xl 2xl:max-w-3xl"; // forms/lists: Friends, Settings, Verify
