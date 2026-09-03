import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, ShieldCheck, Trash2, Search, FileText } from "lucide-react";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import BackButton from "@/components/BackButton";
import ConfirmModal from "@/components/ConfirmModal";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_WIDE } from "@/lib/layout";
import { RowSkeletonList } from "@/components/SkeletonCard";

function timeAgo(iso) {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function UsersManagement() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // {user_id, label} or null
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get("/admin/users", { params: q.trim() ? { q: q.trim() } : {} })
      .then(({ data }) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggleFlag = async (u) => {
    const next = !u.admin_flagged;
    let note = "";
    if (next) {
      note = window.prompt(`Note for flagging ${u.display_name || u.email} (optional):`) || "";
    }
    setBusyId(u.user_id);
    try {
      await api.post(`/admin/users/${u.user_id}/flag`, { flagged: next, note });
      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, admin_flagged: next, admin_flag_note: next ? note : null } : x)));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't update flag");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.user_id);
    try {
      await api.delete(`/admin/users/${deleteTarget.user_id}`);
      toast.success("Account deleted");
      setUsers((prev) => prev.filter((x) => x.user_id !== deleteTarget.user_id));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't delete account");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow mb-4">User management</div>
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-[var(--fg-subtle)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, name, or handle…"
          className="field !py-2 !pl-9 w-full !rounded-full"
          data-testid="admin-user-search"
        />
      </div>

      {loading && <RowSkeletonList />}
      {!loading && users.length === 0 && <p className="text-sm text-[var(--fg-subtle)]">No users found.</p>}

      {!loading && users.length > 0 && (
        <div className="overflow-x-auto">
          <div className="divide-y divide-[var(--border)] min-w-[720px]">
            {users.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between gap-3 py-3" data-testid={`admin-user-${u.user_id}`}>
                <button onClick={() => navigate(`/u/${u.user_id}`)} className="min-w-0 text-left hover:underline">
                  <div className="text-sm font-medium truncate inline-flex items-center gap-1.5">
                    {u.display_name || "—"}
                    {u.is_admin && <span className="chip-accent !py-0 !px-1.5 text-[10px]">Admin</span>}
                    {u.admin_flagged && <span className="chip !py-0 !px-1.5 text-[10px] !border-[var(--danger)] !text-[var(--danger)]">Flagged</span>}
                    {u.is_debater && <span className="chip !py-0 !px-1.5 text-[10px]">Debater</span>}
                    {u.id_verified && <span className="chip !py-0 !px-1.5 text-[10px]">Verified</span>}
                  </div>
                  <div className="text-xs text-[var(--fg-subtle)] truncate">
                    {u.email} · joined {timeAgo(u.created_at)} · {u.debates} debates
                    {u.admin_flag_note && <span className="text-[var(--danger)]"> · "{u.admin_flag_note}"</span>}
                  </div>
                </button>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleFlag(u)}
                    disabled={busyId === u.user_id || u.is_admin}
                    className={u.admin_flagged ? "btn-danger !px-2.5 !py-1 !text-xs" : "btn-outline !px-2.5 !py-1 !text-xs"}
                    title={u.admin_flagged ? "Unflag" : "Flag this account"}
                    data-testid={`btn-flag-${u.user_id}`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ user_id: u.user_id, label: u.display_name || u.email })}
                    disabled={busyId === u.user_id || u.is_admin}
                    className="btn-danger !px-2.5 !py-1 !text-xs"
                    title="Delete account"
                    data-testid={`btn-delete-${u.user_id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Permanently delete ${deleteTarget.label}?`}
          body="Removes the account, sessions, friendships, follows, subscriptions, and topic history — frees up the email to sign up fresh. Past debates and claims they were part of stay (other people's history), just showing a generic name. This can't be undone."
          confirmLabel="Delete account"
          busy={busyId === deleteTarget.user_id}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
          testIdPrefix="confirm-delete-user"
        />
      )}
    </div>
  );
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
            <div className="text-xs text-[var(--fg-subtle)] truncate">{u.email} · submitted {timeAgo(u.submitted_at)}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`${API}/verify/${u.user_id}/document`}
              target="_blank"
              rel="noreferrer"
              className="btn-outline !px-2.5 !py-1 !text-xs inline-flex items-center gap-1"
              data-testid={`btn-view-document-${u.user_id}`}
              title="Opens the submitted ID document in a new tab — the only place this document is ever viewable, no public link exists"
            >
              <FileText className="w-3 h-3" /> View ID
            </a>
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

const TABS = [
  { key: "users", label: "Users" },
  { key: "verify", label: "Verification" },
  { key: "reports", label: "Reports" },
];

export default function Admin() {
  const { user } = useAuth();
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState("users");

  useEffect(() => {
    api.get("/admin/users", { params: { limit: 1 } }).catch((e) => { if (e.response?.status === 403) setAccessDenied(true); });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className={STICKY_NAV}>
        <div className={`${CONTAINER_WIDE} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <BackButton to="/" label="Home" data-testid="nav-back-home" />
            <span className="font-heading text-lg font-semibold inline-flex items-center gap-1.5 truncate"><ShieldCheck className="w-4 h-4 shrink-0" /> Admin</span>
          </div>
          <ThemeToggle />
        </div>
        {!accessDenied && (
          <div className={`${CONTAINER_WIDE} mx-auto px-4 sm:px-6 pb-3 flex gap-1`}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={tab === t.key ? "chip-accent" : "chip"}
                data-testid={`admin-tab-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main className={`${CONTAINER_WIDE} mx-auto px-4 sm:px-6 py-8`}>
        {accessDenied ? (
          <div className="card p-10 text-center">
            <div className="font-heading text-lg font-semibold">Admin only</div>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Signed in as {user?.email} — this account isn't on the admin list.</p>
          </div>
        ) : (
          <>
            {tab === "users" && <UsersManagement />}
            {tab === "verify" && (
              <div className="card p-5 sm:p-6">
                <div className="eyebrow mb-4">ID verification queue</div>
                <VerificationQueue />
              </div>
            )}
            {tab === "reports" && (
              <div className="card p-5 sm:p-6">
                <div className="eyebrow mb-4 inline-flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Open reports</div>
                <ReportsQueue />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
