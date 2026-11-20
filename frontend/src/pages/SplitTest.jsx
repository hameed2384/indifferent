import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  SCALE, SPLIT_QUESTIONS, answerLabel, answeredTests, compare, ownedTests, profile, rankResponses,
  rememberAnswered, rememberOwned, splitDeck,
} from "@/lib/splitTest";
import { usePageMeta } from "@/pages/Motions";

const GREEN = "#3ae4a4";
const RED = "#ff5c7a";
const A_COLOR = "#a78bfa";
const B_COLOR = "#fbbf24";
const PATH = "/split-test";
// Scale buttons: bigger at the ends, like the big personality tests, coloured disagree -> agree.
const DOT = { "-2": [56, RED], "-1": [44, "#ff9aab"], 0: [34, "#9ca3af"], 1: [44, "#8af0c8"], 2: [56, GREEN] };
const initial = (name) => (name || "?").trim()[0]?.toUpperCase() || "?";

function wrapLines(g, text, width) {
  const lines = [];
  let line = "";
  text.split(" ").forEach((w) => {
    const next = line ? `${line} ${w}` : w;
    if (line && g.measureText(next).width > width) { lines.push(line); line = w; } else line = next;
  });
  return line ? [...lines, line] : lines;
}

/** The pair's result as a 1080x1350 picture, drawn in the browser so nothing is uploaded. */
export function drawSplitCard(canvas, aName, bName, r, aType, bType) {
  canvas.width = 1080;
  canvas.height = 1350;
  const g = canvas.getContext("2d");
  const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const box = (...args) => (g.roundRect ? g.roundRect(...args) : g.rect(...args.slice(0, 4)));  // older Safari has no roundRect
  g.fillStyle = "#090a10";
  g.fillRect(0, 0, 1080, 1350);
  g.textAlign = "center";
  g.fillStyle = "rgba(255,255,255,.6)";
  g.font = font(38, 600);
  g.fillText("THE SPLIT TEST", 540, 105);
  g.fillStyle = "#fff";
  g.font = font(54, 700);
  g.fillText(`${aName}  &  ${bName}`.slice(0, 40), 540, 185);
  g.font = font(200, 800);
  g.fillText(`${r.match}%`, 540, 400);
  g.font = font(42, 500);
  g.fillStyle = "rgba(255,255,255,.65)";
  g.fillText("match", 540, 470);
  // the bar: green for how close you are, red for the rest
  const x0 = 140, x1 = 940, y = 515, h = 36;
  g.fillStyle = RED;
  g.beginPath(); box(x0, y, x1 - x0, h, 18); g.fill();
  if (r.match) { g.fillStyle = GREEN; g.beginPath(); box(x0, y, Math.max(36, (x1 - x0) * (r.match / 100)), h, 18); g.fill(); }
  g.fillStyle = r.split <= 50 ? GREEN : RED;
  g.font = font(76, 800);
  g.fillText(r.title, 540, 670);
  g.fillStyle = "rgba(255,255,255,.82)";
  g.font = font(36, 400);
  wrapLines(g, r.line, 860).slice(0, 2).forEach((line, i) => g.fillText(line, 540, 735 + i * 48));
  // each person's type, side by side
  [[aName, aType, A_COLOR, 290], [bName, bType, B_COLOR, 790]].forEach(([name, type, color, cx]) => {
    g.fillStyle = "rgba(255,255,255,.06)";
    g.beginPath(); box(cx - 230, 860, 460, 170, 28); g.fill();
    g.fillStyle = color;
    g.font = font(34, 600);
    g.fillText(name.slice(0, 16), cx, 920);
    g.fillStyle = "#fff";
    g.font = font(44, 800);
    g.fillText(type.title, cx, 985);
  });
  if (r.clash) {
    g.fillStyle = "rgba(255,255,255,.55)";
    g.font = font(30, 600);
    g.fillText("BIGGEST CLASH", 540, 1100);
    g.fillStyle = "#fff";
    g.font = font(36, 500);
    wrapLines(g, r.clash.motion || "", 900).slice(0, 2).forEach((line, i) => g.fillText(line, 540, 1150 + i * 46));
  }
  g.fillStyle = "#fff";
  g.font = font(38, 700);
  g.fillText("indifferentapp.com/split-test", 540, 1295);
}

async function shareOrCopy({ text, url, file }) {
  try {
    if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url });
    else if (navigator.share) await navigator.share({ text, url });
    else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Link copied");
    }
  } catch { /* the visitor closed the share sheet */ }
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#090a10] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between">
        <Link to="/" className="font-heading font-semibold">indifferent</Link>
        <Link to={PATH} className="text-sm text-white/60">The Split Test</Link>
      </header>
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10">{children}</main>
    </div>
  );
}

function NameForm({ label, cta, onSubmit, busy }) {
  const [name, setName] = useState("");
  return (
    <form className="mt-8 grid gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
      <label className="text-sm text-white/65" htmlFor="split-name">{label}</label>
      <input id="split-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name"
        placeholder="Your first name or nickname" className="h-14 rounded-2xl bg-white/10 border border-white/15 px-4 text-lg outline-none focus:border-white/50"
        data-testid="split-name" />
      <button type="submit" disabled={!name.trim() || busy} className="h-14 rounded-2xl bg-white text-black font-semibold text-lg disabled:opacity-40" data-testid="split-start">
        {busy ? "Loading…" : cta}
      </button>
    </form>
  );
}

/** How it works, in three steps (the "what to expect" panel personality tests open with). */
function Steps() {
  const steps = [
    ["1", "Answer 12 hot takes", "From strongly disagree to strongly agree. About two minutes."],
    ["2", "Send your link", "To a friend, partner, sibling or the group chat."],
    ["3", "See where you split", "Your match, both your types, and your biggest clash."],
  ];
  return (
    <ol className="mt-8 grid gap-3 text-left">
      {steps.map(([n, title, line]) => (
        <li key={n} className="flex gap-3 items-start rounded-2xl border border-white/10 p-4">
          <span className="w-8 h-8 shrink-0 rounded-full bg-white/10 grid place-items-center font-semibold">{n}</span>
          <span><span className="font-semibold">{title}</span><span className="block text-sm text-white/60">{line}</span></span>
        </li>
      ))}
    </ol>
  );
}

function Questions({ deck, onDone }) {
  const [answers, setAnswers] = useState([]);
  const [chosen, setChosen] = useState(null);
  const busy = useRef(false);
  const index = answers.length;
  const pick = (value) => {
    if (busy.current) return;
    busy.current = true;
    setChosen(value);
    setTimeout(() => {
      busy.current = false;
      setChosen(null);
      const next = [...answers, value];
      if (next.length >= deck.length) onDone(next); else setAnswers(next);
    }, 220);
  };
  const back = () => { if (!busy.current) setAnswers((a) => a.slice(0, -1)); };
  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 5) pick(n - 3);
      if (e.key === "Backspace" && index > 0) back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const q = deck[Math.min(index, deck.length - 1)];
  return (
    <div className="mt-6" data-testid="split-question">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-white transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-white/50">
        <span>{index + 1} of {deck.length} · {q.tag}</span>
        {index > 0 && <button onClick={back} className="hover:text-white" data-testid="split-back">← Back</button>}
      </div>
      <h1 className="mt-10 min-h-[9rem] font-heading text-3xl sm:text-4xl font-semibold leading-tight">{q.motion}</h1>
      <div className="mt-6 flex items-center justify-between gap-1" role="radiogroup" aria-label="How much do you agree?">
        {SCALE.map((s) => {
          const [size, color] = DOT[s.value];
          const on = chosen === s.value;
          return (
            <button key={s.value} onClick={() => pick(s.value)} role="radio" aria-checked={on} aria-label={s.label}
              className="flex-1 h-16 grid place-items-center" data-testid={`split-answer-${s.value}`}>
              <span className="rounded-full border-[3px] transition-transform duration-150 hover:scale-110"
                style={{ width: size, height: size, borderColor: color, background: on ? color : "transparent", transform: on ? "scale(1.15)" : undefined }} />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-sm font-semibold">
        <span style={{ color: RED }}>Disagree</span>
        <span className="text-white/40 font-normal">Not sure</span>
        <span style={{ color: GREEN }}>Agree</span>
      </div>
    </div>
  );
}

/** One trait as a bar with each person's marker on it (the 8values-style axis). */
function TraitBar({ label, left, right, aName, bName, a, b }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-white/55"><span>{left}</span><span className="text-white/80 font-medium">{label}</span><span>{right}</span></div>
      <div className="relative mt-2 h-2.5 rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10">
        {[[a, A_COLOR, aName, a === b ? -8 : 0], [b, B_COLOR, bName, a === b ? 8 : 0]].map(([value, color, name, nudge], i) => value == null ? null : (
          <span key={i} title={`${name}: ${value}`} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold text-black ring-2 ring-[#090a10]"
            style={{ left: `calc(${value}% + ${nudge}px)`, background: color }}>{initial(name)}</span>
        ))}
      </div>
    </div>
  );
}

function TypeCard({ name, type, color }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: `${color}66` }}>
      <div className="text-xs font-semibold" style={{ color }}>{name}</div>
      <div className="mt-1 font-heading text-lg font-semibold leading-tight">{type.title}</div>
      <p className="mt-1 text-xs text-white/60">{type.line}</p>
    </div>
  );
}

/** Where both people sit on one take: a 5-point line with each person's marker. */
function TakeScale({ va, vb, aName, bName }) {
  return (
    <div className="relative mt-3 h-6 mx-3" aria-hidden="true">
      <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-white/15" />
      {[-2, -1, 0, 1, 2].map((v) => <span key={v} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/30" style={{ left: `${(v + 2) * 25}%` }} />)}
      {[[va, A_COLOR, aName, va === vb ? -7 : 0], [vb, B_COLOR, bName, va === vb ? 7 : 0]].map(([v, color, name, nudge], i) => (
        <span key={i} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-black ring-2 ring-[#090a10]"
          style={{ left: `calc(${(v + 2) * 25}% + ${nudge}px)`, background: color }}>{initial(name)}</span>
      ))}
    </div>
  );
}

function Highlight({ label, color, item, aName, bName }) {
  if (!item) return null;
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: `${color}66` }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</div>
      <div className="mt-1 font-medium">{item.motion}</div>
      <div className="mt-1 text-xs text-white/60">{aName}: {answerLabel(item.a)} · {bName}: {answerLabel(item.b)}</div>
    </div>
  );
}

function PairResult({ aName, bName, aAnswers, bAnswers, deck, footer }) {
  const canvasRef = useRef(null);
  const result = compare(aAnswers, bAnswers, deck);
  const aType = profile(aAnswers);
  const bType = profile(bAnswers);
  useEffect(() => { drawSplitCard(canvasRef.current, aName, bName, result, aType, bType); }); // cheap; redraws with the data
  const share = async () => {
    const blob = await new Promise((done) => canvasRef.current.toBlob(done, "image/png"));
    const file = blob && new File([blob], "the-split-test.png", { type: "image/png" });
    await shareOrCopy({ text: `${aName} and ${bName} are a ${result.match}% match: ${result.title}. Try The Split Test:`, url: `${window.location.origin}${PATH}`, file });
  };
  const save = () => {
    const link = document.createElement("a");
    link.download = "the-split-test.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };
  return (
    <div className="mt-6" data-testid="split-result">
      <canvas ref={canvasRef} className="w-full rounded-2xl border border-white/10" role="img"
        aria-label={`${aName} and ${bName}: ${result.match}% match, ${result.title}. ${result.line}`} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={share} className="h-12 rounded-xl bg-white text-black font-semibold" data-testid="split-share-result">Share result</button>
        <button onClick={save} className="h-12 rounded-xl border border-white/20 text-sm">Save image</button>
      </div>

      <h2 className="mt-10 font-heading text-xl font-semibold">Your types</h2>
      <div className="mt-3 grid grid-cols-2 gap-3" data-testid="split-types">
        <TypeCard name={aName} type={aType} color={A_COLOR} />
        <TypeCard name={bName} type={bType} color={B_COLOR} />
      </div>
      <div className="mt-5 grid gap-5 rounded-2xl border border-white/10 p-4">
        <TraitBar label="Lean" left="Disagrees" right="Agrees" aName={aName} bName={bName} a={aType.agree} b={bType.agree} />
        <TraitBar label="Conviction" left="Easy-going" right="Fired up" aName={aName} bName={bName} a={aType.conviction} b={bType.conviction} />
      </div>

      {(result.clash || result.bond) && (
        <div className="mt-6 grid gap-3">
          <Highlight label="Biggest clash" color={RED} item={result.clash} aName={aName} bName={bName} />
          <Highlight label="Strongest bond" color={GREEN} item={result.bond} aName={aName} bName={bName} />
        </div>
      )}

      {(result.click.length > 0 || result.clashAreas.length > 0) && (
        <div className="mt-6 grid gap-3" data-testid="split-areas">
          {result.click.length > 0 && (
            <div><div className="text-sm text-white/55">Where you click</div>
              <div className="mt-2 flex flex-wrap gap-2">{result.click.map((t) => <span key={t.tag} className="rounded-full px-3 py-1 text-sm" style={{ background: `${GREEN}22`, color: GREEN }}>{t.tag} · {t.match}%</span>)}</div></div>
          )}
          {result.clashAreas.length > 0 && (
            <div><div className="text-sm text-white/55">Where you clash</div>
              <div className="mt-2 flex flex-wrap gap-2">{result.clashAreas.map((t) => <span key={t.tag} className="rounded-full px-3 py-1 text-sm" style={{ background: `${RED}22`, color: RED }}>{t.tag} · {t.match}%</span>)}</div></div>
          )}
        </div>
      )}

      <h2 className="mt-10 font-heading text-xl font-semibold">Take by take</h2>
      <ul className="mt-3 grid gap-2">
        {result.items.map((x, i) => (
          <li key={x.slug || i} className="rounded-xl border p-3" style={{ borderColor: x.split ? `${RED}88` : x.close ? `${GREEN}66` : "rgba(255,255,255,.15)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">{x.motion}</div>
              <span className="text-xs font-semibold shrink-0" style={{ color: x.split ? RED : x.close ? GREEN : "rgba(255,255,255,.6)" }}>
                {x.split ? "Split" : x.close ? "Together" : "Close-ish"}
              </span>
            </div>
            <TakeScale va={x.va} vb={x.vb} aName={aName} bName={bName} />
            <div className="mt-1 text-xs text-white/55">{aName}: {answerLabel(x.a)} · {bName}: {answerLabel(x.b)}</div>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}

function ShareInvite({ code, name }) {
  const url = `${window.location.origin}${PATH}/${code}`;
  return (
    <div className="rounded-2xl border border-white/15 p-5" data-testid="split-invite">
      <div className="font-heading text-xl font-semibold">Send it to anyone</div>
      <p className="mt-1 text-sm text-white/65">A friend, your partner, your sibling, the group chat. Everyone who answers gets their own result with you, and you see who matches you best.</p>
      <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm break-all select-all">{url}</div>
      <button onClick={() => shareOrCopy({ text: `${name} sent you The Split Test. 12 hot takes, let's see how much we match 👀`, url })}
        className="mt-3 w-full h-12 rounded-xl bg-white text-black font-semibold" data-testid="split-share-link">Send the link</button>
    </div>
  );
}

function OwnerView({ code, owned }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null);
  const load = () => {
    setFailed(false);
    api.get(`/public/split/${code}/results`, { params: { key: owned.key } }).then(({ data: d }) => setData(d)).catch(() => setFailed(true));
  };
  useEffect(load, [code, owned.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (failed) return <div className="mt-16 text-center"><p className="text-white/65">Couldn't load your Split Test.</p><button onClick={load} className="mt-4 h-12 px-6 rounded-xl bg-white text-black font-semibold">Try again</button></div>;
  if (!data) return <p className="mt-16 text-center text-white/50">Loading…</p>;
  if (open) {
    return <PairResult aName={data.name} bName={open.name} aAnswers={data.answers} bAnswers={open.answers} deck={data.deck}
      footer={<button onClick={() => setOpen(null)} className="mt-6 w-full h-12 rounded-xl border border-white/25">Back to everyone</button>} />;
  }
  const me = profile(data.answers);
  const ranked = rankResponses(data.answers, data.responses);
  return (
    <div className="mt-6 grid gap-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Your Split Test</h1>
        <p className="mt-1 text-white/60">{ranked.length ? `${ranked.length} ${ranked.length === 1 ? "person has" : "people have"} taken it.` : "Nobody has taken it yet."}</p>
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: `${A_COLOR}66` }} data-testid="split-my-type">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: A_COLOR }}>Your type</div>
        <div className="mt-1 font-heading text-2xl font-semibold">{me.title}</div>
        <p className="mt-1 text-sm text-white/65">{me.line}</p>
        <div className="mt-4 grid gap-4">
          <TraitBar label="Lean" left="Disagrees" right="Agrees" aName={data.name} a={me.agree} />
          <TraitBar label="Conviction" left="Easy-going" right="Fired up" aName={data.name} a={me.conviction} />
        </div>
      </div>
      <ShareInvite code={code} name={data.name} />
      {ranked.length > 0 && (
        <div>
          <h2 className="font-heading text-xl font-semibold">Who matches you best</h2>
          <ol className="mt-3 grid gap-2" data-testid="split-responses">
            {ranked.map((r, i) => (
              <li key={r.id}>
                <button onClick={() => setOpen(r)} className="w-full rounded-xl border border-white/15 p-4 flex items-center gap-3 text-left">
                  <span className="w-7 text-center text-white/50 font-semibold">{i === 0 && ranked.length > 1 ? "👑" : i + 1}</span>
                  <span className="flex-1 min-w-0"><span className="font-semibold">{r.name}</span><span className="block text-xs text-white/55">{profile(r.answers).title} · {r.result.title}</span></span>
                  <span className="font-heading text-2xl font-semibold" style={{ color: r.result.split <= 50 ? GREEN : RED }}>{r.result.match}%</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <button onClick={load} className="h-11 rounded-xl border border-white/20 text-sm">Refresh</button>
    </div>
  );
}

function Start() {
  const navigate = useNavigate();
  const [motions, setMotions] = useState(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState(null);
  const [deck, setDeck] = useState(null);
  const [saving, setSaving] = useState(false);
  const mine = Object.entries(ownedTests()).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const load = () => {
    setFailed(false);
    api.get("/public/motions").then(({ data }) => setMotions(data.motions)).catch(() => setFailed(true));
  };
  useEffect(load, []);
  const begin = (n) => { setName(n); setDeck(splitDeck(motions)); };
  const finish = async (answers) => {
    setSaving(true);
    try {
      const { data } = await api.post("/public/split", { name, slugs: deck.map((m) => m.slug), answers });
      rememberOwned(data.code, data.key, name);
      navigate(`${PATH}/${data.code}`);
    } catch {
      setSaving(false);
      toast.error("Couldn't save your answers. Please try again.");
    }
  };
  if (saving) return <p className="mt-16 text-center text-white/50">Saving your answers…</p>;
  if (deck) return <Questions deck={deck} onDone={finish} />;
  return (
    <div className="mt-14 text-center">
      <h1 className="font-heading text-5xl font-semibold">The Split Test</h1>
      <p className="mt-4 text-white/65">How much do you and your friend really match? {SPLIT_QUESTIONS} hot takes, two minutes, no sign-up.</p>
      <Steps />
      <div className="text-left">
        {failed
          ? <button onClick={load} className="mt-8 w-full h-14 rounded-2xl bg-white text-black font-semibold text-lg">Try again</button>
          : <NameForm label="What should your friends call you?" cta="Start" busy={!motions} onSubmit={begin} />}
      </div>
      {mine.length > 0 && (
        <div className="mt-10 text-left">
          <div className="text-sm text-white/50">Your Split Tests</div>
          <div className="mt-2 grid gap-2">
            {mine.map(([code]) => (
              <Link key={code} to={`${PATH}/${code}`} className="rounded-xl border border-white/15 p-3 text-sm">See who took your test ({code})</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Invite({ code }) {
  const [test, setTest] = useState(null);
  const [failed, setFailed] = useState(null);
  const [name, setName] = useState(null);
  const [result, setResult] = useState(() => answeredTests()[code] || null);
  const [sending, setSending] = useState(false);
  const load = () => {
    setFailed(null);
    api.get(`/public/split/${code}`).then(({ data }) => setTest(data))
      .catch((e) => setFailed(e?.response?.status === 404 ? "missing" : "error"));
  };
  useEffect(() => { if (!result) load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (answers) => {
    setSending(true);
    try {
      const { data } = await api.post(`/public/split/${code}/respond`, { name, answers });
      const saved = { aName: data.name, bName: data.me.name, a: data.answers, b: data.me.answers, deck: data.deck };
      rememberAnswered(code, saved);
      setResult(saved);
    } catch {
      setSending(false);
      toast.error("Couldn't send your answers. Please try again.");
    }
  };

  if (result) {
    return <PairResult aName={result.aName} bName={result.bName} aAnswers={result.a} bAnswers={result.b} deck={result.deck}
      footer={<Link to={PATH} className="mt-6 h-14 rounded-2xl bg-white text-black font-semibold text-lg grid place-items-center" data-testid="split-make-own">Make your own Split Test</Link>} />;
  }
  if (failed === "missing") return <div className="mt-16 text-center"><p className="text-white/65">This Split Test doesn't exist any more.</p><Link to={PATH} className="mt-6 inline-block h-12 px-6 leading-[3rem] rounded-xl bg-white text-black font-semibold">Make your own</Link></div>;
  if (failed) return <div className="mt-16 text-center"><p className="text-white/65">Couldn't load this Split Test.</p><button onClick={load} className="mt-4 h-12 px-6 rounded-xl bg-white text-black font-semibold">Try again</button></div>;
  if (!test) return <p className="mt-16 text-center text-white/50">Loading…</p>;
  if (sending) return <p className="mt-16 text-center text-white/50">Comparing your answers…</p>;
  if (name) return <Questions deck={test.deck} onDone={finish} />;
  return (
    <div className="mt-14 text-center">
      <div className="text-sm text-white/50">The Split Test</div>
      <h1 className="mt-2 font-heading text-4xl font-semibold leading-tight">{test.name} wants to know how much you two match</h1>
      <p className="mt-4 text-white/65">{SPLIT_QUESTIONS} hot takes, from strongly disagree to strongly agree. Then see your match, both your types, and your biggest clash.</p>
      {test.responses > 0 && <p className="mt-2 text-sm text-white/45">{test.responses} {test.responses === 1 ? "person has" : "people have"} already taken it.</p>}
      <div className="text-left"><NameForm label="Your name, so they know it's you" cta="Start" onSubmit={setName} /></div>
    </div>
  );
}

/** /split-test and /split-test/:code */
export default function SplitTest() {
  const { code } = useParams();
  usePageMeta(
    "The Split Test: how much do you and your friend match? | indifferent",
    "Answer 12 hot takes, send it to a friend, partner or sibling, and see your match, both your types and your biggest clash. Free, no sign-up.",
  );
  const owned = code ? ownedTests()[code] : null;
  return (
    <Shell>
      {!code && <Start />}
      {code && owned && <OwnerView code={code} owned={owned} />}
      {code && !owned && <Invite code={code} />}
    </Shell>
  );
}
