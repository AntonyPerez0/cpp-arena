// Pure helpers shared by the browser grader and the Node content scripts.

/** Blank markers in fill-in templates look like [[answer]] or [[answer‖alt1‖alt2]] (U+2016 separates accepted alternatives). */
export const BLANK_RE = /\[\[(?!\[)(.*?)\]\]/g;

/** Split a fill template into text parts and blank answers. */
export function parseTemplate(template) {
  const parts = [];
  const blanks = [];
  let last = 0;
  for (const m of template.matchAll(BLANK_RE)) {
    parts.push(template.slice(last, m.index));
    const alts = m[1].split("‖");
    blanks.push({ answer: alts[0], accept: alts });
    last = m.index + m[0].length;
  }
  parts.push(template.slice(last));
  return { parts, blanks };
}

/** Rebuild source from a template and the learner's blank values. */
export function fillTemplate(template, values) {
  const { parts } = parseTemplate(template);
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) out += (values[i - 1] ?? "") + parts[i];
  return out;
}

/** The reference solution of a fill template (first alternative of each blank). */
export function templateSolution(template) {
  const { blanks } = parseTemplate(template);
  return fillTemplate(template, blanks.map((b) => b.answer));
}

const C_HELPERS = String.raw`
/* ---- hidden test harness ---- */
#include <stdio.h>
#include <string.h>
#define CHECK(name, cond) do { if (cond) printf("\n@@PASS %s\n", name); else printf("\n@@FAIL %s|condition was false|\n", name); } while (0)
#define CHECK_INT(name, got, want) do { long long g__ = (long long)(got), w__ = (long long)(want); if (g__ == w__) printf("\n@@PASS %s\n", name); else printf("\n@@FAIL %s|%lld|%lld\n", name, w__, g__); } while (0)
#define CHECK_DBL(name, got, want) do { double g__ = (double)(got), w__ = (double)(want); double d__ = g__ - w__; if (d__ < 0) d__ = -d__; if (d__ < 1e-6) printf("\n@@PASS %s\n", name); else printf("\n@@FAIL %s|%g|%g\n", name, w__, g__); } while (0)
#define CHECK_STR(name, got, want) do { const char *g__ = (got), *w__ = (want); if (g__ && strcmp(g__, w__) == 0) printf("\n@@PASS %s\n", name); else printf("\n@@FAIL %s|\"%s\"|\"%s\"\n", name, w__, g__ ? g__ : "(null)"); } while (0)
`;

const CPP_HELPERS = String.raw`
/* ---- hidden test harness ---- */
#pragma GCC diagnostic ignored "-Wsign-compare"
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
namespace chk__ {
template <class T> std::string show(const T& v) { std::ostringstream o; o << v; return o.str(); }
inline std::string show(const std::string& s) { return "\"" + s + "\""; }
inline std::string show(const char* s) { return s ? "\"" + std::string(s) + "\"" : "(null)"; }
inline std::string show(bool b) { return b ? "true" : "false"; }
inline std::string show(char c) { return std::string("'") + c + "'"; }
template <class T> std::string show(const std::vector<T>& v) {
  std::string s = "{";
  for (std::size_t i = 0; i < v.size(); ++i) { if (i) s += ", "; s += show(v[i]); }
  return s + "}";
}
}
template <class A, class B> void CHECK_EQ(const char* name, const A& got, const B& want) {
  if (got == want) std::cout << "\n@@PASS " << name << "\n";
  else std::cout << "\n@@FAIL " << name << "|" << chk__::show(want) << "|" << chk__::show(got) << "\n";
}
inline void CHECK(const char* name, bool ok) {
  if (ok) std::cout << "\n@@PASS " << name << "\n";
  else std::cout << "\n@@FAIL " << name << "|condition was false|\n";
}
`;

/** Program = learner code + helpers + hidden test main(). */
export function harnessSource(lang, userCode, harness) {
  return userCode.replace(/\s*$/, "\n") + (lang === "c" ? C_HELPERS : CPP_HELPERS) + "\n" + harness;
}

/** Parse @@PASS / @@FAIL lines. Returns checks and the remaining (learner) output. */
export function parseChecks(stdout) {
  const checks = [];
  const rest = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^@@(PASS|FAIL) ([^|]*)(?:\|([^|]*)\|(.*))?$/);
    if (m) checks.push({ pass: m[1] === "PASS", name: m[2].trim(), expected: m[3], got: m[4] });
    else rest.push(line);
  }
  return { checks, output: rest.join("\n").replace(/^\n+|\n+$/g, "") };
}

/** Normalise program output for comparison: unify newlines, drop trailing spaces and blank tail. */
export function normalizeOutput(s) {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

/** Looser comparison used by predict-the-output drills: all whitespace runs collapse. */
export function looseOutput(s) {
  return s.replace(/\s+/g, " ").trim();
}

/** Strip comments and string/char literals so require/forbid rules only see code. */
export function stripForRules(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

export function checkRules(src, require = [], forbid = []) {
  const code = stripForRules(src);
  const problems = [];
  for (const r of require) if (!new RegExp(r.pattern, r.flags || "").test(code)) problems.push(r.message);
  for (const r of forbid) if (new RegExp(r.pattern, r.flags || "").test(code)) problems.push(r.message);
  return problems;
}

const C_DRILL_HEAD = "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n#include <stdint.h>\n#include <limits.h>\n";
const CPP_DRILL_HEAD =
  "#include <iostream>\n#include <string>\n#include <vector>\n#include <map>\n#include <set>\n#include <unordered_map>\n#include <algorithm>\n#include <numeric>\n#include <memory>\n#include <optional>\n#include <utility>\n#include <array>\n#include <functional>\n#include <string_view>\n#include <tuple>\n#include <variant>\n#include <ranges>\n#include <concepts>\n#include <span>\n#include <stack>\n#include <queue>\n#include <unordered_set>\n#include <type_traits>\n#include <sstream>\n#include <deque>\n#include <list>\n#include <iomanip>\n#include <fstream>\n#include <iterator>\n#include <cstdint>\n#include <climits>\n#include <atomic>\n";

/**
 * Drills show only `display` (pre + body). The full program wraps it with
 * standard includes and, when the drill has a body, an int main.
 */
export function drillProgram(lang, pre, body) {
  const head = lang === "c" ? C_DRILL_HEAD : CPP_DRILL_HEAD;
  const p = pre ? pre.replace(/\s*$/, "\n") : "";
  if (body == null || body === "") return head + p;
  const indented = body.replace(/\s*$/, "").split("\n").map((l) => (l ? "    " + l : l)).join("\n");
  return head + p + (lang === "c" ? "int main(void) {\n" : "int main() {\n") + indented + "\n    return 0;\n}\n";
}

export function drillDisplay(pre, body) {
  const p = pre ? pre.replace(/\s*$/, "") : "";
  const b = body ? body.replace(/\s*$/, "") : "";
  if (p && b) return p + "\n\n// inside main:\n" + b;
  return p || b;
}

/** What one test run gets: plain stdin text, or { stdin, files, args } when the test has files or arguments. */
export function runInput(t) {
  if (!t) return "";
  const hasFiles = t.files && Object.keys(t.files).length > 0;
  const hasArgs = t.args && t.args.length > 0;
  if (!hasFiles && !hasArgs) return t.stdin ?? "";
  return { stdin: t.stdin ?? "", files: t.files ?? {}, args: (t.args ?? []).map(String) };
}
