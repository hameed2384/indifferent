import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

const STATUSES = ["Scanning queue", "Analyzing stances", "Plotting opposition", "Matching adversary", "Preparing topics"];

export default function Match() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle");
  const [tick, setTick] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => (t + 1) % STATUSES.length), 1600);
    return () => clearInterval(iv);
  }, []);

  const start = async () => {
    setStatus("searching");
    try {
      const { data } = await api.post("/match/enqueue");
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
      toast.error(e.response?.data?.detail || "Failed to enter queue");
      setStatus("idle");
    }
  };

  const cancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    try { await api.post("/match/cancel"); } catch { /* noop */ }
    navigate("/dashboard");
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { if (status === "idle") start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="font-heading text-lg font-semibold">indifferent</div>
          <div className="flex items-center gap-2">
            <button onClick={cancel} className="btn-ghost text-sm" data-testid="btn-cancel-match">Cancel</button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-xl w-full text-center">
          <div className="chip-accent mx-auto mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span data-testid="match-status-label">{STATUSES[tick]}…</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight" data-testid="match-headline">
            Finding your opposite.
          </h1>
          <p className="mt-4 text-[var(--fg-muted)]">
            Average wait is under 60 seconds when the queue has partners. Feel free to grab water.
          </p>
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
        </div>
      </main>
    </div>
  );
}
