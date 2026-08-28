import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, requireOnboarded = false, requireVerified = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono-ui text-xs tracking-widest uppercase">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  if (requireOnboarded && !user.onboarded) return <Navigate to="/onboarding" replace />;
  if (requireVerified && !user.id_verified) return <Navigate to="/verify" replace />;
  return children;
}
