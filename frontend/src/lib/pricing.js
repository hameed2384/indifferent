// Single source for the two Stripe price display strings (see
// backend/app/routers/payments.py for the actual price IDs/amounts) — used
// to be hardcoded independently in Profile.jsx and Settings.jsx, so a price
// change meant finding and editing both.
export const MEMBERSHIP_PRICE = "£9/mo";
export const DEBATER_SUB_PRICE = "£2/mo";
