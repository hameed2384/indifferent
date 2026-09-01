import { useEffect, useState } from "react";
import { Check, Copy, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NotificationBell from "@/components/NotificationBell";
import BackButton from "@/components/BackButton";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_NARROW } from "@/lib/layout";
import { DEBATER_SUB_PRICE, MEMBERSHIP_PRICE } from "@/lib/pricing";

function Section({ title, children }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="eyebrow mb-4">{title}</div>
      {children}
    </div>
  );
}

function InviteSection({ user }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?ref=${encodeURIComponent(user.handle || user.user_id)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy the link manually");
    }
  };

  return (
    <Section title="Invite friends">
      <p className="text-sm text-[var(--fg-muted)] mb-3">
        Share your link — anyone who signs up through it counts toward your referrals.
        {user.referral_count > 0 && <span className="font-medium text-[var(--fg)]"> {user.referral_count} so far.</span>}
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="field !py-2 text-sm flex-1 min-w-0" data-testid="referral-link-input" />
        <button onClick={copy} className="btn-outline text-sm shrink-0 inline-flex items-center gap-1.5" data-testid="btn-copy-referral-link">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Section>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [allowFriendRequests, setAllowFriendRequests] = useState(user?.allow_friend_requests ?? true);
  const [becoming, setBecoming] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name || user.name || "");
    setHandle(user.handle || "");
    setBio(user.bio || "");
    setAllowFriendRequests(user.allow_friend_requests ?? true);
  }, [user]);

  if (!user) return null;

  const saveProfile = async () => {
    if (!displayName.trim()) { toast.error("Display name can't be empty"); return; }
    setSavingProfile(true);
    try {
      const payload = { display_name: displayName.trim(), bio };
      // Only sent when actually changed — an unset handle stays unset
      // rather than round-tripping "" through validation on every save.
      if (handle.trim() !== (user.handle || "")) payload.handle = handle.trim();
      const { data } = await api.post("/users/me/profile", payload);
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

  const becomeMember = async () => {
    try {
      const { data } = await api.post("/payments/checkout/membership");
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e.response?.status === 503 ? "Membership isn't live yet" : "Couldn't start checkout");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className={STICKY_NAV}>
        <div className={`${CONTAINER_NARROW} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <BackButton to="/" label="Home" data-testid="nav-back-home" />
            <span className="font-heading text-lg font-semibold">Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
      </nav>

      <main className={`${CONTAINER_NARROW} mx-auto px-4 sm:px-6 py-8 space-y-6`}>
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
          <label className="block mb-3">
            <span className="text-xs font-medium text-[var(--fg-muted)] mb-1 block">Handle</span>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] text-sm pointer-events-none">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                maxLength={20}
                placeholder="yourhandle"
                className="field !pl-7"
                data-testid="settings-handle"
              />
            </div>
            <div className="text-xs text-[var(--fg-subtle)] mt-1">Unique — how people find you in search. Letters, numbers, underscores, periods.</div>
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
              className="checkbox"
              data-testid="settings-allow-friend-requests"
            />
          </label>
        </Section>

        <Section title="Debater status">
          {user.is_debater ? (
            <p className="text-sm text-[var(--accent)] font-medium">You're a debater — go live any time from Watch.</p>
          ) : (
            <>
              <p className="text-sm text-[var(--fg-muted)] mb-3">Debaters can go live on demand and accept {DEBATER_SUB_PRICE} subscribers.</p>
              <button onClick={becomeDebater} disabled={becoming} className="btn-outline text-sm" data-testid="settings-become-debater">
                {becoming ? "…" : "Become a debater"}
              </button>
            </>
          )}
        </Section>

        <Section title="Membership">
          {user.ad_free ? (
            <p className="text-sm text-[var(--accent)] font-medium">You're a member — no ads anywhere ✓</p>
          ) : (
            <>
              <p className="text-sm text-[var(--fg-muted)] mb-3">Members get no ads anywhere on the site, {MEMBERSHIP_PRICE}. This is separate from subscribing to a specific debater (from their profile) — membership is about your own experience of the whole platform, not supporting any one person.</p>
              <button onClick={becomeMember} className="btn-outline text-sm" data-testid="settings-become-member">Become a member — {MEMBERSHIP_PRICE}</button>
            </>
          )}
        </Section>

        <InviteSection user={user} />

        <Section title="Account">
          <button onClick={logout} className="btn-danger text-sm" data-testid="settings-sign-out">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </Section>
      </main>
    </div>
  );
}
