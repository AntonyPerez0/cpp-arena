import raw from "../generated/content.json";
import type { Content, Module, Step } from "./types";

export const content = raw as unknown as Content;
export const modules = content.modules;
export const projects = content.projects;
export const drills = content.drills;
export const pro = content.pro ?? [];
export const placement = content.placement ?? [];
export const topics = content.topics ?? [];
export const nextPage = content.next;
export const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
export const proById = new Map(pro.map((p) => [p.id, p]));

export const moduleById = new Map(modules.map((m) => [m.id, m]));
export const projectById = new Map(projects.map((p) => [p.id, p]));

/** A step's address. */
export function stepPath(m: Module, step: Step) {
  return `/learn/${m.id}/${step.slug}`;
}

/** A module's first step, where "start this lesson" links go. */
export function firstStepPath(moduleId: string) {
  const m = moduleById.get(moduleId);
  return m ? stepPath(m, m.steps[0]) : "/learn";
}

/**
 * The step an address names: its slug, or an old step number (which then redirects).
 * Numbers mean what they did when numbered addresses were in use, not today's order.
 */
export function findStep(m: Module, key: string): { step: Step; numbered: boolean } | null {
  const bySlug = m.steps.find((s) => s.slug === key);
  if (bySlug) return { step: bySlug, numbered: false };
  if (!/^\d+$/.test(key)) return null;
  const n = Number(key);
  const id = m.numbered ? m.numbered[n - 1] : m.steps[n - 1]?.id;
  const step = m.steps.find((s) => s.id === id) ?? (m.numbered && n > m.numbered.length ? m.steps[n - 1] : undefined);
  return step ? { step, numbered: true } : null;
}

export const allSteps: { module: Module; step: Step; index: number }[] = modules.flatMap((m) =>
  m.steps.map((step, index) => ({ module: m, step, index })),
);

export const phases: { name: string; modules: Module[] }[] = [];
for (const m of modules) {
  let p = phases.find((x) => x.name === m.phase);
  if (!p) phases.push((p = { name: m.phase, modules: [] }));
  p.modules.push(m);
}

export const drillsByTopic = new Map<string, number>();
for (const d of drills) drillsByTopic.set(d.topic, (drillsByTopic.get(d.topic) ?? 0) + 1);
