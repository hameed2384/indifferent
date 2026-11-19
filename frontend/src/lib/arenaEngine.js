/** The Arena's physics: two balls smash through spinning rings of bricks, and the
 * first one past the outer ring wins. No drawing here, and it is fully determined
 * by its seed and the taps it receives, so it can be tested without a browser. */

export const RADII = [118, 168, 218, 268, 318];
export const COUNTS = [12, 16, 20, 24, 28];
export const HALF = 9;
export const STEP = 1 / 180;
const OUTER = RADII[RADII.length - 1] + HALF + 22;
const TAU = Math.PI * 2;
const BOOST_TIME = 0.55;
const BOOST_COOLDOWN = 1;
const OPEN_OUTER_AT = 24; // the outer ring starts collapsing too, so no game drags
const CLEAR_OUTER_AT = 30;

export function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** How far the vote split tilts the fight, from -1 (all against) to 1 (all for).
 * Ten phantom votes keep a handful of real ones from deciding it. */
export function voteEdge(votesFor = 0, votesAgainst = 0) {
  return (votesFor - votesAgainst) / (votesFor + votesAgainst + 10);
}

const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

export function createFight({ seed, edge = 0 }) {
  const rand = makeRandom(seed);
  const between = (lo, hi) => lo + (hi - lo) * rand();
  const spins = RADII.map((_, i) => ({ start: between(0, TAU), rate: (i % 2 ? 1 : -1) * between(0.22, 0.42) }));
  const alive = COUNTS.map((n) => new Array(n).fill(true));
  const collapsed = new Set();
  const total = COUNTS.reduce((a, b) => a + b, 0);
  const start = between(0, TAU);
  const balls = [0, 1].map((team) => {
    const side = start + team * Math.PI;
    const aim = between(0, TAU);
    return { team, x: Math.cos(side) * 40, y: Math.sin(side) * 40, dx: Math.cos(aim), dy: Math.sin(aim), boostUntil: -1, readyAt: 0, bricks: 0 };
  });
  const fight = { t: 0, balls, alive, spins, broken: 0, total, winner: null, events: [] };

  const ringAngle = (ring) => spins[ring].start + spins[ring].rate * fight.t;
  fight.ringAngle = ringAngle;
  fight.progress = () => fight.broken / total;
  fight.radius = () => 15 + 8 * fight.progress();

  function smash(ring, i, ball, big) {
    alive[ring][i] = false;
    fight.broken += 1;
    if (ball) ball.bricks += 1;
    fight.events.push({ type: "brick", ring, i, team: ball ? ball.team : null, big, angle: ringAngle(ring) + (i + 0.5) * (TAU / COUNTS[ring]) });
  }

  function collapse(ring, ball) {
    collapsed.add(ring);
    alive[ring].forEach((on, i) => { if (on) smash(ring, i, ball, true); });
    fight.events.push({ type: "collapse", ring, team: ball ? ball.team : null });
  }

  function bounceOffBricks(b, R) {
    let d = Math.hypot(b.x, b.y);
    RADII.forEach((r, ring) => {
      if (collapsed.has(ring) || Math.abs(d - r) >= R + HALF) return;
      const count = COUNTS[ring];
      const w = TAU / count;
      const ang = Math.atan2(b.y, b.x);
      const rel = ((ang - ringAngle(ring)) % TAU + TAU) % TAU;
      const here = Math.floor(rel / w) % count;
      let found = null;
      [here, (here + count - 1) % count, (here + 1) % count].forEach((i) => {
        if (!alive[ring][i]) return;
        const lo = wrap(rel - i * w);
        const at = ang - lo + Math.max(0, Math.min(w, lo));
        const qx = r * Math.cos(at);
        const qy = r * Math.sin(at);
        const gap = Math.hypot(b.x - qx, b.y - qy);
        if (gap > 1e-6 && gap < R + HALF && (!found || gap < found.gap)) found = { gap, i, qx, qy };
      });
      if (!found) return;
      const nx = (b.x - found.qx) / found.gap;
      const ny = (b.y - found.qy) / found.gap;
      b.x += nx * (R + HALF - found.gap);
      b.y += ny * (R + HALF - found.gap);
      const along = b.dx * nx + b.dy * ny;
      if (along < 0) {
        b.dx -= 2 * along * nx;
        b.dy -= 2 * along * ny;
      }
      smash(ring, found.i, b, false);
      const left = alive[ring].filter(Boolean).length;
      const isOuter = ring === RADII.length - 1;
      if (left <= Math.ceil(count * 0.3) && (!isOuter || fight.t >= OPEN_OUTER_AT)) collapse(ring, b);
      d = Math.hypot(b.x, b.y);
    });
  }

  function collideBalls(R) {
    const [a, b] = balls;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d <= 1e-6 || d >= 2 * R) return;
    const nx = dx / d;
    const ny = dy / d;
    const push = (2 * R - d) / 2;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    const closing = (a.dx - b.dx) * nx + (a.dy - b.dy) * ny;
    if (closing > 0) {
      a.dx -= closing * nx; a.dy -= closing * ny;
      b.dx += closing * nx; b.dy += closing * ny;
    }
    fight.events.push({ type: "clash" });
  }

  /** A tap: the player's ball surges for a moment. Returns whether it fired. */
  fight.boost = (team) => {
    const b = balls[team];
    if (fight.winner !== null || fight.t < b.readyAt) return false;
    b.boostUntil = fight.t + BOOST_TIME;
    b.readyAt = fight.t + BOOST_COOLDOWN;
    fight.events.push({ type: "boost", team });
    return true;
  };

  fight.step = () => {
    fight.t += STEP;
    const p = fight.progress();
    const R = fight.radius();
    if (fight.winner !== null) {
      const w = balls[fight.winner];
      w.x += w.dx * 730 * STEP;
      w.y += w.dy * 730 * STEP;
      return;
    }
    const outerRing = RADII.length - 1;
    if (fight.t >= CLEAR_OUTER_AT && !collapsed.has(outerRing)) collapse(outerRing, null);
    balls.forEach((b) => {
      const tilt = 1 + 0.1 * edge * (b.team === 0 ? 1 : -1);
      const surge = fight.t < b.boostUntil ? 1.45 : 1;
      const speed = (430 + 300 * p) * tilt * surge;
      b.x += b.dx * speed * STEP;
      b.y += b.dy * speed * STEP;
    });
    collideBalls(R);
    for (const b of balls) {
      if (Math.hypot(b.x, b.y) > OUTER) {
        fight.winner = b.team;
        const len = Math.hypot(b.x, b.y);
        b.dx = b.x / len;
        b.dy = b.y / len;
        fight.events.push({ type: "escape", team: b.team });
        alive.forEach((row, ring) => row.forEach((on, i) => { if (on) smash(ring, i, null, true); }));
        return;
      }
      bounceOffBricks(b, R);
      const size = Math.hypot(b.dx, b.dy) || 1;
      b.dx /= size;
      b.dy /= size;
    }
  };

  fight.drainEvents = () => fight.events.splice(0, fight.events.length);
  return fight;
}
