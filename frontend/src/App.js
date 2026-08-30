import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import "@/App.css";
import AuthCallback from "@/pages/AuthCallback";
import Friends from "@/pages/Friends";
import Onboarding from "@/pages/Onboarding";
import Verify from "@/pages/Verify";
import Match from "@/pages/Match";
import ChatRoom from "@/pages/ChatRoom";
import Watch from "@/pages/Watch";
import WatchRoom from "@/pages/WatchRoom";
import Profile from "@/pages/Profile";
import PrivateChat from "@/pages/PrivateChat";
import Claims from "@/pages/Claims";
import ClaimTree from "@/pages/ClaimTree";
import Settings from "@/pages/Settings";
import ProtectedRoute from "@/components/ProtectedRoute";

function RouterInner() {
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
      <Route path="/match" element={<ProtectedRoute requireOnboarded requireVerified><Match /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute requireOnboarded requireVerified><ChatRoom /></ProtectedRoute>} />
      <Route path="/private/:friendId" element={<ProtectedRoute requireOnboarded><PrivateChat /></ProtectedRoute>} />
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
    </div>
  );
}
