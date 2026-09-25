// Builds src/generated/content.json from content/**/*.yaml.
//
// Every reference solution, drill and project milestone is compiled and run
// with the real GCC/G++ on this machine. Expected outputs come from those real
// runs (or are checked against them when the author pinned them), so nothing
// the site grades against is hand-typed guesswork.
//
// Usage: node scripts/build-content.mjs [--no-cache]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import YAML from "yaml";
import {
  parseTemplate,
  templateSolution,
  harnessSource,
  parseChecks,
  normalizeOutput,
  looseOutput,
  checkRules,
  drillProgram,
  drillDisplay,
  runInput,
} from "../src/grader/assemble.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE_FILE = path.join(ROOT, "node_modules", ".cache", "cpp-arena-content.json");
const useCache = !process.argv.includes("--no-cache");
const cache = useCache && fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cpp-arena-"));
const errors = [];
const warnings = [];

const FLAGS = {
  // The extra -Werror= flags make GCC reject what Clang (the browser compiler) rejects by default.
  c: ["-x", "c", "-std=c17", "-O1", "-Wall", "-Wextra", "-Wno-unused-result", "-U_FORTIFY_SOURCE", "-Werror=int-conversion", "-Werror=implicit-function-declaration", "-Werror=incompatible-pointer-types", "-Werror=implicit-int", "-fdiagnostics-color=never"],
  cpp: ["-x", "c++", "-std=c++20", "-O2", "-fno-exceptions", "-Wall", "-Wextra", "-Wno-unused-result", "-U_FORTIFY_SOURCE", "-fdiagnostics-color=never"],
  // ```cpp native examples: real threads, which the browser compiler can't build. Checked here only.
  cppnative: ["-x", "c++", "-std=c++20", "-O2", "-pthread", "-Wall", "-Wextra", "-Wno-unused-result", "-fdiagnostics-color=never"],
};

function run(cmd, args, { input = "", timeout = 10000, cwd } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], cwd });
    let out = "";
    let err = "";
    let timedOut = false;
    const t = setTimeout(() => {
      timedOut = true;
      p.kill("SIGKILL");
    }, timeout);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code, signal) => {
      clearTimeout(t);
      resolve({ code, signal, out, err, timedOut });
    });
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

// Concurrency limiter
const MAX = Math.max(2, os.cpus().length);
let active = 0;
const queue = [];
function limit(fn) {
  return new Promise((resolve, reject) => {
    const go = () => {
      active++;
      fn().then(resolve, reject).finally(() => {
        active--;
        if (queue.length) queue.shift()();
      });
    };
    if (active < MAX) go();
    else queue.push(go);
  });
}

/** Compile + run source against inputs. Cached by content hash. */
async function execute(lang, source, inputs, { werror = false } = {}) {
  const key = crypto.createHash("sha1").update(JSON.stringify([lang, source, inputs, werror, FLAGS[lang]])).digest("hex");
  if (cache[key]) return cache[key];
  const res = await limit(async () => {
    const id = crypto.randomBytes(6).toString("hex");
    const src = path.join(TMP, id + (lang === "c" ? ".c" : ".cpp"));
    const exe = path.join(TMP, id + ".out");
    fs.writeFileSync(src, source);
    const compiler = lang === "c" ? "gcc" : "g++";
    const cr = await run(compiler, [...FLAGS[lang], ...(werror ? ["-Werror"] : []), src, "-o", exe], { timeout: 60000 });
    if (cr.code !== 0) return { compiled: false, diagnostics: cr.err.replaceAll(src, lang === "c" ? "main.c" : "main.cpp"), runs: [] };
    const runs = [];
    for (const input of inputs) {
      // Like the browser: each run gets its own empty working folder holding only the test's files.
      const { stdin = "", files = {}, args = [] } = typeof input === "string" ? { stdin: input } : input;
      const cwd = fs.mkdtempSync(path.join(TMP, "run-"));
      for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(cwd, name), text);
      const r = await run(exe, args, { input: stdin, timeout: 5000, cwd });
      fs.rmSync(cwd, { recursive: true, force: true });
      runs.push({ stdout: r.out, code: r.code, signal: r.signal, timedOut: r.timedOut });
    }
    return { compiled: true, diagnostics: cr.err, runs };
  });
  cache[key] = res;
  return res;
}

function readYamlDir(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .map((f) => {
      try {
        return { file: path.join(dir, f), data: YAML.parse(fs.readFileSync(path.join(full, f), "utf8")) };
      } catch (e) {
        errors.push(`${dir}/${f}: YAML error: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

const ensureNl = (s) => (s == null ? s : s.replace(/\s*$/, "\n"));

/**
 * Normalise and verify one exercise (lesson step, project milestone or boss rep).
 * Returns the JSON shape the app consumes.
 */
async function buildExercise(where, lang, raw, prevSolution) {
  const kind = raw.fill != null ? "fill" : "code";
  const mode = raw.harness && raw.compare !== "stdout" ? "harness" : "stdout";
  const seed = ensureNl(kind === "fill" ? raw.fill : raw.seed ?? prevSolution ?? "");
  const solution = ensureNl(kind === "fill" ? templateSolution(raw.fill) : raw.solution);
  if (!solution) {
    errors.push(`${where}: missing solution`);
    return null;
  }
  if (kind === "fill" && parseTemplate(raw.fill).blanks.length === 0) errors.push(`${where}: fill step has no [[blanks]]`);
  if (kind === "fill" && parseTemplate(raw.fill).blanks.some((b) => !b.answer.trim())) errors.push(`${where}: a blank has an empty answer`);
  const harness = raw.harness ? ensureNl(raw.harness) : undefined;
  const hints = raw.hints ?? [];
  if (hints.length === 0) warnings.push(`${where}: no hints`);
  const require = raw.require ?? [];
  const forbid = raw.forbid ?? [];
  const ruleProblems = checkRules(solution, require, forbid);
  if (ruleProblems.length) errors.push(`${where}: solution breaks its own rules: ${ruleProblems.join("; ")}`);

  const testsRaw = raw.tests && raw.tests.length ? raw.tests : [{ stdin: "" }];
  const inputs = testsRaw.map(runInput);
  const source = harness ? harnessSource(lang, solution, harness) : solution;
  const res = await execute(lang, source, inputs, { werror: true });
  if (!res.compiled) {
    errors.push(`${where}: reference solution does not compile:\n${res.diagnostics}`);
    return null;
  }
  const out = { kind, mode, lang, seed, solution, hints, require, forbid };
  if (harness) out.harness = harness;
  if (mode === "harness") {
    const r = res.runs[0];
    const { checks } = parseChecks(r.stdout);
    if (r.timedOut || r.code !== 0) errors.push(`${where}: harness run failed (exit ${r.code}${r.timedOut ? ", timeout" : ""})`);
    if (!checks.length) errors.push(`${where}: harness printed no checks`);
    const failed = checks.filter((c) => !c.pass);
    if (failed.length) errors.push(`${where}: solution fails checks: ${failed.map((c) => `${c.name} (want ${c.expected}, got ${c.got})`).join(", ")}`);
    out.checks = checks.length;
    out.tests = [{ name: "tests", stdin: testsRaw[0].stdin ?? "", expect: "" }];
    if (testsRaw[0].files) out.tests[0].files = testsRaw[0].files;
    if (testsRaw[0].args) out.tests[0].args = testsRaw[0].args.map(String);
  } else {
    out.tests = testsRaw.map((t, i) => {
      const r = res.runs[i];
      if (r.timedOut) errors.push(`${where}: test ${i + 1} timed out`);
      const wantExit = t.exit ?? 0;
      if (r.code !== wantExit) errors.push(`${where}: test ${i + 1} exited with ${r.code ?? r.signal}, expected ${wantExit}`);
      const actual = normalizeOutput(r.stdout);
      if (t.expect != null && normalizeOutput(String(t.expect)) !== actual) {
        errors.push(`${where}: test ${i + 1} expected\n${t.expect}\nbut solution printed\n${actual}`);
      }
      if (!actual && !t.allowEmpty) warnings.push(`${where}: test ${i + 1} expects empty output`);
      const test = { name: t.name ?? (testsRaw.length > 1 ? `Test ${i + 1}` : "Output"), stdin: t.stdin ?? "", expect: actual, hidden: !!t.hidden };
      if (t.files) test.files = t.files;
      if (t.args) test.args = t.args.map(String);
      if (t.exit != null) test.exit = t.exit;
      return test;
    });
  }
  // A code-kind seed should not already pass (otherwise the step is free).
  if (kind === "code" && seed && !raw.seedMayPass) {
    const s = harness ? harnessSource(lang, seed, harness) : seed;
    const sr = await execute(lang, s, inputs);
    if (sr.compiled) {
      let passes;
      if (mode === "harness") {
        const { checks } = parseChecks(sr.runs[0].stdout);
        passes = checks.length === out.checks && checks.every((c) => c.pass);
      } else {
        passes = out.tests.every((t, i) => normalizeOutput(sr.runs[i].stdout) === t.expect && (t.exit == null || sr.runs[i].code === t.exit));
      }
      if (passes && checkRules(seed, require, forbid).length === 0) errors.push(`${where}: the starter code already passes`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- worked examples in lesson text
/**
 * Lesson text can include complete example programs as ```c run (or ```cpp run)
 * blocks. Each one is compiled and run; if the next block is ```output, the
 * program must print exactly that. Returns the text with plain info strings.
 *
 * ```cpp native blocks are the same, but for code the browser can't build
 * (threads): they're compiled with -pthread and run three times here, and must
 * print the same output every time.
 */
async function checkExamples(where, text) {
  if (!text || !/```(c|cpp) (run|native)/.test(text)) return text;
  const blocks = [...text.matchAll(/^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm)];
  for (let i = 0; i < blocks.length; i++) {
    const m = blocks[i][1].trim().match(/^(c|cpp) (run|native)$/);
    if (!m) continue;
    const native = m[2] === "native";
    if (native && m[1] !== "cpp") {
      errors.push(`${where}: only cpp examples can be native`);
      continue;
    }
    const lang = native ? "cppnative" : m[1];
    const code = blocks[i][2];
    // An ```input block right after the example is what the program reads.
    const hasInput = blocks[i + 1]?.[1].trim() === "input";
    const stdin = hasInput ? blocks[i + 1][2] : "";
    const res = await execute(lang, code, native ? [stdin, stdin, stdin] : [stdin], { werror: true });
    if (!res.compiled) {
      errors.push(`${where}: example ${i + 1} in the text does not compile:\n${res.diagnostics}`);
      continue;
    }
    const r = res.runs[0];
    if (r.code !== 0 || r.timedOut) errors.push(`${where}: example in the text exits with ${r.code}`);
    if (res.runs.some((x) => normalizeOutput(x.stdout) !== normalizeOutput(r.stdout))) {
      errors.push(`${where}: native example ${i + 1} printed different output on different runs`);
    }
    const next = blocks[i + (hasInput ? 2 : 1)];
    if (next && next[1].trim() === "output" && normalizeOutput(next[2]) !== normalizeOutput(r.stdout)) {
      errors.push(`${where}: example in the text says it prints\n${next[2]}\nbut it prints\n${r.stdout}`);
    }
  }
  return text.replace(/^```(c|cpp) (run|native)[ \t]*$/gm, "```$1").replace(/^```(output|input)[ \t]*$/gm, "```text");
}

// ---------------------------------------------------------------- lessons
async function buildLessons() {
  const files = readYamlDir("content/lessons");
  const modules = [];
  const ids = new Set();
  for (const { file, data } of files) {
    const m = data;
    if (!m.id || !m.title || !m.lang || !m.steps) {
      errors.push(`${file}: module needs id, title, lang, steps`);
      continue;
    }
    if (ids.has(m.id)) errors.push(`${file}: duplicate module id ${m.id}`);
    ids.add(m.id);
    const steps = await Promise.all(
      m.steps.map(async (s, i) => {
        const where = `${file} step ${i + 1} (${s.title})`;
        // Saved progress is keyed by step id, so ids must be explicit: a position-based id would shift when a step is inserted.
        if (!s.id) errors.push(`${where}: step needs an explicit id (progress is saved by id)`);
        const ex = await buildExercise(where, s.lang ?? m.lang, s, null);
        if (!ex) return null;
        if (!s.text) errors.push(`${where}: missing text`);
        const text = await checkExamples(where, s.text ?? "");
        return { id: s.id ?? `${m.id}-${i + 1}`, title: s.title, text, ...ex };
      }),
    );
    modules.push({ id: m.id, title: m.title, lang: m.lang, phase: m.phase ?? "", summary: m.summary ?? "", steps: steps.filter(Boolean) });
  }
  return modules;
}

// ---------------------------------------------------------------- projects
async function buildProjects() {
  const files = readYamlDir("content/projects");
  const projects = [];
  for (const { file, data: p } of files) {
    let prev = p.seed ?? "";
    const milestones = [];
    for (let i = 0; i < (p.milestones ?? []).length; i++) {
      const ms = p.milestones[i];
      const where = `${file} milestone ${i + 1} (${ms.title})`;
      const ex = await buildExercise(where, p.lang, { ...ms, seed: i === 0 ? p.seed : undefined, seedMayPass: i > 0 || ms.seedMayPass }, prev);
      if (!ex) continue;
      milestones.push({ title: ms.title, text: await checkExamples(where, ms.text ?? ""), ...ex });
      prev = ex.solution;
    }
    projects.push({ id: p.id, title: p.title, lang: p.lang, level: p.level, after: p.after ?? null, summary: p.summary ?? "", milestones });
  }
  return projects;
}

// ---------------------------------------------------------------- drills
async function buildDrills(moduleIds) {
  const files = readYamlDir("content/drills");
  const all = [];
  const seen = new Set();
  const jobs = [];
  for (const { file, data } of files) {
    const topic = data.topic;
    // "interview" is the interview prep set, not tied to a lesson module.
    if (!moduleIds.has(topic) && topic !== "interview") errors.push(`${file}: unknown topic ${topic}`);
    (data.drills ?? []).forEach((d, i) => {
      // Interview drills come from several files, so their ids include the file name.
      const id = d.id ?? (topic === "interview" ? `${path.basename(file, ".yaml")}-${i + 1}` : `${topic}-${i + 1}`);
      if (seen.has(id)) errors.push(`${file}: duplicate drill id ${id}`);
      seen.add(id);
      const lang = d.lang ?? data.lang;
      const where = `${file} drill ${i + 1} (${d.type})`;
      jobs.push(buildDrill(where, id, topic, lang, d).then((x) => x && all.push(x)));
    });
  }
  await Promise.all(jobs);
  const order = [...seen];
  all.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return all;
}

async function buildDrill(where, id, topic, lang, d) {
  const base = { id, topic, lang, type: d.type, why: d.why ?? "" };
  if (!d.why && d.type !== "compiles") warnings.push(`${where}: no explanation (why)`);
  const pre = d.pre ? d.pre.replace(/\s*$/, "") : "";
  const body = d.body ? d.body.replace(/\s*$/, "") : "";
  switch (d.type) {
    case "predict": {
      const res = await execute(lang, drillProgram(lang, pre, body), [runInput(d)]);
      if (!res.compiled) return void errors.push(`${where}: does not compile\n${res.diagnostics}`);
      const r = res.runs[0];
      if (r.code !== 0 || r.timedOut) return void errors.push(`${where}: program failed (exit ${r.code})`);
      const answer = normalizeOutput(r.stdout);
      if (!answer) errors.push(`${where}: prints nothing`);
      if (answer.split("\n").length > 4) warnings.push(`${where}: long output (${answer.split("\n").length} lines)`);
      if (d.answer != null && looseOutput(String(d.answer)) !== looseOutput(answer)) errors.push(`${where}: author answer "${d.answer}" but program prints "${answer}"`);
      return { ...base, prompt: d.prompt ?? "What does this print?", display: drillDisplay(pre, body), answer, src: { pre, body, stdin: d.stdin ?? "", ...(d.files ? { files: d.files } : {}), ...(d.args ? { args: d.args.map(String) } : {}) } };
    }
    case "fill": {
      const tmpl = drillDisplay(pre, body);
      const { blanks } = parseTemplate(tmpl);
      if (blanks.length !== 1) return void errors.push(`${where}: fill drills need exactly one [[blank]]`);
      if (!blanks[0].answer.trim()) return void errors.push(`${where}: empty blank answer`);
      const program = drillProgram(lang, templateSolution(pre), templateSolution(body));
      const res = await execute(lang, program, [runInput(d)]);
      if (!res.compiled) return void errors.push(`${where}: solution does not compile\n${res.diagnostics}`);
      const r = res.runs[0];
      if (r.code !== 0 || r.timedOut) return void errors.push(`${where}: solution run failed (exit ${r.code})`);
      const out = normalizeOutput(r.stdout);
      if (d.expect != null && normalizeOutput(String(d.expect)) !== out) errors.push(`${where}: expected "${d.expect}" but got "${out}"`);
      return { ...base, prompt: d.prompt ?? "Fill the blank so the program prints the output shown.", display: tmpl, answer: blanks[0].answer, accept: blanks[0].accept, output: out, src: { pre: templateSolution(pre), body: templateSolution(body), stdin: d.stdin ?? "", ...(d.files ? { files: d.files } : {}), ...(d.args ? { args: d.args.map(String) } : {}) } };
    }
    case "bug": {
      const fullDisplay = drillDisplay(pre, body);
      const lines = fullDisplay.split("\n");
      const bugIdx = lines.findIndex((l) => /\/\/\s*BUG\s*$/.test(l));
      if (bugIdx < 0 || !d.fix) return void errors.push(`${where}: mark the buggy line with // BUG and give fix`);
      if (/^\s*[{}]\s*;?\s*\/\/\s*BUG\s*$/.test(lines[bugIdx])) return void errors.push(`${where}: the bug line can't be a lone brace (not clickable)`);
      const clean = (s) => s.split("\n").map((l) => l.replace(/\s*\/\/\s*BUG\s*$/, "")).join("\n");
      const fixLine = (s) =>
        s
          .split("\n")
          .map((l) => (/\/\/\s*BUG\s*$/.test(l) ? l.match(/^\s*/)[0] + d.fix.trim() : l))
          .join("\n");
      const buggy = await execute(lang, drillProgram(lang, clean(pre), clean(body)), [runInput(d)]);
      const fixed = await execute(lang, drillProgram(lang, fixLine(pre), fixLine(body)), [runInput(d)]);
      if (!fixed.compiled) return void errors.push(`${where}: fixed version does not compile\n${fixed.diagnostics}`);
      const fr = fixed.runs[0];
      if (fr.code !== 0 || fr.timedOut) return void errors.push(`${where}: fixed version fails at runtime`);
      const fixedOut = normalizeOutput(fr.stdout);
      if (buggy.compiled && !d.ub) {
        const br = buggy.runs[0];
        const same = !br.timedOut && br.code === 0 && normalizeOutput(br.stdout) === fixedOut;
        if (same) errors.push(`${where}: buggy and fixed versions behave the same`);
      }
      return {
        ...base,
        prompt: d.prompt ?? `This should print: ${fixedOut.replace(/\n/g, " / ")}. Click the line with the bug.`,
        display: clean(fullDisplay),
        answer: String(bugIdx + 1),
        fix: d.fix.trim(),
        output: fixedOut,
        src: { pre: fixLine(pre), body: fixLine(body), stdin: d.stdin ?? "", ...(d.files ? { files: d.files } : {}), ...(d.args ? { args: d.args.map(String) } : {}) },
      };
    }
    case "compiles": {
      const res = await execute(lang, drillProgram(lang, pre, body), [""]);
      const answer = res.compiled ? "yes" : "no";
      if (d.answer != null && String(d.answer) !== answer) errors.push(`${where}: author says ${d.answer} but gcc says ${answer}\n${res.diagnostics}`);
      let why = d.why ?? "";
      if (!res.compiled) {
        const first = res.diagnostics.split("\n").find((l) => /error:/.test(l));
        if (first && !why) why = "Compiler: " + first.replace(/^.*?error:\s*/, "");
      }
      if (!why) warnings.push(`${where}: no explanation`);
      return { ...base, why, prompt: d.prompt ?? "Does this compile?", display: drillDisplay(pre, body), answer, src: { pre, body, stdin: d.stdin ?? "", ...(d.files ? { files: d.files } : {}), ...(d.args ? { args: d.args.map(String) } : {}) } };
    }
    case "choice": {
      const choices = (d.choices ?? []).map(String);
      const answer = Number(d.answer);
      if (choices.length < 2 || choices.length > 4) return void errors.push(`${where}: choice drills need 2 to 4 choices`);
      if (new Set(choices).size !== choices.length) errors.push(`${where}: duplicate choices`);
      if (!(answer >= 1 && answer <= choices.length)) return void errors.push(`${where}: answer must be the number of the right choice (1 to ${choices.length})`);
      if (!d.prompt) errors.push(`${where}: choice drills need a prompt`);
      if (!d.why) errors.push(`${where}: choice drills need an explanation (why)`);
      const display = drillDisplay(pre, body);
      if (display) {
        // Code shown with a question must compile (unless the question is about a compile error),
        // and "verify: output" checks that the right choice really is what it prints.
        // Code with only declarations still needs a main to link.
        const res = await execute(lang, drillProgram(lang, pre, body || " "), [runInput(d)]);
        if (d.compiles !== false && !res.compiled) return void errors.push(`${where}: code does not compile\n${res.diagnostics}`);
        if (d.compiles === false && res.compiled) errors.push(`${where}: marked compiles: false but it compiles`);
        if (d.verify === "output") {
          const r = res.runs[0];
          if (!r || r.code !== 0) return void errors.push(`${where}: program failed`);
          const out = looseOutput(normalizeOutput(r.stdout));
          if (looseOutput(choices[answer - 1]) !== out) errors.push(`${where}: right choice "${choices[answer - 1]}" but the program prints "${normalizeOutput(r.stdout)}"`);
          choices.forEach((c, i) => i !== answer - 1 && looseOutput(c) === out && errors.push(`${where}: choice ${i + 1} is also correct`));
        }
      }
      return { ...base, prompt: d.prompt ?? "", display, answer: String(answer), choices };
    }
    case "boss": {
      const ex = await buildExercise(where, lang, d, null);
      if (!ex) return null;
      return { ...base, prompt: d.prompt ?? "", display: "", answer: "", exercise: ex };
    }
    default:
      errors.push(`${where}: unknown drill type ${d.type}`);
      return null;
  }
}

// ---------------------------------------------------------------- placement quiz
async function buildPlacement(modules) {
  const file = path.join(ROOT, "content", "placement.yaml");
  if (!fs.existsSync(file)) return [];
  const data = YAML.parse(fs.readFileSync(file, "utf8"));
  const order = modules.map((m) => m.id);
  const out = [];
  let last = -1;
  for (const [i, q] of (data.questions ?? []).entries()) {
    const where = `content/placement.yaml question ${i + 1}`;
    const at = order.indexOf(q.module);
    if (at < 0) {
      errors.push(`${where}: unknown module ${q.module}`);
      continue;
    }
    if (at < last) errors.push(`${where}: questions must follow the curriculum order`);
    last = at;
    const lang = q.lang ?? modules[at].lang;
    const d = await buildDrill(where, `placement-${i + 1}`, q.module, lang, q);
    if (d) out.push({ ...d, module: q.module });
  }
  return out;
}

// ---------------------------------------------------------------- topic reference pages
async function buildTopics(modules) {
  const moduleIds = new Set(modules.map((m) => m.id));
  const visualIds = new Set(
    readYamlDir("content/visuals")
      .map((x) => x.data?.id)
      .filter(Boolean),
  );
  const out = [];
  const slugs = new Set();
  for (const { file, data } of readYamlDir("content/topics")) {
    for (const [i, t] of (data.topics ?? []).entries()) {
      const where = `${file} topic ${i + 1} (${t.slug})`;
      for (const k of ["slug", "title", "lang", "description", "body", "example"]) if (!t[k]) errors.push(`${where}: missing ${k}`);
      if (!/^[a-z0-9-]+$/.test(t.slug ?? "")) errors.push(`${where}: slug must be lowercase letters, digits and dashes`);
      if (slugs.has(t.slug)) errors.push(`${where}: duplicate slug`);
      slugs.add(t.slug);
      if ((t.description ?? "").length > 160) warnings.push(`${where}: description is over 160 characters`);
      for (const m of t.modules ?? []) if (!moduleIds.has(m)) errors.push(`${where}: unknown module ${m}`);
      if (t.visual && !visualIds.has(t.visual)) errors.push(`${where}: unknown visual ${t.visual}`);
      const example = ensureNl(t.example);
      // native: the example uses threads, so it's built with -pthread and must print the same thing on every run.
      if (t.native && t.lang !== "cpp") errors.push(`${where}: only cpp topics can be native`);
      const inputs = t.native ? [t.stdin ?? "", t.stdin ?? "", t.stdin ?? ""] : [t.stdin ?? ""];
      const res = await execute(t.native ? "cppnative" : t.lang, example, inputs, { werror: true });
      if (!res.compiled) {
        errors.push(`${where}: example does not compile:\n${res.diagnostics}`);
        continue;
      }
      const r = res.runs[0];
      if (r.code !== 0 || r.timedOut) errors.push(`${where}: example exits with ${r.code}`);
      if (res.runs.some((x) => x.stdout !== r.stdout)) errors.push(`${where}: native example printed different output on different runs`);
      out.push({ slug: t.slug, title: t.title, lang: t.lang, description: t.description, modules: t.modules ?? [], visual: t.visual ?? null, body: t.body, example, stdin: t.stdin ?? "", output: r.stdout, ...(t.native ? { native: true } : {}) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- pro track
function buildPro() {
  const file = path.join(ROOT, "content", "pro.yaml");
  if (!fs.existsSync(file)) return [];
  const data = YAML.parse(fs.readFileSync(file, "utf8"));
  const dirs = fs.readdirSync(path.join(ROOT, "pro-track", "starter", "projects")).sort();
  const listed = data.projects.map((p) => p.dir);
  for (const d of dirs) if (!listed.includes(d)) errors.push(`content/pro.yaml: project folder ${d} is not listed`);
  return data.projects.map((p) => {
    const readme = path.join(ROOT, "pro-track", "starter", "projects", p.dir, "README.md");
    if (!fs.existsSync(readme)) {
      errors.push(`content/pro.yaml: ${p.dir} has no README.md`);
      return null;
    }
    return {
      id: p.dir.replace(/^\d+-/, ""),
      dir: p.dir,
      number: parseInt(p.dir, 10),
      title: p.title,
      summary: p.summary,
      hours: p.hours,
      skills: p.skills ?? [],
      readme: fs.readFileSync(readme, "utf8"),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------- main
const t0 = Date.now();
const modules = await buildLessons();
const projects = await buildProjects();
const drills = await buildDrills(new Set(modules.map((m) => m.id)));
const pro = buildPro();
const placement = await buildPlacement(modules);
const topics = await buildTopics(modules);
{
  const seenSteps = new Set();
  for (const m of modules) for (const st of m.steps) {
    if (seenSteps.has(st.id)) errors.push(`duplicate step id ${st.id}`);
    seenSteps.add(st.id);
  }
}
for (const p of projects) if (p.after && !modules.some((m) => m.id === p.after)) warnings.push(`project ${p.id}: unknown 'after' module ${p.after}`);

fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
fs.rmSync(TMP, { recursive: true, force: true });

for (const w of warnings) console.warn("warn:", w);
if (errors.length) {
  for (const e of errors) console.error("\nERROR:", e);
  console.error(`\n${errors.length} content error(s).`);
  process.exit(1);
}
const content = { generatedAt: new Date().toISOString(), modules, projects, drills, pro, placement, topics };
fs.mkdirSync(path.join(ROOT, "src/generated"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "src/generated/content.json"), JSON.stringify(content));
const steps = modules.reduce((a, m) => a + m.steps.length, 0);
const ms = projects.reduce((a, p) => a + p.milestones.length, 0);
console.log(`content ok: ${modules.length} modules, ${steps} steps, ${drills.length} drills, ${projects.length} projects (${ms} milestones), ${pro.length} pro projects, ${placement.length} placement questions, ${topics.length} topic pages in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
