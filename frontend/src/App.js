import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Onboarding from "@/pages/Onboarding";
import Verify from "@/pages/Verify";
import Match from "@/pages/Match";
import ChatRoom from "@/pages/ChatRoom";
import Watch from "@/pages/Watch";
import WatchRoom from "@/pages/WatchRoom";
import Profile from "@/pages/Profile";
import ProtectedRoute from "@/components/ProtectedRoute";

function RouterInner() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/watch" element={<Watch />} />
      <Route path="/watch/:roomId" element={<WatchRoom />} />
      <Route path="/u/:userId" element={<Profile />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/verify" element={<ProtectedRoute requireOnboarded><Verify /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute requireOnboarded><Dashboard /></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute requireOnboarded requireVerified><Match /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute requireOnboarded requireVerified><ChatRoom /></ProtectedRoute>} />
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
