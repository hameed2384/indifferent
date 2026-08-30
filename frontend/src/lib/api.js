import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
