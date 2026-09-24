// Cross-checks src/generated/content.json against the exact toolchain the
// browser uses (browsercc Clang 20 -> WASI), running in Node.
// GCC builds the expected outputs; this makes sure Clang/WASI agrees.
//
// Usage: node scripts/verify-wasm.mjs [filter]
import fs from "node:fs";
import { loadNodeToolchain } from "./node-toolchain.mjs";
import { runWasi } from "../src/compiler/core.js";
import { harnessSource, parseChecks, normalizeOutput, drillProgram, looseOutput } from "../src/grader/assemble.js";

const filter = process.argv[2] ?? "";
const content = JSON.parse(fs.readFileSync(new URL("../src/generated/content.json", import.meta.url), "utf8"));
const tc = await loadNodeToolchain();
const problems = [];
let n = 0;

async function exec(lang, source, inputs) {
  const r = await tc.compile({ source, lang });
  if (!r.ok) return { ok: false, diagnostics: r.diagnostics };
  const mod = await WebAssembly.compile(r.wasm);
  return { ok: true, diagnostics: r.diagnostics, runs: inputs.map((i) => runWasi(mod, i)) };
}

async function checkExercise(where, ex) {
  if (filter && !where.includes(filter)) return;
  n++;
  const harness = ex.mode === "harness";
  const src = ex.harness ? harnessSource(ex.lang, ex.solution, ex.harness) : ex.solution;
  const inputs = harness ? [ex.tests[0]?.stdin ?? ""] : ex.tests.map((t) => t.stdin);
  const r = await exec(ex.lang, src, inputs);
  if (!r.ok) return problems.push(`${where}: clang/wasm compile failed\n${r.diagnostics}`);
  if (/warning:/.test(r.diagnostics)) problems.push(`${where}: clang warnings\n${r.diagnostics}`);
  if (harness) {
    const { checks } = parseChecks(r.runs[0].stdout);
    if (checks.length !== ex.checks || checks.some((c) => !c.pass)) problems.push(`${where}: harness mismatch ${JSON.stringify(checks.filter((c) => !c.pass))} (${checks.length}/${ex.checks}) crash=${r.runs[0].crash}`);
  } else {
    ex.tests.forEach((t, i) => {
      const got = normalizeOutput(r.runs[i].stdout);
      if (got !== t.expect || r.runs[i].crash) problems.push(`${where} test ${i + 1}: wasm printed\n${got}\nexpected\n${t.expect}\ncrash=${r.runs[i].crash}`);
    });
  }
}

const t0 = Date.now();
for (const m of content.modules) for (const [i, s] of m.steps.entries()) await checkExercise(`${m.id} step ${i + 1} (${s.title})`, s);
for (const p of content.projects) for (const [i, ms] of p.milestones.entries()) await checkExercise(`project ${p.id} milestone ${i + 1}`, ms);
for (const d of content.drills) {
  const where = `drill ${d.id} (${d.type})`;
  if (filter && !where.includes(filter)) continue;
  if (d.type === "boss") {
    await checkExercise(where, d.exercise);
    continue;
  }
  n++;
  const prog = drillProgram(d.lang, d.src.pre, d.src.body);
  if (d.type === "predict") {
    const r = await exec(d.lang, prog, [d.src.stdin ?? ""]);
    if (!r.ok) {
      problems.push(`${where}: wasm compile failed\n${r.diagnostics}`);
      continue;
    }
    if (looseOutput(r.runs[0].stdout) !== looseOutput(d.answer)) problems.push(`${where}: wasm prints "${r.runs[0].stdout}" but answer is "${d.answer}"`);
  } else if (d.type === "fill") {
    const r = await exec(d.lang, prog, [d.src.stdin ?? ""]);
    if (!r.ok) problems.push(`${where}: wasm compile failed\n${r.diagnostics}`);
    else if (normalizeOutput(r.runs[0].stdout) !== d.output) problems.push(`${where}: wasm output differs`);
  } else if (d.type === "bug") {
    const r = await exec(d.lang, prog, [d.src.stdin ?? ""]);
    if (!r.ok) problems.push(`${where}: fixed version fails on wasm\n${r.diagnostics}`);
    else if (normalizeOutput(r.runs[0].stdout) !== d.output) problems.push(`${where}: fixed output differs on wasm`);
  } else if (d.type === "compiles") {
    const r = await tc.compile({ source: prog, lang: d.lang });
    const got = r.ok ? "yes" : "no";
    if (got !== d.answer) problems.push(`${where}: clang says ${got}, gcc said ${d.answer}\n${r.diagnostics}`);
  }
}

for (const p of problems) console.error("\nPROBLEM:", p);
console.log(`\nverify-wasm: ${n} items, ${problems.length} problem(s), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(problems.length ? 1 : 0);
