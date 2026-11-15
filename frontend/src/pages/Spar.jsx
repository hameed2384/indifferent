import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import Logo from "@/components/Logo";
import { CONTAINER_COMPACT } from "@/lib/layout";
import { startGoogleLogin } from "@/lib/auth";
import { claimGuestRounds, getGuestToken, guestHeaders, saveGuestToken } from "@/lib/guest";

const SCORE_LABELS = { clarity: "Clarity", evidence: "Evidence", rebuttal: "Rebuttal", civility: "Civility" };

/** Start a new AI sparring debate and go to it. Shared by Match (no human
 * online), Watch's call-to-action and this page's "Spar again". */
export async function startSpar(navigate, tag) {
  const { data } = await api.post("/spar/start", tag ? { tag } : {});
  navigate(`/spar/${data.debate_id}`, { state: { debate: data } });
}

function Feedback({ feedback }) {
  if (!feedback) {
    return <p className="text-sm text-[var(--fg-muted)]">No feedback this time — make at least one argument next round and you'll get a full report.</p>;
  }
  const scores = feedback.scores;
  const avg = scores ? Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 4) * 10) / 10 : null;
  return (
    <div className="space-y-5" data-testid="spar-feedback">
      {scores && (
        <div>
          <div className="flex items-baseline justify-between">
            <div className="eyebrow">Your scores</div>
            <div className="text-sm"><span className="font-heading text-2xl font-semibold">{avg}</span><span className="text-[var(--fg-subtle)]"> / 10</span></div>
          </div>
          <div className="mt-3 space-y-2">
            {Object.entries(SCORE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-[var(--fg-muted)]">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${scores[key] * 10}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums">{scores[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {feedback.summary && <p className="text-sm">{feedback.summary}</p>}
      {feedback.best_line && (
        <blockquote className="border-l-2 border-[var(--accent)] pl-3 text-sm italic">
          "{feedback.best_line}"
          <div className="not-italic text-xs text-[var(--fg-subtle)] mt-1">Your strongest line</div>
        </blockquote>
      )}
      {[["What worked", feedback.strengths], ["Sharpen next time", feedback.improvements], ["Logical slips", feedback.fallacies]].map(([title, items]) =>
        items?.length ? (
          <div key={title}>
            <div className="eyebrow">{title}</div>
            <ul className="mt-2 space-y-1.5 text-sm list-disc pl-5">
              {items.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

export default function Spar() {
  const { debateId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [debate, setDebate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const endRef = useRef(null);

  // Guests (no account) reach their round with the token this browser saved
  // when it started; signed-in users use their session as usual.
  const guest = !user;
  const opts = () => (guest ? { headers: guestHeaders(debateId) } : undefined);

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    (async () => {
      // Signed in now but this round was started as a guest: move it into
      // the account first, or the session wouldn't be allowed to see it.
      if (user && getGuestToken(debateId)) await claimGuestRounds();
      const { data } = await api.get(`/spar/${debateId}`, user ? undefined : { headers: guestHeaders(debateId) });
      if (alive) { setDebate(data); setMessages(data.messages || []); }
    })().catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [debateId, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, thinking]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const turnsLeft = debate ? Math.max(0, debate.max_user_turns - userTurns) : 0;
  const active = debate?.status === "active";

  const send = async () => {
    const body = text.trim();
    if (!body || thinking || !active || turnsLeft === 0) return;
    setText("");
    setThinking(true);
    setMessages((m) => [...m, { role: "user", text: body, created_at: new Date().toISOString(), pending: true }]);
    try {
      const { data } = await api.post(`/spar/${debateId}/message`, { text: body }, opts());
      setMessages((m) => [...m.filter((x) => !x.pending), ...data.messages]);
    } catch (e) {
      setMessages((m) => m.filter((x) => !x.pending));
      setText(body);
      toast.error(e.response?.data?.detail || "Couldn't send — try again");
    } finally {
      setThinking(false);
    }
  };

  const end = async () => {
    setEnding(true);
    try {
      const { data } = await api.post(`/spar/${debateId}/end`, null, opts());
      setDebate((d) => ({ ...d, ...data }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't end the debate");
    } finally {
      setEnding(false);
    }
  };

  const share = async () => {
    try {
      const { data } = await api.post(`/spar/${debateId}/share`);
      const url = `${window.location.origin}/s/${data.share_id}`;
      const avg = debate.feedback?.scores ? Math.round((Object.values(debate.feedback.scores).reduce((a, b) => a + b, 0) / 4) * 10) / 10 : null;
      const text = avg ? `I scored ${avg}/10 arguing my side on "${debate.topic}". Think you can do better?` : `I just argued my side on "${debate.topic}".`;
      if (navigator.share) {
        await navigator.share({ title: "My debate score on indifferent", text, url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied — paste it anywhere");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't create a share link");
    }
  };

  const again = async () => {
    setStarting(true);
    // A round claimed from guest mode may be on a motion outside the user's own topics.
    const tag = user?.interest_tags?.includes(debate?.tag) ? debate.tag : undefined;
    try { await startSpar(navigate, tag); } catch (e) { toast.error(e.response?.data?.detail || "Couldn't start a new round"); }
    finally { setStarting(false); }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] gap-3 px-4 text-center">
        <p className="text-sm text-[var(--fg-muted)]">Couldn't load this debate.</p>
        <button onClick={() => navigate("/")} className="btn-outline text-sm">Back home</button>
      </div>
    );
  }
  if (!debate) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-subtle)]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user
              ? <AccountMenu user={user} logout={logout} />
              : <button onClick={startGoogleLogin} className="btn-primary text-sm">Sign in</button>}
          </div>
        </div>
      </header>

      <main className={`${CONTAINER_COMPACT} w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-4`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="chip-accent">AI sparring</span>
            <span className="chip">{debate.tag}</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold mt-3 leading-tight" data-testid="spar-topic">{debate.topic}</h1>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="card p-3">
              <div className="eyebrow">Your view</div>
              <div className="mt-1">{debate.user_view || <span className="capitalize">{debate.user_side}</span>}</div>
            </div>
            <div className="card p-3">
              <div className="eyebrow">Sparring partner</div>
              <div className="mt-1">Argues against your view</div>
            </div>
          </div>
        </div>

        {!active && (
          <div className="card p-5">
            <h2 className="font-heading text-xl font-semibold mb-4">Debate report</h2>
            <Feedback feedback={debate.feedback} />
            {guest ? (
              <div className="mt-6">
                <p className="text-sm text-[var(--fg-muted)]">
                  Sign in to save this report, track your progress, spar on your own views, and debate real people who disagree with you.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={startGoogleLogin} className="btn-accent" data-testid="btn-guest-signin">Sign in to save it</button>
                  <button onClick={() => navigate("/try")} className="btn-outline">Try another motion</button>
                </div>
              </div>
            ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={again} disabled={starting} className="btn-accent" data-testid="btn-spar-again">{starting ? "Starting…" : "Spar again"}</button>
              <button onClick={() => navigate(user?.id_verified ? "/match" : "/verify")} className="btn-outline">Debate a real person</button>
              {debate.feedback?.scores && (
                <button onClick={share} className="btn-outline" data-testid="btn-spar-share">Share my result</button>
              )}
              <button onClick={() => navigate("/spar")} className="btn-ghost">Your progress</button>
            </div>
            )}
          </div>
        )}

        <div className="card overflow-hidden flex flex-col flex-1 min-h-[50vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="spar-messages">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${m.role === "user" ? "ml-auto bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bg-muted)] border border-[var(--border)]"} ${m.pending ? "opacity-70" : ""}`}
              >
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            ))}
            {thinking && <div className="text-xs text-[var(--fg-subtle)]">Your opponent is thinking…</div>}
            <div ref={endRef} />
          </div>
          {active && (
            <div className="shrink-0 p-3 border-t border-[var(--border)] space-y-2">
              <div className="flex gap-2">
                <textarea
                  data-testid="spar-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={turnsLeft ? "Make your case…" : "No turns left — end the debate for your report"}
                  disabled={!turnsLeft}
                  maxLength={800}
                  rows={2}
                  className="field resize-none"
                />
                <button onClick={send} disabled={thinking || !text.trim() || !turnsLeft} className="btn-primary px-4 text-sm self-end" data-testid="btn-spar-send">Send</button>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--fg-subtle)]">
                <span>{turnsLeft} turn{turnsLeft === 1 ? "" : "s"} left</span>
                <button onClick={end} disabled={ending || thinking} className="btn-ghost text-xs" data-testid="btn-spar-end">
                  {ending ? "Scoring…" : userTurns ? "End & get feedback" : "End"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function avgScore(feedback) {
  const s = feedback?.scores;
  return s ? Math.round((Object.values(s).reduce((a, b) => a + b, 0) / 4) * 10) / 10 : null;
}

/** /spar — past sparring rounds with their scores, newest first, plus a
 * start button. The running average is the user's progress signal. */
export function SparHistory() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [debates, setDebates] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get("/spar").then(({ data }) => setDebates(data.debates)).catch(() => setDebates([]));
  }, []);

  const start = async () => {
    setStarting(true);
    try { await startSpar(navigate); } catch (e) { toast.error(e.response?.data?.detail || "Couldn't start a round"); setStarting(false); }
  };

  const scored = (debates || []).map((d) => avgScore(d.feedback)).filter((x) => x !== null);
  const recent = scored.slice(0, 3);
  const earlier = scored.slice(3, 6);
  const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const trend = recent.length && earlier.length ? Math.round((mean(recent) - mean(earlier)) * 10) / 10 : null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)]">
        <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu user={user} logout={logout} />
          </div>
        </div>
      </header>
      <main className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 py-8`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow">AI sparring</div>
            <h1 className="font-heading text-3xl font-semibold mt-1">Sharpen your arguments.</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-lg">An AI takes the opposite side of one of your views. Argue for up to 12 turns, then get scored on clarity, evidence, rebuttal and civility.</p>
          </div>
          <button onClick={start} disabled={starting} className="btn-accent" data-testid="btn-history-spar">{starting ? "Setting up…" : "New round"}</button>
        </div>

        {scored.length > 0 && (
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="card p-4"><div className="eyebrow">Rounds</div><div className="font-heading text-2xl font-semibold mt-1">{debates.length}</div></div>
            <div className="card p-4"><div className="eyebrow">Avg score</div><div className="font-heading text-2xl font-semibold mt-1">{mean(scored)}</div></div>
            <div className="card p-4">
              <div className="eyebrow">Trend</div>
              <div className="font-heading text-2xl font-semibold mt-1">{trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}`}</div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-3" data-testid="spar-history">
          {debates === null && <div className="text-sm text-[var(--fg-subtle)]">Loading…</div>}
          {debates?.length === 0 && <div className="card p-6 text-sm text-[var(--fg-muted)]">No rounds yet. Your first one takes about five minutes.</div>}
          {debates?.map((d) => (
            <button key={d.debate_id} onClick={() => navigate(`/spar/${d.debate_id}`)} className="w-full card p-4 text-left hover:border-[var(--fg)] transition-colors flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
                  <span className="chip !py-0 !px-1.5 text-[10px]">{d.tag}</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  {d.status === "active" && <span className="chip-accent !py-0 !px-1.5 text-[10px]">In progress</span>}
                </div>
                <div className="text-sm font-medium mt-1 truncate">{d.topic}</div>
              </div>
              <div className="font-heading text-xl font-semibold shrink-0">{avgScore(d.feedback) ?? "—"}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

/** /s/:shareId — public result card for a shared sparring round. Shows the
 * score, summary and best line (never the transcript) and invites the
 * visitor to try it themselves. */
export function SparShare() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [card, setCard] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/public/spar/${shareId}`).then(({ data }) => setCard(data)).catch(() => setMissing(true));
  }, [shareId]);

  const tryIt = () => {
    if (!user) { startGoogleLogin(); return; }
    navigate(user.onboarded ? "/spar" : "/onboarding");
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <button onClick={() => navigate("/")}><Logo size="sm" /></button>
          <ThemeToggle />
        </div>
      </header>
      <main className={`${CONTAINER_COMPACT} w-full mx-auto px-4 sm:px-6 py-10 flex-1`}>
        {missing && <p className="text-sm text-[var(--fg-muted)]">This result isn't available.</p>}
        {!card && !missing && <p className="text-sm text-[var(--fg-subtle)]">Loading…</p>}
        {card && (
          <>
            <div className="card p-6 sm:p-8" data-testid="spar-share-card">
              <div className="flex items-center gap-2"><span className="chip-accent">AI sparring</span><span className="chip">{card.tag}</span></div>
              <p className="mt-4 text-sm text-[var(--fg-muted)]">{card.display_name} argued their side on</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-semibold mt-1 leading-tight">{card.topic}</h1>
              {card.average !== null && (
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-heading text-5xl font-semibold">{card.average}</span>
                  <span className="text-[var(--fg-subtle)]">/ 10</span>
                </div>
              )}
              {card.scores && (
                <div className="mt-4 space-y-2">
                  {Object.entries(SCORE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 text-[var(--fg-muted)]">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden"><div className="h-full bg-[var(--accent)]" style={{ width: `${card.scores[key] * 10}%` }} /></div>
                      <span className="w-6 text-right tabular-nums">{card.scores[key]}</span>
                    </div>
                  ))}
                </div>
              )}
              {card.best_line && (
                <blockquote className="mt-6 border-l-2 border-[var(--accent)] pl-3 text-sm italic">"{card.best_line}"</blockquote>
              )}
              {card.summary && <p className="mt-4 text-sm">{card.summary}</p>}
            </div>
            <div className="mt-6 card p-6 text-center">
              <h2 className="font-heading text-xl font-semibold">Think you'd argue it better?</h2>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">An AI takes the opposite side of your view and scores your arguments. Or debate a real person who disagrees. Free.</p>
              <button onClick={tryIt} className="btn-accent mt-4" data-testid="btn-share-try">Try it free</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** /try — no sign-up needed: pick a motion and a side, then debate the AI. */
export function TryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [motions, setMotions] = useState(null);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Absurd topics first: they're what people arriving from social posts came for.
    api.get("/spar/guest/motions")
      .then(({ data }) => setMotions([...data.motions].sort((a, b) => (b.tag === "Unhinged") - (a.tag === "Unhinged"))))
      .catch(() => setMotions([]));
  }, []);

  const go = async (side) => {
    setBusy(true);
    try {
      const { data } = await api.post("/spar/guest/start", { motion_id: picked.id, side });
      saveGuestToken(data.debate_id, data.guest_token);
      navigate(`/try/${data.debate_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't start. Try again in a bit.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)]">
        <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <button onClick={() => navigate("/")}><Logo size="sm" /></button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!user && <button onClick={startGoogleLogin} className="btn-primary text-sm">Sign in</button>}
          </div>
        </div>
      </header>
      <main className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 py-10`}>
        <div className="eyebrow">No sign-up needed</div>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold mt-2 leading-tight">Pick a fight. Politely.</h1>
        <p className="mt-3 text-[var(--fg-muted)] max-w-lg">Choose a motion and your side. An AI argues the other side, then scores your arguments.</p>

        {!picked ? (
          <div className="mt-8 grid sm:grid-cols-2 gap-3" data-testid="try-motions">
            {motions === null && <div className="text-sm text-[var(--fg-subtle)]">Loading…</div>}
            {motions?.map((m) => (
              <button key={m.id} onClick={() => setPicked(m)} className="card p-4 text-left hover:border-[var(--fg)] transition-colors">
                <span className="chip !py-0 !px-1.5 text-[10px]">{m.tag}</span>
                <div className="mt-2 font-medium">{m.motion}</div>
              </button>
            ))}
            {motions?.length > 0 && (
              <a href="/motions" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] sm:col-span-2 mt-1">
                Read the arguments for and against each topic →
              </a>
            )}
          </div>
        ) : (
          <div className="mt-8 card p-6">
            <div className="eyebrow">The motion</div>
            <div className="font-heading text-2xl font-semibold mt-1">{picked.motion}</div>
            <p className="mt-4 text-sm text-[var(--fg-muted)]">Which side are you on?</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={() => go("for")} disabled={busy} className="btn-accent" data-testid="btn-try-for">I agree</button>
              <button onClick={() => go("against")} disabled={busy} className="btn-outline" data-testid="btn-try-against">I disagree</button>
              <button onClick={() => setPicked(null)} disabled={busy} className="btn-ghost">Pick another</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
