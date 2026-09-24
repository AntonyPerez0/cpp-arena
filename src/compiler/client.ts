// Main-thread API for compiling and running C/C++ code.
export type Lang = "c" | "cpp";

export type CompilerStatus =
  | { state: "idle" }
  | { state: "loading"; loaded: number; total: number; stage: string }
  | { state: "ready"; pch: boolean }
  | { state: "error"; message: string };

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  crash: string | null;
  timedOut: boolean;
  truncated: boolean;
  ms: number;
};

export type CompileRunResult = {
  compiled: boolean;
  diagnostics: string;
  internalError?: string;
  compileMs: number;
  runs: RunResult[];
};

let worker: Worker | null = null;
let status: CompilerStatus = { state: "idle" };
const listeners = new Set<() => void>();
let nextId = 1;
const pending = new Map<number, (m: any) => void>();

function setStatus(s: CompilerStatus) {
  status = s;
  listeners.forEach((l) => l());
}

export function getCompilerStatus() {
  return status;
}

export function subscribeCompiler(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Start downloading the toolchain (no-op if already started). */
export function ensureCompiler(opts: { warmCpp?: boolean } = {}) {
  if (!worker) {
    worker = new Worker(new URL("./compiler.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") setStatus({ state: "loading", loaded: m.loaded, total: m.total, stage: m.stage });
      else if (m.type === "ready") setStatus({ state: "ready", pch: false });
      else if (m.type === "pch") setStatus({ state: "ready", pch: true });
      else if (m.type === "error") setStatus({ state: "error", message: m.message });
      else if (m.type === "compiled") {
        const cb = pending.get(m.id);
        pending.delete(m.id);
        cb?.(m);
      }
    };
    worker.onerror = (e) => setStatus({ state: "error", message: e.message || "Compiler worker crashed" });
    setStatus({ state: "loading", loaded: 0, total: 1, stage: "download" });
  }
  if (status.state === "error") setStatus({ state: "loading", loaded: 0, total: 1, stage: "download" });
  worker.postMessage({ type: "init", base: new URL("toolchain/", document.baseURI).href, warmCpp: !!opts.warmCpp });
}

function compile(source: string, lang: Lang): Promise<{ ok: boolean; diagnostics: string; wasm: Uint8Array | null; ms: number; internal?: string }> {
  ensureCompiler({ warmCpp: lang === "cpp" });
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ type: "compile", id, source, lang });
  });
}

/** Run a compiled program on every input, killing any case that exceeds timeoutMs. */
function runAll(wasm: Uint8Array, inputs: string[], timeoutMs: number): Promise<RunResult[]> {
  return new Promise((resolve) => {
    const results: RunResult[] = [];
    const runner = new Worker(new URL("./runner.worker.ts", import.meta.url), { type: "module" });
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current = -1;
    const finish = () => {
      if (timer) clearTimeout(timer);
      runner.terminate();
      resolve(results);
    };
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const idx = current < 0 ? 0 : current;
        results[idx] = { stdout: "", stderr: "", exitCode: null, crash: null, timedOut: true, truncated: false, ms: timeoutMs };
        finish();
      }, timeoutMs);
    };
    runner.onmessage = (e) => {
      const m = e.data;
      if (m.type === "start") {
        current = m.index;
        arm();
      } else if (m.type === "result") {
        results[m.index] = { stdout: m.stdout, stderr: m.stderr, exitCode: m.exitCode, crash: m.crash, timedOut: false, truncated: m.truncated, ms: m.ms };
      } else if (m.type === "done") {
        finish();
      } else if (m.type === "fatal") {
        results[0] = { stdout: "", stderr: m.message, exitCode: null, crash: m.message, timedOut: false, truncated: false, ms: 0 };
        finish();
      }
    };
    runner.onerror = (e) => {
      results[Math.max(current, 0)] = { stdout: "", stderr: "", exitCode: null, crash: e.message || "runner crashed", timedOut: false, truncated: false, ms: 0 };
      finish();
    };
    arm();
    runner.postMessage({ wasm, inputs });
  });
}

export async function compileAndRun(source: string, lang: Lang, inputs: string[], timeoutMs = 3000): Promise<CompileRunResult> {
  const c = await compile(source, lang);
  if (!c.ok || !c.wasm) {
    return { compiled: false, diagnostics: c.diagnostics, internalError: c.internal, compileMs: c.ms, runs: [] };
  }
  const runs = await runAll(c.wasm, inputs.length ? inputs : [""], timeoutMs);
  return { compiled: true, diagnostics: c.diagnostics, compileMs: c.ms, runs };
}

export async function clearCompilerCache() {
  for (const k of await caches.keys()) if (k.startsWith("cpp-arena-toolchain-")) await caches.delete(k);
}
