import { api } from "@/lib/api";

// Guest sparring rounds (no account): the backend hands back a secret token
// per round, which this browser keeps and sends as X-Guest-Token. After the
// visitor signs in, claimGuestRounds() moves those rounds into their account.
const KEY = "indifferent-guest-spar";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

function write(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* best-effort */ }
}

export function saveGuestToken(debateId, token) {
  write({ ...read(), [debateId]: token });
}

export function getGuestToken(debateId) {
  return read()[debateId] || null;
}

export function guestHeaders(debateId) {
  const token = getGuestToken(debateId);
  return token ? { "X-Guest-Token": token } : {};
}

/** Claims every stored guest round into the signed-in account. Returns the
 * ids that were claimed (most recent last). Failures are dropped: a round
 * that can't be claimed (expired, already claimed) isn't worth blocking on. */
export async function claimGuestRounds() {
  const map = read();
  const claimed = [];
  for (const [debateId, token] of Object.entries(map)) {
    try {
      await api.post(`/spar/${debateId}/claim`, null, { headers: { "X-Guest-Token": token } });
      claimed.push(debateId);
    } catch { /* skip */ }
  }
  write({});
  return claimed;
}
