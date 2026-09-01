import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import AdSlot from "@/components/AdSlot";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { CONTAINER_COMPACT } from "@/lib/layout";

const STATUSES = ["Scanning queue", "Analyzing stances", "Plotting opposition", "Matching adversary", "Preparing topics"];

export default function Match() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const pollRef = useRef(null);
  const friendId = location.state?.friendId || null;
  const friendName = location.state?.friendName || "your friend";

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => (t + 1) % STATUSES.length), 1600);
    return () => clearInterval(iv);
  }, []);

  const start = async () => {
    setStatus("searching");
    setError(null);
    try {
      const { data } = friendId
        ? await api.post("/match/enqueue-party", { friend_id: friendId })
        : await api.post("/match/enqueue");
      if (data.matched) { navigate(`/room/${data.room_id}`); return; }
      pollRef.current = setInterval(async () => {
        try {
          const { data: p } = await api.get("/match/poll");
          if (p.matched) {
            clearInterval(pollRef.current);
            navigate(`/room/${p.room_id}`);
          }
        } catch { /* keep polling */ }
      }, 2500);
    } catch (e) {
      const message = e.response?.data?.detail || "Failed to enter queue";
      toast.error(message);
      // Previously left the user staring at the animated "Finding your
      // opposite" screen forever on any failure — status went back to
      // "idle" but nothing ever called start() again (the only caller is a
      // mount-only effect). Surface a real error state with a retry
      // instead of a silent dead end.
      setError(message);
      setStatus("idle");
    }
  };

  const cancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    try { await api.post("/match/cancel"); } catch { /* noop */ }
    navigate("/");
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { if (status === "idle") start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <button onClick={cancel} className="btn-ghost text-sm" data-testid="btn-cancel-match">Cancel</button>
            <ThemeToggle />
            <NotificationBell />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-20">
        <div className="max-w-xl w-full text-center">
          {error ? (
            <div className="chip mx-auto mb-6 !border-[var(--danger)] !text-[var(--danger)]">Couldn't enter the queue</div>
          ) : (
            <div className="chip-accent mx-auto mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span data-testid="match-status-label">{STATUSES[tick]}…</span>
            </div>
          )}
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight" data-testid="match-headline">
            {error ? <>Something went wrong.</> : friendId ? <>Finding your party's opposite.</> : <>Finding your opposite.</>}
          </h1>
          <p className="mt-4 text-[var(--fg-muted)]">
            {error || (friendId
              ? <>Queued together with {friendName} — matched against another pair, or a single opponent if that's what's waiting.</>
              : <>Average wait is under 60 seconds when the queue has partners. Feel free to grab water.</>)}
          </p>
          {error && (
            <button onClick={start} className="btn-accent mt-4" data-testid="btn-retry-match">Try again</button>
          )}
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="card p-4 text-left">
              <div className="eyebrow">Protocol</div>
              <div className="text-sm mt-1">Peer-to-peer video</div>
            </div>
            <div className="card p-4 text-left">
              <div className="eyebrow">Guarantee</div>
              <div className="text-sm mt-1">Verified human · opposing stance</div>
            </div>
          </div>
          <div className="mt-6">
            <AdSlot variant="banner" />
          </div>
        </div>
      </main>
    </div>
  );
}
