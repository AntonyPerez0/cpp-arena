import { allSteps, drills, modules } from "../content";
import type { State } from "./store";

export function moduleProgress(s: State, moduleId: string) {
  const m = modules.find((x) => x.id === moduleId);
  if (!m) return { done: 0, total: 0 };
  return { done: m.steps.filter((st) => s.steps[st.id]?.done).length, total: m.steps.length };
}

/** Topics (module ids) available in Deathmatch: any module with a finished step. */
export function unlockedTopics(s: State): string[] {
  if (s.settings.unlockAll) return modules.map((m) => m.id);
  return modules.filter((m) => m.steps.some((st) => s.steps[st.id]?.done)).map((m) => m.id);
}

export function nextStep(s: State) {
  return allSteps.find(({ step }) => !s.steps[step.id]?.done) ?? null;
}

export function totals(s: State) {
  const done = allSteps.filter(({ step }) => s.steps[step.id]?.done).length;
  return { done, total: allSteps.length };
}

export const RANKS = [
  { name: "Silver I", at: 0 },
  { name: "Silver II", at: 3 },
  { name: "Silver III", at: 5 },
  { name: "Silver IV", at: 7 },
  { name: "Silver Elite", at: 10 },
  { name: "Silver Elite Master", at: 13 },
  { name: "Gold Nova I", at: 16 },
  { name: "Gold Nova II", at: 20 },
  { name: "Gold Nova III", at: 24 },
  { name: "Gold Nova Master", at: 28 },
  { name: "Master Guardian I", at: 33 },
  { name: "Master Guardian II", at: 38 },
  { name: "Master Guardian Elite", at: 44 },
  { name: "Distinguished Master Guardian", at: 50 },
  { name: "Legendary Eagle", at: 60 },
  { name: "Legendary Eagle Master", at: 75 },
  { name: "Supreme Master First Class", at: 90 },
  { name: "The Global Elite", at: 110 },
];

export function rankFor(bestStreak: number) {
  let i = 0;
  while (i + 1 < RANKS.length && bestStreak >= RANKS[i + 1].at) i++;
  return { index: i, rank: RANKS[i], next: RANKS[i + 1] ?? null };
}

export function dailyStreak(days: Record<string, number>) {
  let n = 0;
  const d = new Date();
  // Today counts if played; otherwise start counting from yesterday.
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if ((days[key(d)] ?? 0) < 20) d.setDate(d.getDate() - 1);
  while ((days[key(d)] ?? 0) >= 20) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function topicStats(s: State) {
  const map = new Map<string, { right: number; wrong: number }>();
  for (const d of drills) {
    const st = s.drills[d.id];
    if (!st) continue;
    const t = map.get(d.topic) ?? { right: 0, wrong: 0 };
    t.right += st.right;
    t.wrong += st.wrong;
    map.set(d.topic, t);
  }
  return map;
}
