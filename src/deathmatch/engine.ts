import type { Drill } from "../content/types";
import { moduleById } from "../content";
import { looseOutput } from "../grader/assemble.js";
import type { DmMode, DrillStat, State } from "../state/store";
import { update, today } from "../state/store";

export const BOSS_EVERY = 8;
/** Drill topic for the interview prep set (not a lesson module). */
export const INTERVIEW = "interview";

export function topicTitle(topic: string): string {
  if (topic === INTERVIEW) return "Interview prep";
  return moduleById.get(topic)?.title ?? topic;
}
const DAY = 86_400_000;
// Leitner intervals (days) for boxes 1..5
const INTERVAL = [0, 0.5, 1, 3, 7, 16];

export function lives(mode: DmMode) {
  return mode === "deathmatch" ? 1 : 3;
}

export function isDue(st: DrillStat | undefined, now = Date.now()) {
  return !!st && st.due <= now;
}

/** Instant-check a non-boss drill answer. */
export function checkAnswer(d: Drill, answer: string): boolean {
  switch (d.type) {
    case "predict":
      return looseOutput(answer) === looseOutput(d.answer);
    case "fill": {
      const norm = (s: string) => s.replace(/\s+/g, "");
      return (d.accept ?? [d.answer]).some((a) => norm(a) === norm(answer));
    }
    case "bug":
    case "compiles":
    case "choice":
      return answer.trim().toLowerCase() === d.answer;
    default:
      return false;
  }
}

/**
 * Choose the next rep. Weighted toward drills in low Leitner boxes (the ones
 * you miss), avoids recent repeats, and mixes in a compiled boss rep every
 * BOSS_EVERY reps when enabled.
 */
export function pickNext(pool: Drill[], s: State, recent: string[], repNo: number, bossOn: boolean, mode: DmMode): Drill | null {
  const now = Date.now();
  const bosses = pool.filter((d) => d.type === "boss");
  const quick = pool.filter((d) => d.type !== "boss");
  const wantBoss = bossOn && bosses.length > 0 && repNo > 0 && repNo % BOSS_EVERY === BOSS_EVERY - 1;
  let candidates = wantBoss ? bosses : quick.length ? quick : bosses;
  if (mode === "warmup") {
    const due = candidates.filter((d) => isDue(s.drills[d.id], now) && !recent.includes(d.id));
    return due.length ? due[Math.floor(Math.random() * due.length)] : null;
  }
  const avoid = new Set(recent.slice(-Math.min(12, Math.floor(candidates.length / 2))));
  const fresh = candidates.filter((d) => !avoid.has(d.id));
  if (fresh.length) candidates = fresh;
  const weights = candidates.map((d) => {
    const st = s.drills[d.id];
    if (!st) return 4; // unseen: fairly likely
    const box = st.box;
    let w = 6 - box; // box 1 -> 5, box 5 -> 1
    if (st.due <= now) w += 2;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1] ?? null;
}

export function recordRep(d: Drill, correct: boolean) {
  update((s) => {
    const prev = s.drills[d.id] ?? { box: 1, right: 0, wrong: 0, last: 0, due: 0 };
    const box = correct ? Math.min(5, prev.box + (prev.right + prev.wrong === 0 ? 2 : 1)) : 1;
    const st: DrillStat = {
      box,
      right: prev.right + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
      last: Date.now(),
      due: Date.now() + INTERVAL[box] * DAY,
    };
    const day = today();
    return {
      ...s,
      drills: { ...s.drills, [d.id]: st },
      dm: {
        ...s.dm,
        reps: s.dm.reps + 1,
        kills: s.dm.kills + (correct ? 1 : 0),
        bossKills: s.dm.bossKills + (correct && d.type === "boss" ? 1 : 0),
        days: { ...s.dm.days, [day]: (s.dm.days[day] ?? 0) + 1 },
      },
    };
  });
}

export function recordRun(mode: DmMode, streak: number, reps: number, kills: number) {
  update((s) => ({
    ...s,
    dm: {
      ...s.dm,
      best: { ...s.dm.best, [mode]: Math.max(s.dm.best[mode], mode === "warmup" ? kills : streak) },
      runs: [{ at: Date.now(), mode, streak, reps, kills }, ...s.dm.runs].slice(0, 50),
    },
  }));
}

export const TYPE_LABEL: Record<Drill["type"], string> = {
  predict: "Predict the output",
  fill: "Fill the blank",
  bug: "Spot the bug",
  compiles: "Will it compile?",
  boss: "Boss rep",
  choice: "Pick one",
};

export function callout(streak: number): string | null {
  const map: Record<number, string> = {
    3: "TRIPLE",
    5: "ACE",
    10: "ON FIRE",
    15: "DOMINATING",
    20: "RAMPAGE",
    25: "UNSTOPPABLE",
    35: "GODLIKE",
    50: "LEGENDARY",
    75: "BEYOND LEGENDARY",
    100: "GLOBAL ELITE",
  };
  return map[streak] ?? (streak > 100 && streak % 25 === 0 ? `${streak} STREAK` : null);
}

// ------------------------------------------------------------- sound
let ctx: AudioContext | null = null;
export function blip(kind: "hit" | "miss" | "boss" | "streak") {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const cfg = {
      hit: { f: 880, f2: 1320, d: 0.09, type: "square" as OscillatorType, v: 0.05 },
      boss: { f: 520, f2: 1560, d: 0.25, type: "sawtooth" as OscillatorType, v: 0.05 },
      streak: { f: 660, f2: 1760, d: 0.3, type: "triangle" as OscillatorType, v: 0.08 },
      miss: { f: 180, f2: 90, d: 0.35, type: "sawtooth" as OscillatorType, v: 0.07 },
    }[kind];
    o.type = cfg.type;
    o.frequency.setValueAtTime(cfg.f, t);
    o.frequency.exponentialRampToValueAtTime(cfg.f2, t + cfg.d);
    g.gain.setValueAtTime(cfg.v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.d);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + cfg.d + 0.02);
  } catch {
    /* no audio */
  }
}
