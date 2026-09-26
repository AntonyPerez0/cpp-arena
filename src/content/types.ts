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

/** `slug` is the step's permanent address: /learn/<module>/<slug>. */
export type Step = Exercise & { id: string; title: string; text: string; slug: string };

export type Module = {
  id: string;
  title: string;
  lang: Lang;
  phase: string;
  summary: string;
  steps: Step[];
  /** Old numbered addresses (/learn/<module>/<n>): the step id number n used to open. Only present where it differs from today's order. */
  numbered?: (string | null)[];
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

export type DrillType = "predict" | "fill" | "bug" | "compiles" | "boss" | "choice";

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
  /** Options for "choice" drills; `answer` is the 1-based index of the right one. */
  choices?: string[];
  why: string;
  exercise?: Exercise;
  /** The lesson step that teaches what this drill needs; it unlocks in Deathmatch once that step is done. */
  step?: string;
};

export type ProProject = {
  id: string;
  dir: string;
  number: number;
  title: string;
  summary: string;
  hours: number;
  skills: string[];
  readme: string;
};

export type Topic = {
  slug: string;
  title: string;
  lang: "c" | "cpp";
  description: string;
  modules: string[];
  visual: string | null;
  body: string;
  example: string;
  stdin: string;
  output: string;
  /** Uses threads: compiled and run with GCC at build time, since the browser compiler has none. */
  native?: boolean;
};

export type Content = {
  generatedAt: string;
  modules: Module[];
  projects: Project[];
  drills: Drill[];
  pro: ProProject[];
  /** Placement quiz questions, one per curriculum milestone, in order. */
  placement: (Drill & { module: string })[];
  /** Reference pages at /topics/<slug>. */
  topics: Topic[];
  /** The "Where to go next" page. */
  next: { title: string; description: string; body: string };
};
