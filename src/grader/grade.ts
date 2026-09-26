import { compileAndRun, type RunResult } from "../compiler/client";
import type { Exercise } from "../content/types";
import { harnessSource, normalizeOutput, parseChecks, checkRules, runInput } from "./assemble.js";
import { parseDiagnostics, type Diagnostic } from "./friendly";

export type TestResult = {
  name: string;
  pass: boolean;
  hidden?: boolean;
  stdin?: string;
  files?: Record<string, string>;
  args?: string[];
  expected?: string;
  got?: string;
  note?: string;
};

export type GradeResult = {
  status: "pass" | "fail" | "compile-error" | "internal-error";
  diagnostics: Diagnostic[];
  rawDiagnostics: string;
  tests: TestResult[];
  ruleProblems: string[];
  output: string;
  compileMs: number;
  runNote?: string;
};

export function describeRun(r: RunResult | undefined): string | undefined {
  if (!r) return "The program did not run (a previous test stopped the run).";
  if (r.timedOut) return "Time limit exceeded. The program ran for over 3 seconds; look for an infinite loop or a scanf that waits for input that never comes.";
  if (r.crash === "output-limit") return "Output limit hit (over 64 KB printed). Probably a loop that never stops printing.";
  if (r.crash) {
    if (/out of bounds/.test(r.crash)) return "Crash: memory access out of bounds. This is like a segfault: a bad pointer, a NULL dereference, or an index far past the end of an array.";
    if (r.crash === "uncaught-exception") {
      const said = r.stderr.slice(r.stderr.lastIndexOf("terminate called")).trim().replace(/\s*\n\s*/g, " ");
      return `Crash: an exception was thrown and nothing caught it, so the program was terminated (std::terminate)${said ? `: ${said}` : "."} Catch it with try/catch, or fix what made it throw.`;
    }
    if (/unreachable/.test(r.crash)) return "Crash: the program hit an abort or undefined behaviour (for example a failed assert, abort(), a noexcept function that threw, or falling off the end of a non-void function).";
    if (/call stack|recursion/i.test(r.crash)) return "Crash: stack overflow. Recursion that never reaches its base case?";
    return "Crash: " + r.crash;
  }
  if (r.exitCode && r.exitCode !== 0) return `The program exited with code ${r.exitCode} (main should return 0 on success).`;
  return undefined;
}

export async function grade(ex: Exercise, code: string): Promise<GradeResult> {
  const userLines = code.split("\n").length;
  const ruleProblems = checkRules(code, ex.require, ex.forbid);
  const harness = ex.mode === "harness";
  if (ex.harness && /\bint\s+main\s*\(/.test(code)) {
    ruleProblems.push("Remove your main() function on this step. The hidden tests provide their own main().");
  }
  const source = ex.harness ? harnessSource(ex.lang, code, ex.harness) : code;
  const inputs = harness ? [runInput(ex.tests[0])] : ex.tests.map(runInput);
  const res = await compileAndRun(source, ex.lang, inputs);
  const diagnostics = parseDiagnostics(res.diagnostics, userLines);
  if (res.internalError) {
    return { status: "internal-error", diagnostics, rawDiagnostics: res.internalError, tests: [], ruleProblems, output: "", compileMs: res.compileMs };
  }
  if (!res.compiled) {
    return { status: "compile-error", diagnostics, rawDiagnostics: res.diagnostics, tests: [], ruleProblems, output: "", compileMs: res.compileMs };
  }
  let tests: TestResult[];
  let output = "";
  let runNote: string | undefined;
  if (harness) {
    const r = res.runs[0];
    const { checks, output: rest } = parseChecks(r?.stdout ?? "");
    output = rest;
    tests = checks.map((c) => ({ name: c.name, pass: c.pass, expected: c.expected, got: c.got }));
    const expectedCount = ex.checks ?? checks.length;
    runNote = describeRun(r);
    if (checks.length < expectedCount) {
      tests.push({ name: `${expectedCount - checks.length} more test(s)`, pass: false, note: runNote ?? "The tests stopped early." });
    }
  } else {
    output = res.runs[0]?.stdout ?? "";
    tests = ex.tests.map((t, i) => {
      const r = res.runs[i];
      const got = r ? normalizeOutput(r.stdout) : "";
      const note = describeRun(r);
      const exitOk = t.exit == null || (r?.exitCode ?? 0) === t.exit;
      const pass = !!r && !r.timedOut && !r.crash && got === t.expect && exitOk;
      const exitNote = r && !exitOk ? `The program exited with code ${r.exitCode ?? 0}, but this test expects exit code ${t.exit}.` : undefined;
      return { name: t.name, pass, hidden: t.hidden, stdin: t.stdin, files: t.files, args: t.args, expected: t.expect, got, note: pass ? undefined : exitNote ?? note };
    });
    const first = res.runs[0];
    runNote = first && ex.tests[0]?.exit != null && (first.exitCode ?? 0) === ex.tests[0].exit && !first.crash && !first.timedOut ? undefined : describeRun(first);
  }
  const allPass = tests.length > 0 && tests.every((t) => t.pass) && ruleProblems.length === 0;
  return { status: allPass ? "pass" : "fail", diagnostics, rawDiagnostics: res.diagnostics, tests, ruleProblems, output, compileMs: res.compileMs, runNote };
}

/** Free-run: compile and run with custom stdin, no grading. */
export async function runOnly(lang: "c" | "cpp", code: string, stdin: string, extra: { files?: Record<string, string>; args?: string[] } = {}) {
  const res = await compileAndRun(code, lang, [runInput({ stdin, ...extra })]);
  return {
    compiled: res.compiled,
    /** Set when the compiler itself couldn't run (it isn't the program's fault). */
    internalError: res.internalError,
    diagnostics: parseDiagnostics(res.diagnostics, code.split("\n").length),
    rawDiagnostics: res.internalError ?? res.diagnostics,
    run: res.runs[0],
    note: res.compiled ? describeRun(res.runs[0]) : undefined,
  };
}
