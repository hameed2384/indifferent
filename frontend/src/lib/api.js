import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "indifferent-session-token";

/** Bearer-token fallback for the session cookie. The cookie alone doesn't
 * work on Safari/WebKit (macOS and — since it's mandatory there — every iOS
 * browser, not just Safari itself): ITP blocks third-party cookie storage
 * outright when frontend and backend are on different registrable domains
 * (indifferent.hameed.pro vs backend-kappa-lac-93.vercel.app), so
 * Set-Cookie from a cross-origin XHR response is silently dropped. Login
 * still "succeeds" (the response body comes back fine), but every
 * following request has no cookie to send and 401s — which is exactly why
 * this broke specifically at first-submit-after-login, not at login itself.
 * The backend already accepts this as a fallback (deps.py:get_current_user
 * checks the cookie first, then Authorization: Bearer) and already returns
 * the raw token from /auth/google/callback — this was half-built on the
 * backend and never wired up here. Storing it in localStorage (not
 * sessionStorage) so it survives the OAuth redirect round-trip even if the
 * browser doesn't keep the same tab/process alive for it. */
export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* noop — falls back to cookie-only, same as before this existed */ }
}
function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  // Forces a CORS preflight on every request, which the backend's
  // origin-restricted CORS policy blocks for anyone but this app — the
  // actual CSRF mitigation for cookie-authenticated mutating endpoints
  // (see backend/app/deps.py:require_xhr). Not meaningful on its own; it
  // only works because a third-party site's forged request can't set it.
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

// Harmless when the cookie already works (backend checks cookie first) —
// this only ever matters as the fallback described above.
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
