import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { QUESTION_COUNT, buildDeck, isMinority, scoreTest } from "@/lib/indifferenceTest";
import { usePageMeta } from "@/pages/Motions";
import { voterId } from "@/pages/Arena";

const GREEN = "#3ae4a4";
const RED = "#ff5c7a";
const PATH = "/how-indifferent-are-you";

function wrapLines(g, text, width) {
  const lines = [];
  let line = "";
  text.split(" ").forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
  });
  return line ? [...lines, line] : lines;
}

/** The result as a 1080x1350 picture, drawn here so nothing is uploaded. */
export function drawCard(canvas, result) {
  canvas.width = 1080;
  canvas.height = 1350;
  const g = canvas.getContext("2d");
  const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = "#090a10";
  g.fillRect(0, 0, 1080, 1350);
  const cx = 540;
  const cy = 500;
  const share = result.indifference / 100;
  g.lineCap = "round";
  g.lineWidth = 34;
  g.strokeStyle = "#20242f";
  g.beginPath(); g.arc(cx, cy, 245, 0, Math.PI * 2); g.stroke();
  if (share > 0) {
    g.strokeStyle = GREEN;
    g.shadowColor = GREEN;
    g.shadowBlur = 36;
    g.beginPath(); g.arc(cx, cy, 245, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share); g.stroke();
    g.shadowBlur = 0;
  }
  g.textAlign = "center";
  g.fillStyle = "#fff";
  g.font = font(44, 600);
  g.fillText("HOW INDIFFERENT ARE YOU?", cx, 130);
  g.font = font(150, 800);
  g.fillText(`${result.indifference}%`, cx, cy + 40);
  g.font = font(38, 500);
  g.fillStyle = "rgba(255,255,255,.65)";
  g.fillText("indifferent", cx, cy + 96);
  g.fillStyle = GREEN;
  g.font = font(76, 800);
  g.fillText(result.title, cx, 885);
  g.fillStyle = "rgba(255,255,255,.82)";
  g.font = font(40, 400);
  wrapLines(g, result.line, 850).forEach((line, i) => g.fillText(line, cx, 960 + i * 54));
  g.fillStyle = "rgba(255,255,255,.6)";
  g.font = font(36, 500);
  g.fillText(`${result.agreed} agreed  ·  ${result.disagreed} disagreed  ·  ${result.skipped} didn't care`, cx, 1140);
  g.fillStyle = "#fff";
  g.font = font(38, 700);
  g.fillText("indifferentapp.com/how-indifferent-are-you", cx, 1260);
}

function Result({ result, onAgain }) {
  const canvasRef = useRef(null);
  useEffect(() => { drawCard(canvasRef.current, result); }, [result]);

  const share = async () => {
    const url = `${window.location.origin}${PATH}`;
    const text = `I'm ${result.indifference}% indifferent: ${result.title}. How about you?`;
    try {
      const blob = await new Promise((done) => canvasRef.current.toBlob(done, "image/png"));
      const file = new File([blob], "how-indifferent-are-you.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url });
      else if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied");
      }
    } catch { /* the visitor closed the share sheet */ }
  };

  const save = () => {
    const link = document.createElement("a");
    link.download = "how-indifferent-are-you.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="max-w-md mx-auto text-center" data-testid="test-result">
      <canvas ref={canvasRef} className="w-full rounded-2xl border border-white/10" role="img"
        aria-label={`${result.indifference}% indifferent: ${result.title}. ${result.line}`} />
      {result.contrarian !== null && (
        <p className="mt-4 text-white/80 text-sm">
          You went against the crowd on {result.contrarian}% of the questions with enough votes to compare.
        </p>
      )}
      <div className="mt-5 grid gap-3">
        <button onClick={share} className="h-12 rounded-xl bg-white text-black font-semibold" data-testid="test-share">Share your result</button>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={save} className="h-11 rounded-xl border border-white/20 text-sm">Save image</button>
          <button onClick={onAgain} className="h-11 rounded-xl border border-white/20 text-sm">Take it again</button>
        </div>
        <Link to="/arena" className="h-12 rounded-xl border border-white/30 font-medium grid place-items-center">Fight for a side in the Arena</Link>
      </div>
    </div>
  );
}

/** /how-indifferent-are-you: ten quick takes, one shareable verdict. */
export default function IndifferenceTest() {
  const [motions, setMotions] = useState(null);
  const [failed, setFailed] = useState(false);
  const [deck, setDeck] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [crowd, setCrowd] = useState(null);
  const shownAt = useRef(0);
  const busy = useRef(false);

  usePageMeta(
    "How Indifferent Are You? The 60-second test | indifferent",
    "Ten hot takes. Agree, disagree or don't care. Find out how indifferent you really are. Free, no sign-up.",
  );

  const load = () => {
    setFailed(false);
    api.get("/public/motions").then(({ data }) => setMotions(data.motions)).catch(() => setFailed(true));
  };
  useEffect(load, []);

  const begin = () => {
    setDeck(buildDeck(motions));
    setIndex(0); setAnswers([]); setCrowd(null);
    busy.current = false;
    shownAt.current = Date.now();
  };

  const answer = async (choice) => {
    if (busy.current) return;
    busy.current = true;
    const secs = (Date.now() - shownAt.current) / 1000;
    const motion = deck[index];
    let tally = null;
    if (choice !== "skip") {
      // A slow or failed vote must not hold up the test.
      tally = await Promise.race([
        api.post(`/public/arena/${encodeURIComponent(motion.slug)}/vote`, { side: choice, voter_id: voterId() })
          .then(({ data }) => data).catch(() => null),
        new Promise((done) => setTimeout(() => done(null), 900)),
      ]);
    }
    const minority = isMinority(choice, tally);
    setAnswers((list) => [...list, { choice, secs, minority }]);
    setCrowd(minority === null ? null : minority ? "You're in the minority on this one." : "Most people are with you.");
    setTimeout(() => {
      setCrowd(null);
      setIndex((i) => i + 1);
      busy.current = false;
      shownAt.current = Date.now();
    }, minority === null ? 180 : 850);
  };

  const finished = deck && index >= deck.length;
  const question = deck && deck[index];

  return (
    <div className="min-h-screen bg-[#090a10] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center">
        <Link to="/" className="font-heading font-semibold">indifferent</Link>
      </header>
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-10">
        {!deck && (
          <div className="text-center mt-16">
            <h1 className="font-heading text-4xl sm:text-5xl font-semibold leading-tight">How indifferent are you?</h1>
            <p className="mt-4 text-white/65">{QUESTION_COUNT} hot takes. Agree, disagree or simply don't care. About a minute, no sign-up.</p>
            <button onClick={failed ? load : begin} disabled={!motions && !failed} className="mt-8 h-14 px-10 rounded-2xl bg-white text-black font-semibold text-lg disabled:opacity-40" data-testid="test-start">
              {failed ? "Try again" : motions ? "Start" : "Loading…"}
            </button>
          </div>
        )}
        {question && (
          <div className="mt-6" data-testid="test-question">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
            </div>
            <div className="mt-3 text-sm text-white/50">{index + 1} of {deck.length} · {question.tag}</div>
            <h1 className="mt-10 min-h-[9rem] font-heading text-3xl sm:text-4xl font-semibold leading-tight">{question.motion}</h1>
            <div className="h-6 text-sm text-white/70" aria-live="polite">{crowd}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => answer("for")} className="h-16 rounded-2xl text-black font-semibold text-lg" style={{ background: GREEN }} data-testid="test-agree">Agree</button>
              <button onClick={() => answer("against")} className="h-16 rounded-2xl text-black font-semibold text-lg" style={{ background: RED }} data-testid="test-disagree">Disagree</button>
              <button onClick={() => answer("skip")} className="col-span-2 h-14 rounded-2xl border border-white/25 font-medium" data-testid="test-skip">Don't care</button>
            </div>
          </div>
        )}
        {finished && <div className="mt-6"><Result result={scoreTest(answers)} onAgain={begin} /></div>}
      </main>
    </div>
  );
}
