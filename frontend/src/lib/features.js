// Business-model switches. Both default OFF while the app is building its
// first users:
// - Ads earn close to nothing at low traffic and make a new product feel
//   cheap at exactly the moment first impressions matter most.
// - Paid tiers (the ad-free membership and per-debater subscriptions) have
//   little to sell before there's an audience, and taking payments moves the
//   project off Vercel's non-commercial Hobby plan.
// The code paths stay intact behind these flags; turn either on by setting
// the env var to "true" in the frontend's Vercel project and redeploying.
export const ADS_ENABLED = process.env.REACT_APP_ENABLE_ADS === "true";
export const PAYMENTS_ENABLED = process.env.REACT_APP_ENABLE_PAYMENTS === "true";
