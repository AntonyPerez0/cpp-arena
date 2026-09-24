import type { Lang } from "../compiler/client";

export type TestCase = { name: string; stdin: string; expect: string; hidden?: boolean; files?: Record<string, string>; args?: string[]; exit?: number };
export type Rule = { pattern: string; flags?: string; message: string };

export type Exercise = {
  kind: "fill" | "code";
  mode: "stdout" | "harness";
  lang: Lang;
  seed: string;
  solution: string;
  harness?: string;
  tests: TestCase[];
  checks?: number;
  hints: string[];
  require: Rule[];
  forbid: Rule[];
};

export type Step = Exercise & { id: string; title: string; text: string };

export type Module = {
  id: string;
  title: string;
  lang: Lang;
  phase: string;
  summary: string;
  steps: Step[];
};

export type Milestone = Exercise & { title: string; text: string };

export type Project = {
  id: string;
  title: string;
  lang: Lang;
  level: string;
  after: string | null;
  summary: string;
  milestones: Milestone[];
};

export type DrillType = "predict" | "fill" | "bug" | "compiles" | "boss";

export type Drill = {
  id: string;
  topic: string;
  lang: Lang;
  type: DrillType;
  prompt: string;
  display: string;
  answer: string;
  accept?: string[];
  fix?: string;
  output?: string;
  why: string;
  exercise?: Exercise;
};

export type Content = {
  generatedAt: string;
  modules: Module[];
  projects: Project[];
  drills: Drill[];
};
