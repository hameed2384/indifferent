import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "sonner";

function Section({ title, children }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow mb-4">{title}</div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [allowFriendRequests, setAllowFriendRequests] = useState(user?.allow_friend_requests ?? true);
  const [becoming, setBecoming] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name || user.name || "");
    setBio(user.bio || "");
    setAllowFriendRequests(user.allow_friend_requests ?? true);
  }, [user]);

  if (!user) return null;

  const saveProfile = async () => {
    if (!displayName.trim()) { toast.error("Display name can't be empty"); return; }
    setSavingProfile(true);
    try {
      const { data } = await api.post("/users/me/profile", { display_name: displayName.trim(), bio });
      setUser(data);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't save your profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleFriendRequests = async () => {
    const next = !allowFriendRequests;
    setAllowFriendRequests(next);
    try {
      await api.post("/users/me/friend-privacy", null, { params: { allow: next } });
      setUser((u) => ({ ...u, allow_friend_requests: next }));
    } catch {
      setAllowFriendRequests(!next);
      toast.error("Couldn't update setting");
    }
  };

  const becomeDebater = async () => {
    setBecoming(true);
    try {
      await api.post("/users/me/become-debater");
      setUser((u) => ({ ...u, is_debater: true }));
      toast.success("You're a debater now — go live any time from Watch.");
    } catch {
      toast.error("Couldn't update your account");
    } finally {
      setBecoming(false);
    }
  };

  const upgradeAdFree = async () => {
    try {
      const { data } = await api.post("/payments/checkout/platform");
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e.response?.status === 503 ? "Ad-free isn't live yet" : "Couldn't start checkout");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="btn-ghost text-sm" data-testid="nav-back-home">← Home</button>
          <span className="font-heading text-lg font-semibold">Settings</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Section title="Profile">
          <div className="flex items-center gap-3 mb-5">
            {user.picture
              ? <img src={user.picture} alt="" className="w-12 h-12 rounded-full object-cover" />
              : <span className="w-12 h-12 rounded-full bg-[var(--bg-muted)] flex items-center justify-center font-medium">{(displayName || "?")[0]?.toUpperCase()}</span>}
            <div className="min-w-0">
              <div className="text-sm text-[var(--fg-muted)] truncate">{user.email}</div>
              <div className="text-xs text-[var(--fg-subtle)]">{user.id_verified ? "ID verified ✓" : "Not ID verified"}</div>
            </div>
          </div>
          <label className="block mb-3">
            <span className="text-xs font-medium text-[var(--fg-muted)] mb-1 block">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="field"
              data-testid="settings-display-name"
            />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-medium text-[var(--fg-muted)] mb-1 block">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Say something about your positions…"
              className="textarea"
              data-testid="settings-bio"
            />
          </label>
          <button onClick={saveProfile} disabled={savingProfile} className="btn-accent text-sm" data-testid="btn-save-profile">
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </Section>

        <Section title="Appearance">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Theme</div>
              <div className="text-xs text-[var(--fg-subtle)]">Applies everywhere, remembered on this device.</div>
            </div>
            <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">
              <button
                onClick={() => theme !== "light" && toggleTheme()}
                className={`px-3 py-1.5 text-xs font-medium ${theme === "light" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
                data-testid="settings-theme-light"
              >
                Light
              </button>
              <button
                onClick={() => theme !== "dark" && toggleTheme()}
                className={`px-3 py-1.5 text-xs font-medium border-l border-[var(--border-strong)] ${theme === "dark" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"}`}
                data-testid="settings-theme-dark"
              >
                Dark
              </button>
            </div>
          </div>
        </Section>

        <Section title="Privacy">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium">Allow friend requests</div>
              <div className="text-xs text-[var(--fg-subtle)]">Turn off to stop new friend requests from arriving.</div>
            </div>
            <input
              type="checkbox"
              checked={allowFriendRequests}
              onChange={toggleFriendRequests}
              className="w-4 h-4 accent-[var(--accent)]"
              data-testid="settings-allow-friend-requests"
            />
          </label>
        </Section>

        <Section title="Debater status">
          {user.is_debater ? (
            <p className="text-sm text-[var(--accent)] font-medium">You're a debater — go live any time from Watch.</p>
          ) : (
            <>
              <p className="text-sm text-[var(--fg-muted)] mb-3">Debaters can go live on demand and accept £2/mo subscribers.</p>
              <button onClick={becomeDebater} disabled={becoming} className="btn-outline text-sm" data-testid="settings-become-debater">
                {becoming ? "…" : "Become a debater"}
              </button>
            </>
          )}
        </Section>

        <Section title="Subscription">
          {user.ad_free ? (
            <p className="text-sm text-[var(--accent)] font-medium">You're ad-free ✓</p>
          ) : (
            <>
              <p className="text-sm text-[var(--fg-muted)] mb-3">Remove ads everywhere on the site for £9/mo.</p>
              <button onClick={upgradeAdFree} className="btn-outline text-sm" data-testid="settings-upgrade-ad-free">Upgrade — £9/mo</button>
            </>
          )}
        </Section>

        <Section title="Account">
          <button onClick={logout} className="btn-outline text-sm text-[var(--danger)]" data-testid="settings-sign-out">Sign out</button>
        </Section>
      </main>
    </div>
  );
}
