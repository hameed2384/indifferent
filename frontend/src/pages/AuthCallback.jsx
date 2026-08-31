import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, setStoredToken } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) { toast.error("Sign-in link was invalid — try again."); navigate("/", { replace: true }); return; }

    // Must be the exact redirect_uri Google was sent in the initial authorize
    // request (lib/auth.js's startGoogleLogin stashed it — Google's token
    // endpoint requires an exact match, and by the time we're here
    // window.location.origin is the same value anyway, this is just
    // belt-and-suspenders against edge cases like a trailing-slash mismatch).
    const redirectUri = sessionStorage.getItem("google_oauth_redirect_uri")
      || (window.location.origin + "/auth/callback");

    (async () => {
      try {
        const { data } = await api.post("/auth/google/callback", { code, redirect_uri: redirectUri });
        setStoredToken(data.session_token);
        sessionStorage.removeItem("google_oauth_redirect_uri");
        setUser(data.user);
        // Onboarded users land back on the feed (home), same as YouTube/Twitch
        // return you to the feed after signing in rather than a separate
        // account page — profile/friends/settings are still one click away
        // via the avatar menu.
        const target = data.user.onboarded ? "/" : "/onboarding";
        navigate(target, { replace: true, state: { user: data.user } });
      } catch (e) {
        console.error("Auth callback failed", e);
        toast.error("Sign-in failed — try again.");
        navigate("/", { replace: true });
      }
    })();
  }, [location.search, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
      <div className="font-mono-ui text-sm tracking-widest uppercase text-[var(--fg-subtle)]">Establishing session…</div>
    </div>
  );
}
