import raw from "../generated/visuals.json";

export type VisualMeta = {
  id: string;
  title: string;
  lang: "c" | "cpp";
  module: string;
  /** Lesson steps that link to this visualization. */
  steps: string[];
  summary: string;
  text: string;
  code: string;
  stepCount: number;
  out: string;
};

/** A value as recorded by scripts/trace/tracer.py. */
export type TraceValue = {
  id?: string;
  t: string;
  k: "val" | "ptr" | "ref" | "arr" | "struct" | "text";
  v?: string;
  /** Text a char pointer or char array holds. */
  s?: string;
  /** Id of the value this pointer or reference points at. */
  to?: string;
  /** Name of what it points at, for example "nums[1]" or "heap block 2". */
  tl?: string;
  dangling?: boolean;
  smart?: "unique_ptr" | "shared_ptr";
  uses?: number;
  items?: TraceValue[];
  more?: number;
  fields?: { name: string; v: TraceValue }[];
};
export type TraceFrame = { fn: string; line: number; vars: { name: string; arg: boolean; v: TraceValue }[] };
export type TraceHeap = { addr: string; size: number; label: string; note?: string; v: TraceValue | null };
export type TraceStep = { line: number; frames: TraceFrame[]; heap: TraceHeap[]; out: string };
export type Trace = { steps: TraceStep[]; out: string };

export const visuals = raw as unknown as VisualMeta[];
export const visualById = new Map(visuals.map((v) => [v.id, v]));
export const visualsForStep = (stepId: string) => visuals.filter((v) => v.steps.includes(stepId));

export async function loadTrace(id: string): Promise<Trace> {
  const r = await fetch(`${import.meta.env.BASE_URL}visuals/${id}.json`);
  if (!r.ok) throw new Error(`Couldn't load the recording (${r.status}).`);
  return r.json();
}
