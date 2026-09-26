// Tiny persistent store (localStorage) with a React hook.
import { useSyncExternalStore } from "react";

export type StepProgress = { done: boolean; code?: string; blanks?: string[]; hintsUsed: number; clean?: boolean; doneAt?: number };
export type ProjectProgress = { milestone: number; code: string; completed: number[] };
export type DrillStat = { box: number; right: number; wrong: number; last: number; due: number };
export type DmMode = "deathmatch" | "casual" | "warmup" | "interview";
export type Theme = "system" | "dark" | "light";
export type RunRecord = { at: number; mode: DmMode; streak: number; reps: number; kills: number };

export type State = {
  version: 1;
  steps: Record<string, StepProgress>;
  projects: Record<string, ProjectProgress>;
  drills: Record<string, DrillStat>;
  dm: {
    best: Record<DmMode, number>;
    runs: RunRecord[];
    reps: number;
    kills: number;
    bossKills: number;
    days: Record<string, number>;
  };
  settings: {
    sound: boolean;
    unlockAll: boolean;
    topics: string[] | null;
    boss: boolean;
    /** single-letter and number shortcuts in Deathmatch */
    keys: boolean;
    theme: Theme;
    /** Text size multiplier: 1, 1.125, 1.25 or 1.4. */
    textScale: number;
    /** Name printed on certificates. */
    certName: string;
    /** The learner's Pro Track repository on GitHub, printed on the Pro Track certificate. */
    proRepo: string;
    /** Download the compiler automatically even on mobile data (otherwise lessons ask first). */
    mobileData: boolean;
  };
  /** Pro Track projects the learner marked as passing on GitHub. */
  pro: Record<string, boolean>;
  /** Modules the placement quiz let the learner skip. */
  placed: string[];
  /** Daily challenge results by date (YYYY-MM-DD): true when answered correctly. */
  daily: Record<string, boolean>;
};

const KEY = "cpp-arena-v1";

const fresh = (): State => ({
  version: 1,
  steps: {},
  projects: {},
  drills: {},
  dm: { best: { deathmatch: 0, casual: 0, warmup: 0, interview: 0 }, runs: [], reps: 0, kills: 0, bossKills: 0, days: {} },
  settings: { sound: true, unlockAll: false, topics: null, boss: true, keys: true, theme: "system", textScale: 1, certName: "", proRepo: "", mobileData: false },
  pro: {},
  placed: [],
  daily: {},
});

/** Fill in anything an older save is missing. */
function normalize(s: Partial<State>): State {
  const f = fresh();
  return { ...f, ...s, dm: { ...f.dm, ...s.dm, best: { ...f.dm.best, ...(s.dm?.best ?? {}) } }, settings: { ...f.settings, ...s.settings } } as State;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return normalize(JSON.parse(raw));
  } catch {
    return fresh();
  }
}

let state: State = load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: progress lives for this session only */
    }
  }, 150);
}

export function getState() {
  return state;
}

export function update(fn: (s: State) => State) {
  state = fn(state);
  save();
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

export function exportProgress(): string {
  return JSON.stringify(state, null, 2);
}

/** Parse and check a progress file (JSON text). */
export function parseProgress(json: string): State {
  const s = JSON.parse(json);
  if (!s || s.version !== 1) throw new Error("Not a C/C++ Arena progress file");
  return normalize(s);
}

/**
 * Combine two saves without losing anything: a step or project done on either
 * device stays done, drill stats keep whichever side has seen more reps, and
 * bests take the maximum. Settings stay as they are on this device.
 */
export function mergeStates(a: State, b: State): State {
  const steps = { ...a.steps };
  for (const [id, x] of Object.entries(b.steps)) {
    const y = steps[id];
    if (!y) steps[id] = x;
    else {
      const newer = (x.doneAt ?? 0) > (y.doneAt ?? 0) ? x : y;
      steps[id] = { ...newer, done: x.done || y.done, hintsUsed: Math.max(x.hintsUsed, y.hintsUsed), clean: (x.done && x.clean) || (y.done && y.clean) || undefined, doneAt: Math.min(x.doneAt ?? Infinity, y.doneAt ?? Infinity) === Infinity ? undefined : Math.min(x.doneAt ?? Infinity, y.doneAt ?? Infinity) };
    }
  }
  const projects = { ...a.projects };
  for (const [id, x] of Object.entries(b.projects)) {
    const y = projects[id];
    projects[id] = !y || x.completed.length > y.completed.length ? x : y;
  }
  const drills = { ...a.drills };
  for (const [id, x] of Object.entries(b.drills)) {
    const y = drills[id];
    drills[id] = !y || x.right + x.wrong > y.right + y.wrong ? x : y;
  }
  const days = { ...a.dm.days };
  for (const [d, n] of Object.entries(b.dm.days)) days[d] = Math.max(days[d] ?? 0, n);
  const best = { ...a.dm.best };
  for (const k of Object.keys(b.dm.best) as DmMode[]) best[k] = Math.max(best[k] ?? 0, b.dm.best[k] ?? 0);
  const runs = [...a.dm.runs, ...b.dm.runs.filter((r) => !a.dm.runs.some((x) => x.at === r.at))].sort((x, y) => y.at - x.at).slice(0, 50);
  const daily = { ...a.daily };
  for (const [d, ok] of Object.entries(b.daily)) daily[d] = daily[d] || ok;
  return {
    ...a,
    steps,
    projects,
    drills,
    dm: { best, runs, days, reps: Math.max(a.dm.reps, b.dm.reps), kills: Math.max(a.dm.kills, b.dm.kills), bossKills: Math.max(a.dm.bossKills, b.dm.bossKills) },
    pro: Object.fromEntries([...new Set([...Object.keys(a.pro), ...Object.keys(b.pro)])].map((k) => [k, !!(a.pro[k] || b.pro[k])])),
    placed: [...new Set([...a.placed, ...b.placed])],
    daily,
    settings: { ...a.settings, certName: a.settings.certName || b.settings.certName, proRepo: a.settings.proRepo || b.settings.proRepo },
  };
}

/** Merge a progress file into this browser's progress. */
export function importProgress(json: string) {
  const incoming = parseProgress(json);
  update((s) => mergeStates(s, incoming));
}

export function resetProgress() {
  update(() => fresh());
}

// ------------------------------------------------------------- helpers
export function patchStep(id: string, patch: Partial<StepProgress>) {
  update((s) => ({ ...s, steps: { ...s.steps, [id]: { ...{ done: false, hintsUsed: 0 }, ...s.steps[id], ...patch } } }));
}

export function patchProject(id: string, patch: Partial<ProjectProgress>) {
  update((s) => ({ ...s, projects: { ...s.projects, [id]: { ...{ milestone: 0, code: "", completed: [] as number[] }, ...s.projects[id], ...patch } } }));
}

export function setProDone(id: string, done: boolean) {
  update((s) => ({ ...s, pro: { ...s.pro, [id]: done } }));
}

export function patchSettings(patch: Partial<State["settings"]>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export const today = () => new Date().toISOString().slice(0, 10);
