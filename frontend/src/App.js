import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { useTheme } from "@/hooks/use-theme";
import "@/App.css";
import AuthCallback from "@/pages/AuthCallback";
import Friends from "@/pages/Friends";
import Onboarding from "@/pages/Onboarding";
import Verify from "@/pages/Verify";
import Match from "@/pages/Match";
import Spar, { SparHistory, SparShare, TryPage } from "@/pages/Spar";
import { MotionsIndex, MotionPage } from "@/pages/Motions";
import { Privacy, Terms } from "@/pages/Legal";
import ChatRoom from "@/pages/ChatRoom";
import Watch from "@/pages/Watch";
import WatchRoom from "@/pages/WatchRoom";
import Profile from "@/pages/Profile";
import PrivateChat from "@/pages/PrivateChat";
import Claims from "@/pages/Claims";
import ClaimTree from "@/pages/ClaimTree";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import { REFERRAL_KEY, captureSource } from "@/lib/referral";
import { api } from "@/lib/api";

function RouterInner() {
  // Captured on whatever route a shared link lands on (home, a debate, a
  // claim, a profile) — not just "/" — since a referral link is realistically
  // going to point at a specific piece of content, not the bare homepage.
  // Read back once by AuthCallback.jsx when sign-in actually completes; only
  // ever applied server-side to a brand-new account (see auth.py).
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      try { localStorage.setItem(REFERRAL_KEY, ref); } catch { /* noop */ }
    }
    // Which channel brought this visit (admin Growth tab). Fire-and-forget.
    const source = captureSource();
    if (source) api.post("/public/visit", { source }).catch(() => {});
  }, []);

  return (
    <Routes>
      {/* Home IS the watch feed (client feedback: no separate marketing splash —
          live/featured/previously-published debates, same as YouTube/Twitch's
          own home page). Both paths render the same component. */}
      <Route path="/" element={<Watch />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/watch" element={<Watch />} />
      <Route path="/watch/:roomId" element={<WatchRoom />} />
      <Route path="/u/:userId" element={<Profile />} />
      <Route path="/claims" element={<Claims />} />
      <Route path="/claims/:clipId" element={<ClaimTree />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/verify" element={<ProtectedRoute requireOnboarded><Verify /></ProtectedRoute>} />
      <Route path="/friends" element={<ProtectedRoute requireOnboarded><Friends /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requireOnboarded><Settings /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute requireOnboarded requireVerified><Match /></ProtectedRoute>} />
      <Route path="/spar" element={<ProtectedRoute requireOnboarded><SparHistory /></ProtectedRoute>} />
      <Route path="/spar/:debateId" element={<ProtectedRoute requireOnboarded><Spar /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute requireOnboarded requireVerified><ChatRoom /></ProtectedRoute>} />
      <Route path="/private/:friendId" element={<ProtectedRoute requireOnboarded><PrivateChat /></ProtectedRoute>} />
      <Route path="/s/:shareId" element={<SparShare />} />
      <Route path="/try" element={<TryPage />} />
      <Route path="/motions" element={<MotionsIndex />} />
      <Route path="/motions/:slug" element={<MotionPage />} />
      <Route path="/try/:debateId" element={<Spar />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  const { theme } = useTheme();
  return (
    <div className="App">
      <BrowserRouter>
        <RouterInner />
      </BrowserRouter>
      {/* Toaster's own theme prop drives its internal light/dark styling —
          it doesn't read the .dark class on <html> — so it must be wired to
          the real live theme here, not left hardcoded (previous bug: toasts
          always rendered dark, even in light mode). */}
      <Toaster theme={theme} position="top-center" />
      {/* Cookieless page-view counts (Vercel Web Analytics). Does nothing
          until Analytics is enabled for the project in the Vercel dashboard. */}
      <Analytics />
    </div>
  );
}
