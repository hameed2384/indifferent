import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import StepDots from "@/components/StepDots";
import { STICKY_NAV } from "@/lib/navChrome";
import { CONTAINER_COMPACT } from "@/lib/layout";

const LIKERT = [1, 2, 3, 4, 5];
const LIKERT_LABELS = { 1: "Strongly disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly agree" };

export default function Onboarding() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState(false);
  const [answers, setAnswers] = useState({});
  const [freeText, setFreeText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadQuestions = () => {
    setQuestionsLoading(true);
    setQuestionsError(false);
    api.get("/onboarding/questions")
      .then(({ data }) => setQuestions(data.questions))
      // Previously silently swallowed: a failure here left questions=[]
      // with canSubmit permanently false and zero explanation — a dead end
      // on a mandatory gate. Now it's a visible, retryable error instead.
      .catch(() => setQuestionsError(true))
      .finally(() => setQuestionsLoading(false));
  };

  useEffect(loadQuestions, []);

  const canSubmit = displayName.trim().length >= 2 &&
    questions.length > 0 &&
    Object.keys(answers).length === questions.length &&
    (freeText.trim().length >= 20);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/onboarding/submit", {
        quiz_answers: answers,
        free_text: freeText,
        display_name: displayName,
        bio,
      });
      setUser(data);
      toast.success("Your stance has been mapped.");
      navigate("/verify");
    } catch {
      toast.error("Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className={STICKY_NAV}>
        <div className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <StepDots step={1} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={`${CONTAINER_COMPACT} mx-auto px-4 sm:px-6 py-12`}>
        <div className="eyebrow">Declare your views</div>
        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-semibold mt-2 leading-tight">
          Tell us how you actually think.
        </h1>
        <p className="mt-4 text-[var(--fg-muted)]">Be candid — this is how we find your opposite.</p>
        <p className="mt-2 text-xs text-[var(--fg-subtle)] flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> Only your name and stance summary are shared with your match.
        </p>

        <section className="mt-10 space-y-4">
          <div>
            <label className="eyebrow block mb-2">Display name</label>
            <input data-testid="input-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field" placeholder="e.g. J. Rivera" maxLength={40} />
          </div>
          <div>
            <label className="eyebrow block mb-2">Short bio <span className="text-[var(--fg-subtle)] normal-case tracking-normal">(optional)</span></label>
            <input data-testid="input-bio" value={bio} onChange={(e) => setBio(e.target.value)} className="field" placeholder="One line about you" maxLength={140} />
          </div>
        </section>

        <section className="mt-10">
          <div className="eyebrow mb-2">In your own words</div>
          <p className="text-sm text-[var(--fg-muted)] mb-3">Write a paragraph about the political & social issues you care about most. What do you believe, and why?</p>
          <textarea
            data-testid="input-free-text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={7}
            placeholder="I care most about... I think the government should... The most important issue today is..."
            className="textarea"
          />
          <div className="text-xs text-[var(--fg-subtle)] mt-1">{freeText.length} characters · minimum 20</div>
        </section>

        <section className="mt-10">
          <div className="eyebrow mb-2">Quick calibration</div>
          <p className="text-sm text-[var(--fg-muted)] mb-4">Eight statements. Rate each to sharpen the mapping.</p>
          {questionsError && (
            <div className="card p-5 text-center">
              <p className="text-sm text-[var(--fg-muted)] mb-3">Couldn't load the calibration questions.</p>
              <button onClick={loadQuestions} className="btn-outline text-sm" data-testid="btn-retry-questions">Try again</button>
            </div>
          )}
          {questionsLoading && !questionsError && (
            <div className="text-sm text-[var(--fg-subtle)]">Loading questions…</div>
          )}
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="card p-5">
                <div className="text-xs text-[var(--fg-subtle)] font-mono-ui">Q{String(i+1).padStart(2, "0")}</div>
                <div className="font-medium text-base mt-1">{q.text}</div>
                <div className="mt-4 grid grid-cols-5 gap-2" data-testid={`quiz-${q.id}`}>
                  {LIKERT.map((v) => (
                    <button
                      key={v}
                      data-testid={`quiz-${q.id}-${v}`}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      className={`py-2 rounded-lg border text-sm font-medium transition ${answers[q.id] === v ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]" : "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                  <span>{LIKERT_LABELS[1]}</span>
                  <span>{LIKERT_LABELS[5]}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-[var(--fg-subtle)]">Our AI will map you on two axes.</div>
          <button data-testid="btn-submit-onboarding" className="btn-accent" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? "Analyzing…" : "Map my stance"}
          </button>
        </div>
      </main>
    </div>
  );
}
