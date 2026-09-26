// Main-thread API for compiling and running C/C++ code.
import { CACHE_PREFIX, fetchManifest, type Manifest } from "./manifest";

export type Lang = "c" | "cpp";

/** One run's input: stdin text, or stdin plus starter files and command-line arguments. */
export type RunInput = string | { stdin: string; files?: Record<string, string>; args?: string[] };

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

/**
 * True when the browser reports a metered or data-saving connection. Chrome on Android
 * reports mobile data as type "cellular"; Data Saver sets saveData. Other browsers say nothing.
 */
export function onMobileData(): boolean {
  const c = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.type === "cellular" || c.effectiveType === "2g" || c.effectiveType === "slow-2g");
}

let manifestPromise: Promise<Manifest | null> | null = null;
function loadManifest() {
  manifestPromise ??= fetchManifest(new URL(import.meta.env.BASE_URL + "toolchain/manifest.json", location.origin).href);
  return manifestPromise;
}

/** Megabytes the compiler download costs for C and for C++ (which adds the precompiled header). */
export async function downloadMegabytes(): Promise<{ c: number; cpp: number } | null> {
  const m = await loadManifest();
  if (!m) return null;
  const size = (f: string) => (typeof DecompressionStream === "function" && m.gzip?.[f]) || m.files[f] || 0;
  const c = size("clang.wasm") + size("lld.wasm") + size("sysroot.tar");
  return { c: Math.round(c / 1e6), cpp: Math.round((c + size("stdc++.h.pch")) / 1e6) };
}

/** Whether this version of the toolchain is already saved in the browser, so loading it costs no data. */
export async function compilerCached(): Promise<boolean> {
  try {
    const m = await loadManifest();
    if (!m) return false;
    const { version } = m;
    if (!(await caches.keys()).includes(CACHE_PREFIX + version)) return false;
    const cache = await caches.open(CACHE_PREFIX + version);
    return (await cache.keys()).length >= 3;
  } catch {
    return false;
  }
}

/** Download the compiler on its own only when that can't cost the learner mobile data (or they said it may). */
export async function mayAutoDownload(allowOnMobileData: boolean): Promise<boolean> {
  if (allowOnMobileData || !onMobileData()) return true;
  return compilerCached();
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
  worker.postMessage({ type: "init", base: new URL(import.meta.env.BASE_URL + "toolchain/", location.origin).href, warmCpp: !!opts.warmCpp });
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
function runAll(wasm: Uint8Array, inputs: RunInput[], timeoutMs: number): Promise<RunResult[]> {
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

export async function compileAndRun(source: string, lang: Lang, inputs: RunInput[], timeoutMs = 3000): Promise<CompileRunResult> {
  const c = await compile(source, lang);
  if (!c.ok || !c.wasm) {
    return { compiled: false, diagnostics: c.diagnostics, internalError: c.internal, compileMs: c.ms, runs: [] };
  }
  const runs = await runAll(c.wasm, inputs.length ? inputs : [""], timeoutMs);
  return { compiled: true, diagnostics: c.diagnostics, compileMs: c.ms, runs };
}

export async function clearCompilerCache() {
  for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX)) await caches.delete(k);
}
