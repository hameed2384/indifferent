// Responsive container widths — every page capped its content at a fixed
// max-w-* with no upper breakpoint, so on anything wider than a laptop
// (a 2xl+ monitor, ~1536px and up) the content sat in a fixed-width column
// with the extra space just left blank on the side(s) instead of the layout
// adapting to it, the same way it already adapts down to mobile. These
// four tiers match the max-w-* values already chosen per page (respecting
// the existing narrow-form vs. wide-grid intent), just letting each one
// keep growing at 2xl instead of going flat.
export const CONTAINER_WIDE = "max-w-7xl 2xl:max-w-[1600px]"; // feed/grid/video pages: Watch, Claims, WatchRoom
export const CONTAINER_MEDIUM = "max-w-4xl 2xl:max-w-5xl"; // browse/detail pages with card grids: Profile, ClaimTree
export const CONTAINER_COMPACT = "max-w-3xl 2xl:max-w-4xl"; // single-flow pages: Onboarding, Match, PrivateChat
export const CONTAINER_NARROW = "max-w-2xl 2xl:max-w-3xl"; // forms/lists: Friends, Settings, Verify
