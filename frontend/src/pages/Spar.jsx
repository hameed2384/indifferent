import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import Logo from "@/components/Logo";
import { CONTAINER_COMPACT } from "@/lib/layout";

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

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    api.get(`/spar/${debateId}`)
      .then(({ data }) => { if (alive) { setDebate(data); setMessages(data.messages || []); } })
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [debateId]);

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
      const { data } = await api.post(`/spar/${debateId}/message`, { text: body });
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
      const { data } = await api.post(`/spar/${debateId}/end`);
      setDebate((d) => ({ ...d, ...data }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't end the debate");
    } finally {
      setEnding(false);
    }
  };

  const again = async () => {
    setStarting(true);
    try { await startSpar(navigate, debate?.tag); } catch (e) { toast.error(e.response?.data?.detail || "Couldn't start a new round"); }
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
            <AccountMenu user={user} logout={logout} />
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
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={again} disabled={starting} className="btn-accent" data-testid="btn-spar-again">{starting ? "Starting…" : "Spar again"}</button>
              <button onClick={() => navigate(user?.id_verified ? "/match" : "/verify")} className="btn-outline">Debate a real person</button>
            </div>
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
