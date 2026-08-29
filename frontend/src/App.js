import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Onboarding from "@/pages/Onboarding";
import Verify from "@/pages/Verify";
import Match from "@/pages/Match";
import ChatRoom from "@/pages/ChatRoom";
import Watch from "@/pages/Watch";
import WatchRoom from "@/pages/WatchRoom";
import Profile from "@/pages/Profile";
import PrivateChat from "@/pages/PrivateChat";
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
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/verify" element={<ProtectedRoute requireOnboarded><Verify /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute requireOnboarded><Dashboard /></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute requireOnboarded requireVerified><Match /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute requireOnboarded requireVerified><ChatRoom /></ProtectedRoute>} />
      <Route path="/private/:friendId" element={<ProtectedRoute requireOnboarded><PrivateChat /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <RouterInner />
      </BrowserRouter>
    </div>
  );
}
