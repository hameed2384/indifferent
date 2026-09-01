// Shared between App.js (captures ?ref= on landing) and AuthCallback.jsx
// (reads it back once sign-in actually completes) and Settings.jsx (builds
// the invite link). A plain module constant, not exported from a page
// component, so neither side has to import the other.
export const REFERRAL_KEY = "indifferent-referral-code";
