import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getSource } from "@/lib/referral";
import { useAuth } from "@/contexts/AuthContext";
import { startGoogleLogin } from "@/lib/auth";
import { saveGuestToken } from "@/lib/guest";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { CONTAINER_COMPACT } from "@/lib/layout";

const SITE_NAME = "indifferent";

/** Sets the tab title and meta description for pages search engines index
 * (Google renders the app's JavaScript, so these count). */
function usePageMeta(title, description) {
  useEffect(() => {
    if (!title) return undefined;
    const prevTitle = document.title;
    const tag = document.querySelector('meta[name="description"]');
    const prevDesc = tag?.getAttribute("content");
    document.title = title;
    if (tag && description) tag.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      if (tag && prevDesc) tag.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}

function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="border-b border-[var(--border)]">
      <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
        <Logo size="sm" onClick={() => navigate("/")} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!user && <button onClick={startGoogleLogin} className="btn-primary text-sm">Sign in</button>}
        </div>
      </div>
    </header>
  );
}

/** Starts a no-sign-up round on this motion. */
function useStartRound() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const start = async (motionId, side) => {
    setBusy(true);
    try {
      const { data } = await api.post("/spar/guest/start", { motion_id: motionId, side, source: getSource() });
      saveGuestToken(data.debate_id, data.guest_token);
      navigate(`/try/${data.debate_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't start. Try again in a bit.");
      setBusy(false);
    }
  };
  return { busy, start };
}

/** /motions: every curated motion, grouped by topic. */
export function MotionsIndex() {
  const [motions, setMotions] = useState(null);
  usePageMeta(
    `Debate topics: arguments for and against | ${SITE_NAME}`,
    "Popular debate topics with the strongest arguments for and against each. Pick a side and debate an AI that scores your arguments, free and with no sign-up.",
  );

  useEffect(() => {
    api.get("/public/motions").then(({ data }) => setMotions(data.motions)).catch(() => setMotions([]));
  }, []);

  const groups = (motions || []).reduce((acc, m) => {
    (acc[m.tag] = acc[m.tag] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 py-10`}>
        <div className="eyebrow">Debate topics</div>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold mt-2 leading-tight">Arguments for and against</h1>
        <p className="mt-3 text-[var(--fg-muted)] max-w-lg">
          The strongest case on both sides of today's big questions. Read them, pick a side, then test yourself against an AI that argues back.
        </p>
        {motions === null && <div className="mt-8 text-sm text-[var(--fg-subtle)]">Loading…</div>}
        <div className="mt-8 space-y-8" data-testid="motions-index">
          {Object.entries(groups).map(([tag, items]) => (
            <section key={tag}>
              <h2 className="eyebrow mb-3">{tag}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map((m) => (
                  <Link key={m.slug} to={`/motions/${m.slug}`} className="card p-4 hover:border-[var(--fg)] transition-colors">
                    <div className="font-medium">{m.motion}</div>
                    <p className="mt-1 text-sm text-[var(--fg-muted)] line-clamp-2">{m.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function ArgumentList({ title, points, testId }) {
  return (
    <div className="card p-5" data-testid={testId}>
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <ol className="mt-3 space-y-3 list-decimal pl-5 text-sm leading-relaxed text-[var(--fg-muted)]">
        {points.map((p) => <li key={p}><span className="text-[var(--fg)]">{p}</span></li>)}
      </ol>
    </div>
  );
}

/** /motions/:slug: one motion, both sides' best arguments, and a way in. */
export function MotionPage() {
  const { slug } = useParams();
  const [m, setM] = useState(null);
  const [missing, setMissing] = useState(false);
  const [others, setOthers] = useState([]);
  const { busy, start } = useStartRound();

  usePageMeta(
    m ? `${m.motion}: arguments for and against | ${SITE_NAME}` : null,
    m ? `${m.summary} Read the best arguments on both sides, then debate an AI that scores you. Free.` : null,
  );

  useEffect(() => {
    let alive = true;
    setM(null); setMissing(false);
    api.get(`/public/motions/${encodeURIComponent(slug)}`)
      .then(({ data }) => alive && setM(data))
      .catch(() => alive && setMissing(true));
    api.get("/public/motions").then(({ data }) => alive && setOthers(data.motions)).catch(() => {});
    window.scrollTo(0, 0);
    return () => { alive = false; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <main className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 py-10`}>
        <Link to="/motions" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">← All debate topics</Link>
        {missing && (
          <div className="mt-8">
            <h1 className="font-heading text-2xl font-semibold">That topic doesn't exist</h1>
            <p className="mt-2 text-[var(--fg-muted)]">It may have been renamed. Browse all topics instead.</p>
          </div>
        )}
        {!m && !missing && <div className="mt-8 text-sm text-[var(--fg-subtle)]">Loading…</div>}
        {m && (
          <article className="mt-6">
            <div className="eyebrow">Debate topic · {m.tag}</div>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold mt-2 leading-tight">{m.motion}</h1>
            <p className="mt-4 text-[var(--fg-muted)] max-w-2xl leading-relaxed">{m.summary}</p>

            <div className="mt-8 grid sm:grid-cols-2 gap-3">
              <ArgumentList title="Arguments for" points={m.for} testId="args-for" />
              <ArgumentList title="Arguments against" points={m.against} testId="args-against" />
            </div>

            <div className="mt-8 card-muted p-5 sm:p-6">
              <h2 className="font-heading text-xl font-semibold">Think you can win this one?</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Pick a side. An AI argues the other, then scores your clarity, evidence, rebuttal and civility. Free, no sign-up.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => start(m.id, "for")} disabled={busy} className="btn-accent" data-testid="motion-agree">I agree</button>
                <button onClick={() => start(m.id, "against")} disabled={busy} className="btn-outline" data-testid="motion-disagree">I disagree</button>
              </div>
            </div>
          </article>
        )}

        {others.length > 1 && (
          <section className="mt-12">
            <h2 className="eyebrow mb-3">More debate topics</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {others.filter((o) => o.slug !== slug && o.id !== slug).slice(0, 6).map((o) => (
                <Link key={o.slug} to={`/motions/${o.slug}`} className="text-sm py-2 border-b border-[var(--border)] hover:text-[var(--fg)] text-[var(--fg-muted)]">
                  {o.motion}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
