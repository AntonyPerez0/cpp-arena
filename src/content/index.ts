import raw from "../generated/content.json";
import type { Content, Module, Step } from "./types";

export const content = raw as unknown as Content;
export const modules = content.modules;
export const projects = content.projects;
export const drills = content.drills;

export const moduleById = new Map(modules.map((m) => [m.id, m]));
export const projectById = new Map(projects.map((p) => [p.id, p]));

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
