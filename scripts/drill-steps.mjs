// Works out which lesson step teaches each drill, so Deathmatch can unlock a drill
// only after the learner has done that step (not as soon as they start the module).
//
// A drill "uses" the language and library features in its code: keywords, std:: names,
// library calls and member calls, macros and headers. Each feature is "introduced" by
// the first step of the drill's module that uses it, in its text or code. The drill
// belongs to the latest of those steps. Features the module never mentions (things
// from earlier modules, or the drill's own names) don't count. A drill can name its
// step explicitly with `after: <step id>` in its YAML.

const KEYWORDS = new Set(
  (
    "alignas alignof auto bool break case catch char char8_t class co_await co_return co_yield concept const consteval constexpr constinit " +
    "const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if " +
    "inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast requires return " +
    "short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename " +
    "union unsigned using virtual void volatile wchar_t while restrict _Bool _Generic _Static_assert _Alignas _Alignof"
  ).split(" "),
);
// Everywhere from the first lesson on; they carry no information about which step a drill needs.
const COMMON = new Set("int char void return main printf std cout endl include iostream stdio.h string vector const if else for while".split(" "));

/** The features a piece of code (or `inline code` in prose) uses. */
export function features(code) {
  const out = new Set();
  const src = code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, " ").replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  for (const m of code.matchAll(/#include\s*[<"]([\w./]+)[>"]/g)) out.add("<" + m[1] + ">");
  // Names the code defines itself (types, functions, macros) aren't features it learned.
  const own = new Set();
  for (const m of src.matchAll(/\b(?:struct|class|union|enum(?:\s+class)?|typedef[^;]*?|using|#define|concept)\s+(\w+)/g)) own.add(m[1]);
  // Declarations and definitions: a type word right before the name, like `long now(`, `Node *make(`.
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)[ \t*&>]+([A-Za-z_]\w*)\s*\(/g)) {
    if (!/^(return|else|new|delete|throw|case|sizeof|alignof|co_return|co_yield|goto)$/.test(m[1])) own.add(m[2]);
  }
  for (const m of src.matchAll(/(?:[A-Za-z_]\w*::)+[A-Za-z_]\w*|[A-Za-z_]\w*/g)) {
    const t = m[0];
    const i = m.index;
    const after = src.slice(i + t.length).match(/^\s*(\(|<)?/)[1];
    const before = src.slice(Math.max(0, i - 2), i);
    if (t.includes("::")) out.add(t.replace(/^std::/, "std::"));
    else if (KEYWORDS.has(t)) out.add(t);
    else if (/^[A-Z][A-Z0-9_]{2,}$/.test(t) && !own.has(t)) out.add(t);
    else if ((before.endsWith(".") || before.endsWith("->")) && after === "(" && !own.has(t)) out.add("." + t);
    else if (after === "(" && !own.has(t) && /^[a-z_]\w*$/.test(t)) out.add(t + "()");
    else if (/^memory_order_\w+$/.test(t)) out.add(t);
  }
  // A few ideas that are syntax rather than names.
  if (/\b(?:int|char|void|double|float|long|short|unsigned|\w+_t|struct\s+\w+|[A-Z]\w*)\s*\*\s*\*\s*[A-Za-z_]|[=(,;{]\s*\*\*[A-Za-z_]/.test(src)) out.add("pointer to pointer");
  if (/\bconst\s+(?:struct\s+)?\w+\s*\*|\w\s*\*\s*const\b/.test(src)) out.add("const pointer");
  if (/->/.test(src)) out.add("->");
  for (const t of COMMON) out.delete(t), out.delete(t + "()");
  return out;
}

/** Code blocks and `inline code` of a Markdown text, joined. */
function codeOf(md) {
  const parts = [];
  for (const m of md.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) parts.push(m[1]);
  for (const m of md.replace(/```[\s\S]*?```/g, "").matchAll(/`([^`\n]+)`/g)) parts.push(m[1]);
  return parts.join("\n");
}

const STOP = new Set(
  (
    "about above after again also always another answer anything around because before being below between both cannot could does doesn't " +
    "during each either every example first from gets give given have here into it's just keep know later least less like line lines " +
    "make makes many might more most much must need never next nothing only other same should since some something still such than that " +
    "their them then there these they thing things this those though through under until using value values very what when where which " +
    "while whole will with without would write your you'll you're print prints right wrong code program step steps true false"
  ).split(" "),
);

/** Lowercase prose words that might name a concept ("deadlock", "collapsing"), crudely de-pluralized. */
function words(text) {
  const out = new Set();
  for (const m of text.toLowerCase().matchAll(/[a-z][a-z'-]{3,}/g)) {
    const w = m[0].replace(/'s$/, "").replace(/(?<=[a-z]{3})(es|s)$/, "");
    if (!STOP.has(m[0]) && !STOP.has(w)) out.add(w);
  }
  return out;
}

/**
 * Sets `step` (a step id) on every drill of a lesson topic. `errors` collects bad
 * `after:` overrides. Interview drills have no module, so they get no step.
 */
export function assignDrillSteps(modules, drills, errors) {
  // Where each feature first appears in the whole course. A feature counts for a drill only
  // if its module is where the course introduces it: printf in a pointers drill was taught
  // long before, even if the pointers module first shows it in its last step.
  const introduced = new Map(); // feature -> { module, step }
  const byModule = new Map();
  for (const m of modules) {
    const first = new Map();
    const stepWords = m.steps.map((s) => words(s.title + " " + (s.text ?? "")));
    const df = new Map();
    for (const ws of stepWords) for (const w of ws) df.set(w, (df.get(w) ?? 0) + 1);
    m.steps.forEach((s, i) => {
      const f = features([codeOf(s.text ?? ""), s.seed ?? "", s.solution ?? ""].join("\n"));
      for (const t of f) if (!introduced.has(t)) introduced.set(t, { module: m.id, step: i });
    });
    for (const [t, where] of introduced) if (where.module === m.id) first.set(t, where.step);
    byModule.set(m.id, { m, first, stepWords, df });
  }
  for (const d of drills) {
    const mod = byModule.get(d.topic);
    if (!mod) continue;
    if (d.after) {
      if (!mod.m.steps.some((s) => s.id === d.after)) errors.push(`drill ${d.id}: after: ${d.after} is not a step of ${d.topic}`);
      d.step = d.after;
      delete d.after;
      continue;
    }
    // Code: the latest step that introduces a feature the drill uses. A fill drill's blank counts as filled in.
    const shown = d.type === "fill" ? (d.display ?? "").replace(/\[\[[^\]]*\]\]/, d.answer) : d.display ?? "";
    const code = [shown, d.fix ?? "", d.exercise?.solution ?? "", codeOf(d.prompt ?? ""), ...(d.choices ?? []).map(codeOf)].join("\n");
    let at = -1;
    for (const t of features(code)) if (mod.first.has(t)) at = Math.max(at, mod.first.get(t));
    if (at < 0) {
      // No code features: a question in words. Pick the step whose text shares the most
      // informative words with the question, its choices and its explanation.
      const n = mod.m.steps.length;
      const dw = words([d.prompt ?? "", ...(d.choices ?? []), d.why ?? ""].join(" "));
      let best = 0;
      let bestScore = 0;
      mod.stepWords.forEach((ws, i) => {
        let score = 0;
        for (const w of dw) if (ws.has(w)) score += Math.log(n / mod.df.get(w));
        if (score > bestScore + 1e-9) (best = i), (bestScore = score);
      });
      // A question with no code has nothing better to go on. A drill with code whose features
      // all come from earlier modules (pointer syntax, printf) moves only on a clear match:
      // weaker scores come from words shared by chance, so it stays with the first step.
      const hasCode = !!(d.display ?? "").trim();
      at = !hasCode || bestScore >= 4 ? best : 0;
    }
    d.step = mod.m.steps[at].id;
  }
}
