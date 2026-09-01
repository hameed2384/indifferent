import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import BackButton from "@/components/BackButton";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_MEDIUM } from "@/lib/layout";

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function VerificationQueue() {
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    api.get("/verify/pending").then(({ data }) => setPending(data.pending || [])).catch(() => {});
  };
  useEffect(load, []);

  const decide = async (userId, approve) => {
    setBusyId(userId);
    try {
      await api.post(`/verify/${userId}/decide`, { approve });
      toast.success(approve ? "Approved" : "Rejected");
      setPending((p) => p.filter((u) => u.user_id !== userId));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't record decision");
    } finally {
      setBusyId(null);
    }
  };

  if (pending.length === 0) return <p className="text-sm text-[var(--fg-subtle)]">No pending verifications.</p>;

  return (
    <div className="divide-y divide-[var(--border)]">
      {pending.map((u) => (
        <div key={u.user_id} className="flex items-center justify-between gap-3 py-3" data-testid={`verify-pending-${u.user_id}`}>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{u.display_name || u.name}</div>
            <div className="text-xs text-[var(--fg-subtle)] truncate">{u.email} · submitted {u.submitted_at ? timeAgo(u.submitted_at) : "—"}</div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => decide(u.user_id, true)} disabled={busyId === u.user_id} className="btn-accent !px-2.5 !py-1 !text-xs" data-testid={`btn-approve-${u.user_id}`}>Approve</button>
            <button onClick={() => decide(u.user_id, false)} disabled={busyId === u.user_id} className="btn-danger !px-2.5 !py-1 !text-xs" data-testid={`btn-reject-${u.user_id}`}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const TARGET_HREF = { clip: "/claims/", user: "/u/", room: "/watch/" };

function ReportsQueue() {
  const [reports, setReports] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    api.get("/reports", { params: { status: "open" } }).then(({ data }) => setReports(data.reports || [])).catch(() => {});
  };
  useEffect(load, []);

  const resolve = async (reportId) => {
    setBusyId(reportId);
    try {
      await api.post(`/reports/${reportId}/resolve`);
      setReports((r) => r.filter((x) => x.report_id !== reportId));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't resolve report");
    } finally {
      setBusyId(null);
    }
  };

  if (reports.length === 0) return <p className="text-sm text-[var(--fg-subtle)]">No open reports.</p>;

  return (
    <div className="divide-y divide-[var(--border)]">
      {reports.map((r) => {
        const href = TARGET_HREF[r.target_type];
        return (
          <div key={r.report_id} className="py-3" data-testid={`report-${r.report_id}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  <span className="chip !py-0 !px-1.5 text-[10px] mr-1.5">{r.target_type}</span>
                  {r.reason.replace(/_/g, " ")}
                </div>
                <div className="text-xs text-[var(--fg-subtle)] mt-0.5">
                  Reported by {r.reporter_name} · {timeAgo(r.created_at)}
                  {href && (
                    <> · <button onClick={() => navigate(`${href}${r.target_id}`)} className="underline hover:text-[var(--fg)]">View target</button></>
                  )}
                </div>
                {r.details && <p className="text-xs text-[var(--fg-muted)] mt-1">"{r.details}"</p>}
              </div>
              <button onClick={() => resolve(r.report_id)} disabled={busyId === r.report_id} className="btn-outline !px-2.5 !py-1 !text-xs shrink-0" data-testid={`btn-resolve-${r.report_id}`}>
                Resolve
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    api.get("/verify/pending").catch((e) => { if (e.response?.status === 403) setAccessDenied(true); });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className={STICKY_NAV}>
        <div className={`${CONTAINER_MEDIUM} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <BackButton to="/" label="Home" data-testid="nav-back-home" />
            <span className="font-heading text-lg font-semibold inline-flex items-center gap-1.5 truncate"><ShieldCheck className="w-4 h-4 shrink-0" /> Admin</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className={`${CONTAINER_MEDIUM} mx-auto px-4 sm:px-6 py-8 space-y-6`}>
        {accessDenied ? (
          <div className="card p-10 text-center">
            <div className="font-heading text-lg font-semibold">Admin only</div>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Signed in as {user?.email} — this account isn't on the admin list.</p>
          </div>
        ) : (
          <>
            <div className="card p-5 sm:p-6">
              <div className="eyebrow mb-4">ID verification queue</div>
              <VerificationQueue />
            </div>
            <div className="card p-5 sm:p-6">
              <div className="eyebrow mb-4 inline-flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Open reports</div>
              <ReportsQueue />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
