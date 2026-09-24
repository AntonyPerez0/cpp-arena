// Tiny persistent store (localStorage) with a React hook.
import { useSyncExternalStore } from "react";

export type StepProgress = { done: boolean; code?: string; blanks?: string[]; hintsUsed: number; clean?: boolean; doneAt?: number };
export type ProjectProgress = { milestone: number; code: string; completed: number[] };
export type DrillStat = { box: number; right: number; wrong: number; last: number; due: number };
export type DmMode = "deathmatch" | "casual" | "warmup";
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
  settings: { sound: boolean; unlockAll: boolean; topics: string[] | null; boss: boolean; /** single-letter and number shortcuts in Deathmatch */ keys: boolean };
  /** Pro Track projects the learner marked as passing on GitHub. */
  pro: Record<string, boolean>;
};

const KEY = "cpp-arena-v1";

const fresh = (): State => ({
  version: 1,
  steps: {},
  projects: {},
  drills: {},
  dm: { best: { deathmatch: 0, casual: 0, warmup: 0 }, runs: [], reps: 0, kills: 0, bossKills: 0, days: {} },
  settings: { sound: true, unlockAll: false, topics: null, boss: true, keys: true },
  pro: {},
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const f = fresh();
    return { ...f, ...s, dm: { ...f.dm, ...s.dm, best: { ...f.dm.best, ...(s.dm?.best ?? {}) } }, settings: { ...f.settings, ...s.settings } };
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

export function importProgress(json: string) {
  const s = JSON.parse(json);
  if (!s || s.version !== 1) throw new Error("Not a C/C++ Arena progress file");
  update(() => ({ ...fresh(), ...s }));
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
