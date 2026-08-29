// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export function startGoogleLogin() {
  // Direct Google OAuth (authorization-code flow). redirect_uri must be one
  // of the "Authorized redirect URIs" on the Google Cloud OAuth client, and
  // AuthCallback sends this exact same value back to the backend so it can
  // be replayed to Google's token endpoint (which requires an exact match).
  const redirectUri = window.location.origin + "/auth/callback";
  sessionStorage.setItem("google_oauth_redirect_uri", redirectUri);
  const params = new URLSearchParams({
    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
