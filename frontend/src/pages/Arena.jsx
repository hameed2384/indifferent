import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/api";
import { COUNTS, HALF, RADII, STEP, createFight, makeRandom, seedFrom, voteEdge } from "@/lib/arenaEngine";
import { usePageMeta, useStartRound } from "@/pages/Motions";

const GREEN = "#3ae4a4";
const RED = "#ff5c7a";
const TEAM = [GREEN, RED];
const RING_COLOURS = ["#ff9d6c", "#ffe066", "#b8f25a", "#5cf2c0", "#62b8ff"];
const VIEW = 372; // half the width of the world the canvas shows
const SCALE_NOTES = [0, 3, 5, 7, 10];

function store(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch { /* private browsing: the game still works, it just forgets */ }
  return null;
}

export function voterId() {
  let id = store("arena-voter");
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    store("arena-voter", id);
  }
  return id;
}

/** Small synthesised sounds, so nothing needs downloading or licensing. */
function makeSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return { play() {}, close() {}, muted: true };
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  let count = 0;
  let last = 0;
  const tone = (freq, length, level, type = "sine") => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + length);
  };
  return {
    muted: false,
    play(kind) {
      if (this.muted) return;
      if (kind === "brick") {
        if (ctx.currentTime - last < 0.05) return;
        last = ctx.currentTime;
        count += 1;
        const step = count % 15;
        tone(220 * 2 ** ((SCALE_NOTES[step % 5] + 12 * Math.floor(step / 5)) / 12), 0.3, 0.16);
      } else if (kind === "collapse") tone(80, 0.5, 0.5, "triangle");
      else if (kind === "boost") tone(520, 0.14, 0.08, "triangle");
      else if (kind === "escape") { tone(110, 0.9, 0.6, "triangle"); tone(660, 0.8, 0.14); tone(990, 1, 0.1); }
    },
    close() { ctx.close().catch(() => {}); },
  };
}

function FightCanvas({ motion, side, soundRef, onDone }) {
  const canvasRef = useRef(null);
  const fightRef = useRef(null);
  const mine = side === "for" ? 0 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas.getContext("2d");
    const seed = seedFrom(`${motion.slug}:${Date.now()}`);
    const fight = createFight({ seed, edge: voteEdge(motion.votes_for, motion.votes_against) });
    fightRef.current = fight;
    const rand = makeRandom(seed ^ 77);

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      while (fight.winner === null) fight.step();
      onDone(fight);
      return undefined;
    }

    const shards = [];
    const shocks = [];
    const trails = [[], []];
    let raf;
    let last = performance.now();
    let spare = 0;
    let finishedAt = null;
    let doneSent = false;

    const fit = () => {
      const size = canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size;
      canvas.height = size;
    };
    fit();
    window.addEventListener("resize", fit);

    const handle = (e) => {
      if (e.type === "brick") {
        const r = RADII[e.ring];
        const w = (Math.PI * 2) / COUNTS[e.ring];
        for (let k = -1; k <= 1; k += 1) {
          const a = e.angle + (k * w) / 3;
          const out = (70 + rand() * 160) * (e.big ? 1.7 : 1);
          shards.push({ x: r * Math.cos(a), y: r * Math.sin(a), vx: Math.cos(a) * out + (rand() - 0.5) * 100, vy: Math.sin(a) * out - rand() * 60,
            a: rand() * 6, spin: (rand() - 0.5) * 18, size: 6 + rand() * 5, ring: e.ring, age: 0, life: 0.7 + rand() * 0.45 });
        }
        soundRef.current?.play("brick");
      } else if (e.type === "collapse") {
        shocks.push({ r: RADII[e.ring], team: e.team, age: 0 });
        soundRef.current?.play("collapse");
      } else if (e.type === "boost" || e.type === "escape") {
        soundRef.current?.play(e.type);
        if (e.type === "escape") shocks.push({ r: 120, team: e.team, age: 0 });
      }
    };

    const draw = (dt) => {
      const k = canvas.width / (VIEW * 2);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2);
      g.lineCap = "butt";
      RADII.forEach((r, ring) => {
        const w = (Math.PI * 2) / COUNTS[ring];
        const a = fight.ringAngle(ring);
        g.strokeStyle = RING_COLOURS[ring];
        g.shadowColor = RING_COLOURS[ring];
        g.shadowBlur = 14;
        g.lineWidth = HALF * 2;
        g.beginPath();
        fight.alive[ring].forEach((on, i) => {
          if (!on) return;
          const from = a + i * w + 0.016;
          g.moveTo(r * Math.cos(from), r * Math.sin(from));
          g.arc(0, 0, r, from, a + (i + 1) * w - 0.016);
        });
        g.stroke();
      });
      g.shadowBlur = 0;
      for (let i = shocks.length - 1; i >= 0; i -= 1) {
        const s = shocks[i];
        s.age += dt;
        const p = s.age / 0.5;
        if (p >= 1) { shocks.splice(i, 1); continue; }
        g.globalAlpha = 1 - p;
        g.strokeStyle = s.team === null ? "#8892a6" : TEAM[s.team];
        g.lineWidth = 9 * (1 - p) + 1;
        g.beginPath();
        g.arc(0, 0, s.r + 70 * p, 0, Math.PI * 2);
        g.stroke();
      }
      for (let i = shards.length - 1; i >= 0; i -= 1) {
        const s = shards[i];
        s.age += dt;
        if (s.age >= s.life) { shards.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; s.a += s.spin * dt;
        g.globalAlpha = Math.min(1, (1 - s.age / s.life) * 1.6);
        g.fillStyle = s.age < 0.1 ? "#fff" : RING_COLOURS[s.ring];
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.a);
        g.fillRect(-s.size, -s.size * 0.4, s.size * 2, s.size * 0.8);
        g.restore();
      }
      const R = fight.radius();
      fight.balls.forEach((b) => {
        const loserGone = fight.winner !== null && b.team !== fight.winner;
        const trail = trails[b.team];
        trail.push([b.x, b.y]);
        if (trail.length > 9) trail.shift();
        if (loserGone) {
          const fade = Math.max(0, 1 - (fight.t - finishedAt) / 0.25);
          if (fade <= 0) return;
          g.globalAlpha = fade;
        } else g.globalAlpha = 1;
        const base = g.globalAlpha;
        g.fillStyle = TEAM[b.team];
        trail.forEach(([x, y], i) => {
          g.globalAlpha = base * 0.3 * ((i + 1) / trail.length);
          g.beginPath();
          g.arc(x, y, R * (0.4 + (0.55 * i) / trail.length), 0, Math.PI * 2);
          g.fill();
        });
        g.globalAlpha = base;
        g.shadowColor = TEAM[b.team];
        g.shadowBlur = fight.t < b.boostUntil ? 42 : 22;
        g.beginPath();
        g.arc(b.x, b.y, R, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(b.x, b.y, b.team === mine ? R * 0.42 : R * 0.2, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spare += dt;
      while (spare >= STEP) {
        fight.step();
        spare -= STEP;
        fight.drainEvents().forEach(handle);
      }
      if (fight.winner !== null && finishedAt === null) finishedAt = fight.t;
      draw(dt);
      if (finishedAt !== null && fight.t - finishedAt > 1.2 && !doneSent) {
        doneSent = true;
        onDone(fight);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
    // A fight runs once per mount; the parent remounts it for a rematch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = () => fightRef.current?.boost(mine);
  return (
    <button
      type="button"
      onPointerDown={tap}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); } }}
      className="block w-full max-w-[520px] mx-auto aspect-square touch-manipulation select-none outline-none"
      aria-label="Boost your ball"
      data-testid="arena-canvas"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </button>
  );
}

function Result({ motion, side, fight, votes, onNext, onAgain }) {
  const { busy, start } = useStartRound();
  const mine = side === "for" ? 0 : 1;
  const won = fight.winner === mine;
  const total = votes ? votes.votes_for + votes.votes_against : 0;
  const pct = total ? Math.round(((side === "for" ? votes.votes_for : votes.votes_against) / total) * 100) : null;
  const streak = Number(store("arena-streak") || 0);

  const share = async () => {
    const url = `${window.location.origin}/arena/${motion.slug}`;
    const text = `"${motion.motion}": I picked ${side.toUpperCase()} and ${won ? "broke out first" : "got smashed"}. Pick your side:`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied");
      }
    } catch { /* the visitor closed the share sheet */ }
  };

  return (
    <div className="max-w-md mx-auto text-center" data-testid="arena-result">
      <div className="text-3xl sm:text-4xl font-heading font-semibold" style={{ color: won ? TEAM[mine] : "#fff" }}>
        {won ? "Your side broke out" : "The other side got out first"}
      </div>
      <p className="mt-2 text-white/60 text-sm">
        {fight.balls[mine].bricks} bricks smashed by your ball{streak > 1 ? ` · ${streak} wins in a row` : ""}
      </p>
      {pct !== null && (
        <p className="mt-3 text-white/85">
          {pct}% of the {total.toLocaleString()} {total === 1 ? "person" : "people"} who voted here picked {side}.
        </p>
      )}
      <div className="mt-6 grid gap-3">
        <button onClick={onNext} className="h-12 rounded-xl bg-white text-black font-semibold" data-testid="arena-next">Next debate</button>
        <button onClick={() => start(motion.id, side)} disabled={busy} className="h-12 rounded-xl border border-white/30 font-medium disabled:opacity-50">
          Defend your side against the AI
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={share} className="h-11 rounded-xl border border-white/15 text-white/85 text-sm">Challenge a friend</button>
          <button onClick={onAgain} className="h-11 rounded-xl border border-white/15 text-white/85 text-sm">Play again</button>
        </div>
      </div>
      <Link to={`/motions/${motion.slug}`} className="inline-block mt-5 text-sm text-white/55 underline underline-offset-4">
        Read the best arguments on both sides
      </Link>
    </div>
  );
}

/** /arena/:slug: pick a side, then your ball fights for it. */
export function ArenaGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [motion, setMotion] = useState(null);
  const [missing, setMissing] = useState(false);
  const [side, setSide] = useState(null);
  const [fight, setFight] = useState(null);
  const [votes, setVotes] = useState(null);
  const [round, setRound] = useState(0);
  const [muted, setMuted] = useState(store("arena-muted") === "1");
  const soundRef = useRef(null);

  usePageMeta(
    motion ? `${motion.motion}: pick a side in the Arena | indifferent` : null,
    motion ? `Pick a side on "${motion.motion}" and watch your ball smash its way out. Free, no sign-up.` : null,
  );

  useEffect(() => {
    let alive = true;
    setMotion(null); setMissing(false); setSide(null); setFight(null); setVotes(null);
    api.get(`/public/arena/${encodeURIComponent(slug)}`)
      .then(({ data }) => alive && setMotion(data))
      .catch(() => alive && setMissing(true));
    window.scrollTo(0, 0);
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => () => soundRef.current?.close(), []);

  const pick = (choice) => {
    if (!soundRef.current) soundRef.current = makeSound(); // browsers only allow sound after a tap
    soundRef.current.muted = muted;
    setSide(choice);
    api.post(`/public/arena/${encodeURIComponent(slug)}/vote`, { side: choice, voter_id: voterId() })
      .then(({ data }) => setVotes(data))
      .catch(() => {}); // the game shouldn't stop because a vote didn't save
  };

  const finish = useCallback((done) => {
    const won = done.winner === (side === "for" ? 0 : 1);
    store("arena-streak", String(won ? Number(store("arena-streak") || 0) + 1 : 0));
    setFight(done);
  }, [side]);

  const next = async () => {
    try {
      const { data } = await api.get("/public/motions");
      const others = data.motions.filter((m) => m.slug !== slug);
      navigate(`/arena/${others[Math.floor(Math.random() * others.length)].slug}`);
    } catch { toast.error("Couldn't load the next debate."); }
  };

  const toggleMute = () => {
    const value = !muted;
    setMuted(value);
    store("arena-muted", value ? "1" : "0");
    if (soundRef.current) soundRef.current.muted = value;
  };

  return (
    <div className="min-h-screen bg-[#090a10] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between">
        <Link to="/" className="font-heading font-semibold">indifferent</Link>
        <button onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="p-2 text-white/70">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-10">
        {missing && (
          <div className="text-center mt-16">
            <h1 className="text-2xl font-heading font-semibold">That debate doesn't exist</h1>
            <Link to="/arena" className="inline-block mt-4 underline underline-offset-4">Play another</Link>
          </div>
        )}
        {!motion && !missing && <div className="text-center mt-16 text-white/50 text-sm">Loading…</div>}
        {motion && (
          <>
            <h1 className="text-center font-heading font-semibold text-2xl sm:text-3xl leading-tight mt-2 mb-4" data-testid="arena-motion">{motion.motion}</h1>
            {!side && (
              <div className="max-w-md mx-auto mt-10 text-center">
                <p className="text-white/65">Pick a side. Your ball smashes through the rings for it, and the first one out wins.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button onClick={() => pick("for")} className="h-16 rounded-2xl font-semibold text-lg text-black" style={{ background: GREEN }} data-testid="arena-for">For</button>
                  <button onClick={() => pick("against")} className="h-16 rounded-2xl font-semibold text-lg text-black" style={{ background: RED }} data-testid="arena-against">Against</button>
                </div>
                <p className="mt-4 text-xs text-white/45">Free, no sign-up. Your vote is counted anonymously.</p>
              </div>
            )}
            {side && !fight && (
              <>
                <p className="text-center text-sm text-white/70">
                  You're the <span style={{ color: TEAM[side === "for" ? 0 : 1] }}>{side === "for" ? "green" : "red"}</span> ball. Tap to surge.
                </p>
                <FightCanvas key={round} motion={motion} side={side} soundRef={soundRef} onDone={finish} />
              </>
            )}
            {side && fight && (
              <div className="mt-8">
                <Result motion={motion} side={side} fight={fight} votes={votes}
                  onNext={next} onAgain={() => { setFight(null); setRound((r) => r + 1); }} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** /arena: drops the visitor straight into a random debate. */
export function ArenaStart() {
  const [slug, setSlug] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api.get("/public/motions")
      .then(({ data }) => setSlug(data.motions[Math.floor(Math.random() * data.motions.length)].slug))
      .catch(() => setFailed(true));
  }, []);
  if (slug) return <Navigate to={`/arena/${slug}`} replace />;
  return (
    <div className="min-h-screen bg-[#090a10] text-white/60 grid place-items-center text-sm">
      {failed ? "The Arena couldn't load. Try again in a moment." : "Loading…"}
    </div>
  );
}
