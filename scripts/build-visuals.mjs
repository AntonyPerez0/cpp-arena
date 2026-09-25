// Builds the "watch it run" visualizations from content/visuals/*.yaml.
//
// Each example is compiled with debug info and run under gdb
// (scripts/trace/tracer.py), which records every line: the call stack with
// every variable, the heap blocks, and the output so far. The app plays these
// recordings back, so what learners see is what really happened in memory.
//
// Writes src/generated/visuals.json (the list, bundled into the app) and
// public/visuals/<id>.json (one recording each, loaded when opened).
// Needs gcc, g++ and gdb. Usage: node scripts/build-visuals.mjs [--no-cache]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TRACE = path.join(ROOT, "scripts", "trace");
const CACHE_FILE = path.join(ROOT, "node_modules", ".cache", "cpp-arena-visuals.json");
const OUT_DIR = path.join(ROOT, "public", "visuals");
const useCache = !process.argv.includes("--no-cache");
const cache = useCache && fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cpp-arena-vis-"));
const errors = [];

function run(cmd, args, { input = "", timeout = 60000, cwd, env } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], cwd, env: { ...process.env, ...env } });
    let out = "";
    let err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeout);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, out, err });
    });
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

const toolHash = crypto
  .createHash("sha1")
  .update(["tracer.py", "track.c", "track_new.cpp"].map((f) => fs.readFileSync(path.join(TRACE, f), "utf8")).join("\0"))
  .digest("hex");

/** Keep only the node ids that arrows point at, to keep the files small. */
function prune(step) {
  const used = new Set();
  const collect = (v) => {
    if (!v || typeof v !== "object") return;
    if (v.to) used.add(v.to);
    for (const x of v.items ?? []) collect(x);
    for (const f of v.fields ?? []) collect(f.v);
  };
  const strip = (v) => {
    if (!v || typeof v !== "object") return;
    if (v.id && !used.has(v.id)) delete v.id;
    for (const x of v.items ?? []) strip(x);
    for (const f of v.fields ?? []) strip(f.v);
  };
  for (const f of step.frames) for (const x of f.vars) collect(x.v);
  for (const h of step.heap) collect(h.v);
  for (const f of step.frames) for (const x of f.vars) strip(x.v);
  for (const h of step.heap) strip(h.v);
  return step;
}

async function trace(v) {
  const key = crypto.createHash("sha1").update(JSON.stringify([toolHash, v.lang, v.code, v.stdin ?? ""])).digest("hex");
  if (cache[key]) return cache[key];
  const dir = fs.mkdtempSync(path.join(TMP, v.id + "-"));
  const src = v.lang === "c" ? "main.c" : "main.cpp";
  fs.writeFileSync(path.join(dir, src), v.code);
  fs.writeFileSync(path.join(dir, "in.txt"), v.stdin ?? "");
  const wrap = ["-Wl,--wrap=malloc,--wrap=free,--wrap=calloc,--wrap=realloc"];
  // Compile the example on its own first, strictly, exactly as a learner would.
  const strict = v.lang === "c" ? ["gcc", "-std=c17", "-Wall", "-Wextra", "-Werror", "-x", "c"] : ["g++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-x", "c++"];
  const plain = await run(strict[0], [...strict.slice(1), src, "-o", "plain"], { cwd: dir });
  if (plain.code !== 0) return { error: `does not compile cleanly:\n${plain.err}` };
  const normal = await run(path.join(dir, "plain"), [], { cwd: dir, input: v.stdin ?? "", timeout: 5000 });
  if (normal.code !== 0) return { error: `exits with ${normal.code}` };
  // Then with debug info and the heap tracker for the recording.
  const dbg = ["-g", "-O0", "-fno-omit-frame-pointer"];
  const build =
    v.lang === "c"
      ? await run("gcc", ["-std=c17", ...dbg, src, path.join(TRACE, "track.c"), ...wrap, "-o", "prog"], { cwd: dir })
      : await run("g++", ["-std=c++20", ...dbg, src, path.join(TRACE, "track_new.cpp"), "-x", "c", path.join(TRACE, "track.c"), ...wrap, "-o", "prog"], { cwd: dir });
  if (build.code !== 0) return { error: `traced build failed:\n${build.err}` };
  const r = await run("gdb", ["-q", "-batch", "-nx", "-x", path.join(TRACE, "tracer.py")], {
    cwd: dir,
    env: { TRACE_EXE: path.join(dir, "prog"), TRACE_SRC: src, TRACE_IN: path.join(dir, "in.txt"), TRACE_OUT: path.join(dir, "out.txt"), TRACE_JSON: path.join(dir, "trace.json") },
    timeout: 120000,
  });
  if (!fs.existsSync(path.join(dir, "trace.json"))) return { error: `gdb produced no trace (exit ${r.code}):\n${r.err.slice(-2000)}` };
  const t = JSON.parse(fs.readFileSync(path.join(dir, "trace.json"), "utf8"));
  if (t.out !== normal.out) return { error: `output under gdb (${JSON.stringify(t.out)}) differs from a normal run (${JSON.stringify(normal.out)})` };
  const res = { steps: t.steps.map(prune), truncated: t.truncated, out: t.out };
  cache[key] = res;
  return res;
}

const content = JSON.parse(fs.readFileSync(path.join(ROOT, "src/generated/content.json"), "utf8"));
const modules = new Map(content.modules.map((m) => [m.id, m]));
const files = fs.existsSync(path.join(ROOT, "content/visuals")) ? fs.readdirSync(path.join(ROOT, "content/visuals")).filter((f) => f.endsWith(".yaml")).sort() : [];
const list = [];
const ids = new Set();
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const t0 = Date.now();
await Promise.all(
  files.map(async (f) => {
    const where = `content/visuals/${f}`;
    let v;
    try {
      v = YAML.parse(fs.readFileSync(path.join(ROOT, "content/visuals", f), "utf8"));
    } catch (e) {
      errors.push(`${where}: YAML error: ${e.message}`);
      return;
    }
    for (const k of ["id", "title", "lang", "module", "summary", "text", "code"]) if (!v[k]) errors.push(`${where}: missing ${k}`);
    if (ids.has(v.id)) errors.push(`${where}: duplicate id ${v.id}`);
    ids.add(v.id);
    const m = modules.get(v.module);
    if (!m) errors.push(`${where}: unknown module ${v.module}`);
    for (const s of v.steps ?? []) if (m && !m.steps.some((x) => x.id === s)) errors.push(`${where}: module ${v.module} has no step ${s}`);
    const t = await trace(v);
    if (t.error) return void errors.push(`${where}: ${t.error}`);
    if (t.truncated) errors.push(`${where}: too many steps (over 400); make the example shorter`);
    if (t.steps.length < 3) errors.push(`${where}: only ${t.steps.length} steps recorded`);
    fs.writeFileSync(path.join(OUT_DIR, `${v.id}.json`), JSON.stringify({ steps: t.steps, out: t.out }));
    list.push({ id: v.id, title: v.title, lang: v.lang, module: v.module, steps: v.steps ?? [], summary: v.summary, text: v.text, code: v.code.replace(/\s*$/, "\n"), stepCount: t.steps.length, out: t.out, file: f });
  }),
);

fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
fs.rmSync(TMP, { recursive: true, force: true });
if (errors.length) {
  for (const e of errors) console.error("\nERROR:", e);
  console.error(`\n${errors.length} visualization error(s).`);
  process.exit(1);
}
list.sort((a, b) => a.file.localeCompare(b.file));
for (const x of list) delete x.file;
fs.writeFileSync(path.join(ROOT, "src/generated/visuals.json"), JSON.stringify(list));
const size = fs.readdirSync(OUT_DIR).reduce((n, f) => n + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`visuals ok: ${list.length} recordings, ${list.reduce((n, x) => n + x.stepCount, 0)} steps, ${(size / 1024).toFixed(0)} KB, in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
