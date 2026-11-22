import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { LEVELS, UNLOCK, level, loadSwipes, nextTakes, position, saveSwipes, shareText, withMe } from "@/lib/swipe";
import { usePageMeta } from "@/pages/Motions";

const GREEN = "#3ae4a4";
const RED = "#ff5c7a";
const PATH = "/swipe";

function Bar({ value, color = GREEN, track = "rgba(255,255,255,.1)" }) {
  return (
    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: track }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, value)}%`, background: color }} />
    </div>
  );
}

async function share(p) {
  const url = `${window.location.origin}${PATH}`;
  const text = shareText(p);
  try {
    if (navigator.share) await navigator.share({ text, url });
    else { await navigator.clipboard.writeText(`${text} ${url}`); toast.success("Copied, paste it anywhere"); }
  } catch { /* closed the share sheet */ }
}

/** The draggable top card. */
function Card({ take, onSwipe, disabled }) {
  const ref = useRef(null);
  const start = useRef(null);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState(0);

  const fly = useCallback((dir) => {
    setFlying(dir);
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => onSwipe(dir), 220);
  }, [onSwipe]);

  useEffect(() => {
    const key = (e) => {
      if (disabled) return;
      if (e.key === "ArrowRight") fly(1);
      if (e.key === "ArrowLeft") fly(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [fly, disabled]);

  // the buttons below the card swipe it too
  useEffect(() => { if (ref.current) ref.current.fly = fly; }, [fly]);

  const x = flying ? flying * 700 : dx;
  return (
    <div
      ref={ref}
      id="swipe-top"
      className="absolute inset-0 rounded-[28px] p-7 flex flex-col justify-center select-none touch-none cursor-grab border border-white/10"
      style={{
        background: "linear-gradient(160deg,#1b1e2b,#11131c)",
        transform: `translateX(${x}px) rotate(${x / 18}deg)`,
        transition: start.current ? "none" : "transform .25s ease",
        boxShadow: "0 18px 50px rgba(0,0,0,.45)",
      }}
      onPointerDown={(e) => { if (disabled || flying) return; start.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (start.current != null) setDx(e.clientX - start.current); }}
      onPointerUp={() => {
        if (start.current == null) return;
        start.current = null;
        if (Math.abs(dx) > Math.min(120, window.innerWidth * 0.25)) fly(dx > 0 ? 1 : -1);
        else setDx(0);
      }}
      onPointerCancel={() => { start.current = null; setDx(0); }}
      data-testid="swipe-card"
    >
      <span className="absolute top-6 left-6 rounded-xl border-4 px-3 py-1 text-2xl font-extrabold tracking-wider -rotate-12"
        style={{ color: GREEN, borderColor: GREEN, opacity: Math.max(0, Math.min(1, (flying > 0 ? 120 : dx) / 90)) }}>AGREE</span>
      <span className="absolute top-6 right-6 rounded-xl border-4 px-3 py-1 text-2xl font-extrabold tracking-wider rotate-12"
        style={{ color: RED, borderColor: RED, opacity: Math.max(0, Math.min(1, (flying < 0 ? 120 : -dx) / 90)) }}>NOPE</span>
      <span className="self-start rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 mb-5">{take.tag}</span>
      <p className="font-heading font-bold leading-snug whitespace-pre-line" style={{ fontSize: "clamp(24px,6.6vw,34px)" }}>{take.text}</p>
    </div>
  );
}

function Position({ p, onClose }) {
  const lv = p.level;
  return (
    <div className="fixed inset-0 z-50 bg-[#090a10] overflow-y-auto" data-testid="swipe-position">
      <div className="max-w-xl mx-auto px-5 pt-6 pb-16">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/55">Your position · {p.n} swipes</span>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-white/80" data-testid="swipe-keep">Keep swiping</button>
        </div>
        <p className="mt-8 text-xs uppercase tracking-[.2em] text-white/50">{lv.current.name} · {p.confidence}% sure</p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold">{p.type.title}</h1>
        <p className="mt-2 text-white/75 text-lg">{p.type.line}</p>

        <div className="mt-8 grid gap-5">
          <div>
            <div className="flex justify-between text-sm mb-2"><span>Agrees with takes</span><b>{p.yes}%</b></div>
            <Bar value={p.yes} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2"><span>Goes against the crowd</span><b>{p.against == null ? "…" : `${p.against}%`}</b></div>
            {p.against == null
              ? <p className="text-sm text-white/50">Not enough people have swiped your takes yet. This fills in as more people swipe.</p>
              : <Bar value={p.against} color={RED} />}
          </div>
        </div>

        {p.topics.length > 0 && (
          <section className="mt-10">
            <h2 className="font-heading text-xl font-bold">Topic by topic</h2>
            <div className="mt-4 grid gap-3">
              {p.topics.map((t) => (
                <div key={t.tag} className="rounded-2xl bg-white/[.05] p-4">
                  <div className="flex justify-between items-baseline">
                    <b>{t.tag}</b><span className="text-sm text-white/55">{t.count} swipes · agrees {t.yes}%</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: t.withCrowd == null ? "rgba(255,255,255,.5)" : t.withCrowd <= 40 ? RED : t.withCrowd >= 60 ? GREEN : "#fbbf24" }}>{t.label}{t.withCrowd != null ? ` · ${t.withCrowd}% of people side with you` : ""}</p>
                </div>
              ))}
              {p.hiddenTopics > 0 && <p className="text-sm text-white/50">+{p.hiddenTopics} more topics unlock as you swipe.</p>}
            </div>
          </section>
        )}

        {(p.rebelZone || p.comfortZone) && (
          <section className="mt-10 grid grid-cols-2 gap-3">
            {p.rebelZone && <div className="rounded-2xl p-4" style={{ background: "rgba(255,92,122,.12)" }}><p className="text-xs uppercase tracking-wider text-white/60">Rebel zone</p><b className="text-lg">{p.rebelZone.tag}</b></div>}
            {p.comfortZone && <div className="rounded-2xl p-4" style={{ background: "rgba(58,228,164,.12)" }}><p className="text-xs uppercase tracking-wider text-white/60">Comfort zone</p><b className="text-lg">{p.comfortZone.tag}</b></div>}
          </section>
        )}

        {p.rarest && (
          <section className="mt-10 rounded-2xl bg-white/[.05] p-5">
            <p className="text-xs uppercase tracking-wider text-white/55">Your rarest opinion</p>
            <p className="mt-2 font-heading text-xl font-bold whitespace-pre-line">{p.rarest.text}</p>
            <p className="mt-2 text-sm" style={{ color: RED }}>You {p.rarest.v === 1 ? "agreed" : "disagreed"}. Only {Math.round(p.rarest.with * 100)}% of people did.</p>
          </section>
        )}

        {p.hills.length > 0 && (
          <section className="mt-10">
            <h2 className="font-heading text-xl font-bold">Hills you'd die on</h2>
            <div className="mt-4 grid gap-3">
              {p.hills.map((h) => (
                <div key={h.id} className="rounded-2xl bg-white/[.05] p-4">
                  <span className="text-xs text-white/50">{h.tag}</span>
                  <p className="font-semibold whitespace-pre-line">{h.text}</p>
                  <p className="text-sm text-white/55">You {h.v === 1 ? "agree" : "disagree"} · {Math.round(h.with * 100)}% with you</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 rounded-2xl border border-white/10 p-5">
          {lv.next
            ? <><p className="font-semibold">Next: {lv.next.name} in {lv.toNext} swipes</p><p className="text-sm text-white/60 mt-1">Adds {lv.next.adds}.</p></>
            : <p className="font-semibold">Fully mapped. Every swipe still sharpens it.</p>}
        </div>

        <div className="mt-6 grid gap-3">
          <button type="button" onClick={() => share(p)} className="h-14 rounded-2xl bg-white text-black font-semibold text-lg" data-testid="swipe-share">Share my position</button>
          <Link to="/try" className="h-14 rounded-2xl border border-white/20 font-semibold text-lg grid place-items-center">Defend it in a live debate</Link>
          <button type="button" onClick={onClose} className="h-12 text-white/70 font-semibold">Keep swiping</button>
        </div>
      </div>
    </div>
  );
}

export default function Swipe() {
  usePageMeta("Swipe: agree or nope? | indifferent",
    "Endless hot takes. Swipe right to agree, left to disagree, see how everyone else swiped, and unlock your position after 30.");
  const [catalog, setCatalog] = useState(null);
  const [failed, setFailed] = useState(false);
  const [swipes, setSwipes] = useState(loadSwipes);
  const [queue, setQueue] = useState([]);
  const [last, setLast] = useState(null);
  const [showPos, setShowPos] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    api.get("/public/swipe/takes").then(({ data }) => {
      setCatalog(data.takes);
      setQueue(nextTakes(data.takes, loadSwipes().map((s) => s.id)));
    }).catch(() => setFailed(true));
  }, []);

  const pos = useMemo(() => position(swipes), [swipes]);
  const lv = level(swipes.length);
  const take = queue[0];

  const swipe = useCallback(async (v) => {
    if (busy.current || !take) return;
    if (v === 0) { setQueue((q) => [...q.slice(1), q[0]]); return; }  // skip: it comes back later, doesn't count
    busy.current = true;
    const entry = { id: take.id, text: take.text, tag: take.tag, v, with: null, at: Date.now() };
    const next = [...swipes, entry];
    setSwipes(next);
    saveSwipes(next);
    setQueue((q) => q.slice(1));
    if (next.length === UNLOCK) setTimeout(() => setShowPos(true), 600);
    else if (LEVELS.some((l) => l.at === next.length)) toast.success(`Level up: ${level(next.length).current.name}. Your position just got sharper.`);
    busy.current = false;
    try {
      const { data } = await api.post("/public/swipe/vote", { id: take.id, v });
      const w = withMe(data.agree, data.disagree, v);
      setLast({ take, v, w, agree: data.agree, disagree: data.disagree });
      setSwipes((cur) => {
        const upd = cur.map((s) => (s.id === take.id && s.with == null && s.v === v ? { ...s, with: w } : s));
        saveSwipes(upd);
        return upd;
      });
    } catch {
      setLast({ take, v, w: null, agree: 0, disagree: 0 });
    }
  }, [take, swipes]);

  const flyTop = (dir) => {
    const el = document.getElementById("swipe-top");
    if (el?.fly) el.fly(dir);
  };

  const total = last ? last.agree + last.disagree : 0;
  return (
    <div className="min-h-[100dvh] bg-[#090a10] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between max-w-xl w-full mx-auto">
        <Link to="/" className="font-heading font-semibold">indifferent</Link>
        <button type="button" onClick={() => pos && setShowPos(true)}
          className={`text-sm font-semibold rounded-full px-3 py-1.5 ${pos ? "bg-white text-black" : "bg-white/10 text-white/60"}`} data-testid="swipe-open-position">
          {pos ? "Your position" : `Position unlocks in ${UNLOCK - swipes.length}`}
        </button>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-6 flex flex-col">
        <div className="mb-3">
          {pos
            ? <p className="text-xs text-white/55">{swipes.length} swipes · {lv.current.name}{lv.next ? ` · next level in ${lv.toNext}` : ""}</p>
            : <><p className="text-xs text-white/55 mb-1.5">{swipes.length} / {UNLOCK} to unlock your position</p><Bar value={(swipes.length / UNLOCK) * 100} /></>}
        </div>

        <div className="relative flex-1 min-h-[340px]">
          {failed && <p className="absolute inset-0 grid place-items-center text-white/60">Couldn't load the takes. Refresh to try again.</p>}
          {!failed && !catalog && <div className="absolute inset-0 rounded-[28px] bg-white/[.04] animate-pulse" />}
          {catalog && !take && (
            <div className="absolute inset-0 grid place-items-center text-center px-6">
              <div><p className="font-heading text-2xl font-bold">You've swiped every take</p><p className="text-white/60 mt-2">New ones land every week.</p></div>
            </div>
          )}
          {queue[1] && <div className="absolute inset-0 rounded-[28px] bg-[#151823] border border-white/5 scale-[.95] translate-y-3" />}
          {take && <Card key={take.id} take={take} onSwipe={swipe} disabled={showPos} />}
        </div>

        <div className="h-16 mt-3 text-sm" aria-live="polite" data-testid="swipe-result">
          {last && (last.w == null
            ? <p className="text-white/55">You're one of the first to swipe that one.</p>
            : <>
              <p><b style={{ color: last.w >= 0.5 ? GREEN : RED }}>{Math.round(last.w * 100)}%</b> of people {last.v === 1 ? "agree" : "disagree"} with you <span className="text-white/45">· {total.toLocaleString()} swipes</span></p>
              <div className="mt-1.5 flex h-1.5 rounded-full overflow-hidden"><div style={{ width: `${(last.agree / total) * 100}%`, background: GREEN }} /><div className="flex-1" style={{ background: RED }} /></div>
            </>)}
          {last?.take.slug && <Link to={`/motions/${last.take.slug}`} className="text-xs text-white/60 underline mt-1 inline-block">Argue that one live →</Link>}
        </div>

        <div className="flex items-center justify-center gap-6 pt-2">
          <button type="button" aria-label="Disagree" onClick={() => flyTop(-1)} disabled={!take}
            className="w-[72px] h-[72px] rounded-full bg-white/[.07] grid place-items-center active:scale-95 disabled:opacity-30" data-testid="swipe-no">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke={RED} strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <button type="button" aria-label="Skip" onClick={() => swipe(0)} disabled={!take}
            className="w-12 h-12 rounded-full bg-white/[.07] grid place-items-center text-xs text-white/60 active:scale-95 disabled:opacity-30" data-testid="swipe-skip">Skip</button>
          <button type="button" aria-label="Agree" onClick={() => flyTop(1)} disabled={!take}
            className="w-[72px] h-[72px] rounded-full bg-white/[.07] grid place-items-center active:scale-95 disabled:opacity-30" data-testid="swipe-yes">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
          </button>
        </div>
      </main>
      {showPos && pos && <Position p={pos} onClose={() => setShowPos(false)} />}
    </div>
  );
}
