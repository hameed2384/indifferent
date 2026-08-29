import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = () => {
    api.get(`/users/${userId}`)
      .then(({ data }) => setProfile(data))
      .catch(() => setNotFound(true));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggleFollow = async () => {
    if (!viewer) { toast.info("Sign in to follow"); return; }
    try {
      if (profile.is_following) await api.delete(`/users/${userId}/follow`);
      else await api.post(`/users/${userId}/follow`);
      load();
    } catch { toast.error("Couldn't update follow"); }
  };

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">
      Profile not found.
    </div>
  );
  if (!profile) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm" data-testid="nav-back">← Back</button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-5">
          {profile.picture
            ? <img src={profile.picture} alt="" className="w-20 h-20 rounded-full object-cover border border-[var(--border)]" />
            : <div className="w-20 h-20 rounded-full bg-[var(--bg-muted)] border border-[var(--border)]" />}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold truncate">{profile.display_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {profile.is_debater && <span className="chip-accent">Debater</span>}
              {profile.id_verified && <span className="chip">Verified</span>}
            </div>
          </div>
        </div>

        {profile.bio && <p className="mt-5 text-[var(--fg-muted)] max-w-xl">{profile.bio}</p>}

        <div className="mt-6 flex items-center gap-6 text-sm">
          <div><span className="font-semibold">{profile.followers_count}</span> <span className="text-[var(--fg-subtle)]">followers</span></div>
          <div><span className="font-semibold">{profile.following_count}</span> <span className="text-[var(--fg-subtle)]">following</span></div>
        </div>

        {!profile.is_self && (
          <button
            onClick={toggleFollow}
            className={profile.is_following ? "btn-outline mt-6" : "btn-accent mt-6"}
            data-testid="btn-profile-follow"
          >
            {profile.is_following ? "Following" : "Follow"}
          </button>
        )}

        <div className="mt-12 card p-6">
          <div className="eyebrow mb-2">Topic spectrums</div>
          <p className="text-sm text-[var(--fg-muted)]">Coming soon — where this person stands, per topic, based on their debates.</p>
        </div>
      </main>
    </div>
  );
}
