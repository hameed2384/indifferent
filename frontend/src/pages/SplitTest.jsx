import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  SPLIT_QUESTIONS, answeredTests, compare, ownedTests, rememberAnswered, rememberOwned, splitDeck,
} from "@/lib/splitTest";
import { usePageMeta } from "@/pages/Motions";

const GREEN = "#3ae4a4";
const RED = "#ff5c7a";
const PATH = "/split-test";
const word = (side) => (side === "for" ? "Agree" : "Disagree");

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
export function drawSplitCard(canvas, aName, bName, r) {
  canvas.width = 1080;
  canvas.height = 1350;
  const g = canvas.getContext("2d");
  const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = "#090a10";
  g.fillRect(0, 0, 1080, 1350);
  g.textAlign = "center";
  g.fillStyle = "#fff";
  g.font = font(44, 600);
  g.fillText("THE SPLIT TEST", 540, 120);
  g.font = font(54, 700);
  g.fillStyle = "rgba(255,255,255,.85)";
  g.fillText(`${aName}  vs  ${bName}`.slice(0, 40), 540, 210);
  // the bar: green for takes you share, red for the ones you split on
  const x0 = 120, x1 = 960, y = 300, h = 70;
  const cut = x0 + (x1 - x0) * (r.together / Math.max(1, r.total));
  const box = (...args) => (g.roundRect ? g.roundRect(...args) : g.rect(...args.slice(0, 4)));  // older Safari has no roundRect
  g.fillStyle = RED;
  g.beginPath(); box(x0, y, x1 - x0, h, 20); g.fill();
  if (r.together) { g.fillStyle = GREEN; g.beginPath(); box(x0, y, Math.max(40, cut - x0), h, 20); g.fill(); }
  g.fillStyle = "#fff";
  g.font = font(190, 800);
  g.fillText(`${r.split}%`, 540, 600);
  g.font = font(44, 500);
  g.fillStyle = "rgba(255,255,255,.65)";
  g.fillText("split", 540, 665);
  g.fillStyle = r.split <= 50 ? GREEN : RED;
  g.font = font(80, 800);
  g.fillText(r.title, 540, 820);
  g.fillStyle = "rgba(255,255,255,.82)";
  g.font = font(40, 400);
  wrapLines(g, r.line, 860).forEach((line, i) => g.fillText(line, 540, 900 + i * 54));
  g.fillStyle = "rgba(255,255,255,.6)";
  g.font = font(36, 500);
  g.fillText(`Together on ${r.together}  ·  Split on ${r.splits}`, 540, 1100);
  g.fillStyle = "#fff";
  g.font = font(40, 700);
  g.fillText("indifferentapp.com/split-test", 540, 1260);
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

function Questions({ deck, onDone }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const busy = useRef(false);
  const pick = (side) => {
    if (busy.current) return;
    busy.current = true;
    const next = [...answers, side];
    setAnswers(next);
    setTimeout(() => {
      busy.current = false;
      if (next.length >= deck.length) onDone(next); else setIndex((i) => i + 1);
    }, 160);
  };
  const q = deck[index];
  return (
    <div className="mt-6" data-testid="split-question">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-white transition-all" style={{ width: `${(answers.length / deck.length) * 100}%` }} />
      </div>
      <div className="mt-3 text-sm text-white/50">{index + 1} of {deck.length} · {q.tag}</div>
      <h1 className="mt-10 min-h-[9rem] font-heading text-3xl sm:text-4xl font-semibold leading-tight">{q.motion}</h1>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button onClick={() => pick("for")} className="h-16 rounded-2xl text-black font-semibold text-lg" style={{ background: GREEN }} data-testid="split-agree">Agree</button>
        <button onClick={() => pick("against")} className="h-16 rounded-2xl text-black font-semibold text-lg" style={{ background: RED }} data-testid="split-disagree">Disagree</button>
      </div>
    </div>
  );
}

function PairResult({ aName, bName, result, footer }) {
  const canvasRef = useRef(null);
  useEffect(() => { drawSplitCard(canvasRef.current, aName, bName, result); }, [aName, bName, result]);
  const share = async () => {
    const blob = await new Promise((done) => canvasRef.current.toBlob(done, "image/png"));
    const file = blob && new File([blob], "the-split-test.png", { type: "image/png" });
    await shareOrCopy({ text: `${aName} and ${bName} are ${result.split}% split: ${result.title}. Try The Split Test:`, url: `${window.location.origin}${PATH}`, file });
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
        aria-label={`${aName} and ${bName}: ${result.split}% split, ${result.title}. ${result.line}`} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={share} className="h-12 rounded-xl bg-white text-black font-semibold" data-testid="split-share-result">Share result</button>
        <button onClick={save} className="h-12 rounded-xl border border-white/20 text-sm">Save image</button>
      </div>
      <h2 className="mt-8 font-heading text-xl font-semibold">Take by take</h2>
      <ul className="mt-3 grid gap-2">
        {result.items.map((x, i) => (
          <li key={x.slug || i} className="rounded-xl border p-3" style={{ borderColor: x.split ? `${RED}88` : `${GREEN}66` }}>
            <div className="text-sm font-medium">{x.motion}</div>
            <div className="mt-1 text-xs text-white/65">
              <span style={{ color: x.split ? RED : GREEN }} className="font-semibold">{x.split ? "Split" : "Together"}</span>
              {" · "}{aName}: {word(x.a)} · {bName}: {word(x.b)}
            </div>
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
      <p className="mt-1 text-sm text-white/65">A friend, your partner, your sibling, the group chat. Everyone who answers gets their own result with you, and you see them all here.</p>
      <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm break-all select-all">{url}</div>
      <button onClick={() => shareOrCopy({ text: `${name} sent you The Split Test. 12 hot takes, let's see where we split 👀`, url })}
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
    const result = compare(data.answers, open.answers, data.deck);
    return <PairResult aName={data.name} bName={open.name} result={result}
      footer={<button onClick={() => setOpen(null)} className="mt-6 w-full h-12 rounded-xl border border-white/25">Back to everyone</button>} />;
  }
  return (
    <div className="mt-6 grid gap-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Your Split Test</h1>
        <p className="mt-1 text-white/60">{data.responses.length ? `${data.responses.length} ${data.responses.length === 1 ? "person has" : "people have"} taken it.` : "Nobody has taken it yet."}</p>
      </div>
      <ShareInvite code={code} name={data.name} />
      {data.responses.length > 0 && (
        <ul className="grid gap-2" data-testid="split-responses">
          {data.responses.map((r) => {
            const c = compare(data.answers, r.answers);
            return (
              <li key={r.id}>
                <button onClick={() => setOpen(r)} className="w-full rounded-xl border border-white/15 p-4 flex items-center justify-between text-left">
                  <span><span className="font-semibold">{r.name}</span><span className="block text-xs text-white/55">{c.title}</span></span>
                  <span className="font-heading text-2xl font-semibold" style={{ color: c.split <= 50 ? GREEN : RED }}>{c.split}%</span>
                </button>
              </li>
            );
          })}
        </ul>
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
      <p className="mt-4 text-white/65">Answer {SPLIT_QUESTIONS} hot takes, send the link to a friend, partner or sibling, and see exactly where you split.</p>
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
    return <PairResult aName={result.aName} bName={result.bName} result={compare(result.a, result.b, result.deck)}
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
      <h1 className="mt-2 font-heading text-4xl font-semibold leading-tight">{test.name} wants to know where you two split</h1>
      <p className="mt-4 text-white/65">{SPLIT_QUESTIONS} hot takes. Agree or disagree. Then see every take where you're together and every one where you split.</p>
      <div className="text-left"><NameForm label="Your name, so they know it's you" cta="Start" onSubmit={setName} /></div>
    </div>
  );
}

/** /split-test and /split-test/:code */
export default function SplitTest() {
  const { code } = useParams();
  usePageMeta(
    "The Split Test: where do you and your friend split? | indifferent",
    "Answer 12 hot takes, send it to a friend, partner or sibling, and see exactly where you split. Free, no sign-up.",
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
