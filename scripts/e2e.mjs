// End-to-end smoke test in headless Chromium.
// Serves dist/ under a sub-path (like GitHub Pages) and drives the real UI:
// the compiler downloads, lessons pass and fail, deathmatch runs, projects check.
//
// Usage: npm run build && node scripts/e2e.mjs [--shots dir]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const DIST = path.resolve("dist");
const PORT = 4789;
const BASE_PATH = process.env.BASE_PATH ?? "/";
const BASE = `http://localhost:${PORT}${BASE_PATH}`;
const shotsIdx = process.argv.indexOf("--shots");
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith(BASE_PATH)) {
    res.writeHead(404).end();
    return;
  }
  p = p.slice(BASE_PATH.length - 1);
  // Like GitHub Pages: a directory serves its index.html, and unknown paths get 404.html.
  let f = path.join(DIST, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  let status = 200;
  if (!f.startsWith(DIST) || !fs.existsSync(f)) {
    f = path.join(DIST, "404.html");
    status = 404;
  }
  res.writeHead(status, { "Content-Type": types[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
// Use full Chromium (the "chromium" channel), the build real browsers are based on. Playwright's
// default headless shell crashes the tab on the out-of-bounds-crash test, which full Chromium
// (and Chrome) handle correctly by reporting the program's crash.
const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: "chromium" });
// Deathmatch, the daily pick and choice order use Math.random. Seed it in every page so a run is
// repeatable: the same seed gives the same drills in the same order. E2E_SEED picks another sequence.
const SEED = Number(process.env.E2E_SEED ?? 1);
const newContext = browser.newContext.bind(browser);
browser.newContext = async (opts) => {
  const ctx = await newContext(opts);
  await ctx.addInitScript((seed) => {
    let a = seed >>> 0;
    Math.random = () => {
      // mulberry32
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, SEED);
  return ctx;
};
// Service workers are tested on their own below; elsewhere they'd only add caching to reason about.
const mainCtx = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: "block" });
const page = await mainCtx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
let failures = 0;
const ok = (name) => console.log("  ✓", name);
const bad = (name, e) => {
  failures++;
  console.log("  ✗", name, "\n   ", String(e?.message ?? e).split("\n").slice(0, 6).join("\n    "));
};
async function test(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    bad(name, e);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "fail-" + name.replace(/\W+/g, "_") + ".png"), fullPage: true });
  }
}
const shot = async (name) => SHOTS && page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true });
const go = async (route) => {
  await page.goto("about:blank");
  await page.goto(BASE + route.replace(/^\//, ""));
  await page.waitForLoadState("domcontentloaded");
};
const setEditor = async (code) => {
  await page.locator(".cm-content").waitFor();
  await page.evaluate((c) => {
    const view = window.__cmView;
    if (!view) throw new Error("no editor view");
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: c } });
  }, code);
};
const check = async (label = /^Check/) => {
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForSelector(".results", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector(".actions .btn-primary")?.hasAttribute("disabled"), null, { timeout: 240000 });
};

const content = JSON.parse(fs.readFileSync("src/generated/content.json", "utf8"));
/** The address of a module's nth step (1-based, today's order). */
const L = (moduleId, n) => {
  const m = content.modules.find((x) => x.id === moduleId);
  if (!m?.steps[n - 1]) throw new Error(`no step ${n} in ${moduleId}`);
  return `/learn/${moduleId}/${m.steps[n - 1].slug}`;
};

console.log(`e2e against ${BASE} (random seed ${SEED})`);
await test("home renders", async () => {
  await go("/");
  await page.getByText("writing real code").waitFor();
  await shot("home");
});

await test("fill step passes with the right answer (downloads compiler)", async () => {
  await go(L("c-hello", 1));
  const t0 = Date.now();
  await page.locator("input.blank").first().fill("printf");
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
  console.log(`    first compile incl. toolchain download: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.getByText(/Step complete|unlocked/).waitFor();
  await shot("step-pass");
});

await test("fill step fails with a wrong answer and shows expected vs got", async () => {
  await go(L("c-hello", 2));
  await page.locator("input.blank").first().fill("I am learning Python");
  const t0 = Date.now();
  await check();
  console.log(`    warm compile+run: ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  await page.locator(".t-fail").first().waitFor({ timeout: 5000 });
  await page.getByText("I am learning Python").first().waitFor();
  await page.locator(".blank-wrong").first().waitFor();
  await shot("step-fail");
});

await test("compile error shows friendly explanation and a hint", async () => {
  await go(L("c-hello", 5));
  await check();
  await page.locator(".banner", { hasText: "It didn't compile" }).waitFor({ timeout: 5000 });
  await page.getByText(/missing its semicolon/).first().waitFor();
  await page.getByRole("button", { name: /Hint \(1\// }).click();
  await page.locator(".hint").first().waitFor();
  await shot("compile-error");
});

await test("code step passes after writing the solution in the editor", async () => {
  await go(L("c-hello", 3));
  const step = content.modules.find((m) => m.id === "c-hello").steps[2];
  await setEditor(step.solution);
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
});

await test("infinite loop is killed with a time-limit message", async () => {
  await go(L("c-hello", 3));
  await setEditor('#include <stdio.h>\nint main(void) {\n    while (1) { }\n    return 0;\n}\n');
  const t0 = Date.now();
  await check();
  await page.getByText(/Time limit exceeded/).first().waitFor({ timeout: 8000 });
  console.log(`    killed after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
});

await test("C++ exceptions: throw and catch work, an uncaught one is reported like std::terminate", async () => {
  const m = content.modules.find((x) => x.id === "cpp-errors");
  const i = m.steps.findIndex((st) => st.id === "cpp-errors-7");
  const sol = m.steps[i].solution;
  await go(L("cpp-errors", i + 1));
  await setEditor(sol);
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 10000 });
  await setEditor(sol.replace('throw TransferError(where + "insufficient funds");', "throw 42;"));
  await check();
  await page.getByText(/terminate called after throwing an instance of 'int'/).first().waitFor({ timeout: 10000 });
});

await test("crash (null pointer) reports a friendly runtime error", async () => {
  await go(L("c-hello", 3));
  await setEditor('#include <stdio.h>\nint main(void) {\n    int *p = (int *)0x7fffffff;\n    printf("%d\\n", p[100000000]);\n    return 0;\n}\n');
  await check();
  await page.getByText(/Crash/).first().waitFor({ timeout: 8000 });
});

for (const m of content.modules.filter((m) => m.lang === "cpp").slice(0, 1)) {
  await test(`C++ step compiles with the precompiled STL header (${m.id})`, async () => {
    const i = m.steps.findIndex((s) => s.kind === "code");
    await go(L(m.id, i + 1));
    await setEditor(m.steps[i].solution);
    const t0 = Date.now();
    await check();
    await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
    console.log(`    first C++ compile (incl. PCH download): ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const t1 = Date.now();
    await check();
    console.log(`    warm C++ compile+run: ${((Date.now() - t1) / 1000).toFixed(2)}s`);
  });
  const hs = m.steps.findIndex((s) => s.mode === "harness");
  if (hs >= 0)
    await test(`C++ function step with hidden tests (${m.id} ${hs + 1})`, async () => {
      await go(L(m.id, hs + 1));
      await setEditor(m.steps[hs].seed);
      await check();
      await page.locator(".t-fail, .diag").first().waitFor({ timeout: 5000 });
      await setEditor(m.steps[hs].solution);
      await check();
      await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
      await shot("cpp-harness");
    });
}

await test("deathmatch: play reps until death, respawn", async () => {
  await go("/deathmatch");
  await page.getByRole("button", { name: /^Deathmatch/ }).click();
  let answered = 0;
  for (let k = 0; k < 12; k++) {
    await page.locator(".rep, .death").first().waitFor({ timeout: 10000 });
    if (await page.locator(".death").count()) break;
    // Answer every rep wrong on purpose, whatever its type, so the one life runs out.
    const id = await page.locator(".rep").first().getAttribute("data-drill");
    const d = content.drills.find((x) => x.id === id);
    if (!d) throw new Error("unknown drill id " + id);
    if (d.type === "compiles") await page.keyboard.press(d.answer === "yes" ? "n" : "y");
    else if (d.type === "predict") {
      await page.locator(".answer-input").fill("definitely wrong answer");
      await page.keyboard.press("Enter");
    } else if (d.type === "fill") {
      await page.locator("input.blank").fill("zzz");
      await page.keyboard.press("Enter");
    } else if (d.type === "bug") await page.locator("button.bugline").nth(+d.answer === 1 ? 1 : 0).click();
    else if (d.type === "choice") await page.locator(`.rep .choice[data-choice="${+d.answer === 1 ? 1 : 0}"]`).click();
    else if (d.type === "boss") await page.getByRole("button", { name: "Give up" }).click();
    else throw new Error("no wrong answer for drill type " + d.type);
    answered++;
    await page.waitForTimeout(150);
  }
  await page.locator(".death").waitFor({ timeout: 10000 });
  await page.getByText("ELIMINATED", { exact: true }).waitFor();
  await shot("deathmatch-dead");
  await page.keyboard.press("Enter");
  await page.locator(".rep").waitFor();
  await shot("deathmatch-rep");
  console.log(`    answered ${answered} rep(s) before dying`);
});

await test("deathmatch: every drill type answered correctly builds a streak (incl. boss reps)", async () => {
  await go("/deathmatch");
  const unlock = page.getByLabel("Unlock every topic");
  if (!(await unlock.isChecked())) await unlock.check();
  await page.getByRole("button", { name: /^Casual/ }).click();
  const seen = new Set();
  let kills = 0;
  for (let k = 0; k < 18; k++) {
    const rep = page.locator(".rep").first();
    await rep.waitFor({ timeout: 15000 });
    const id = await rep.getAttribute("data-drill");
    const d = content.drills.find((x) => x.id === id);
    if (!d) throw new Error("unknown drill id " + id);
    seen.add(d.type);
    if (d.type === "predict") {
      await page.locator(".answer-input").fill(d.answer.replace(/\n/g, " "));
      await page.keyboard.press("Enter");
    } else if (d.type === "fill") {
      await page.locator(".rep input.blank").fill(d.answer);
      await page.keyboard.press("Enter");
    } else if (d.type === "compiles") {
      await page.keyboard.press(d.answer === "yes" ? "y" : "n");
    } else if (d.type === "bug") {
      await page.locator(".bugline").nth(+d.answer - 1).click();
    } else if (d.type === "choice") {
      await page.locator(`.rep .choice[data-choice="${+d.answer - 1}"]`).click();
    } else if (d.type === "boss") {
      await setEditor(d.exercise.solution);
      const t0 = Date.now();
      await page.getByRole("button", { name: /^Fire/ }).click();
      await page.waitForFunction((prev) => document.querySelector(".rep")?.getAttribute("data-drill") !== prev, id, { timeout: 240000 });
      console.log(`    boss rep ${id} (${d.lang}) compiled+passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    kills++;
    if (await page.locator(".death").count()) throw new Error("died on drill " + id);
    await page.waitForTimeout(80);
  }
  const n = await page.locator(".hud-n").innerText();
  if (+n !== kills) throw new Error(`streak shows ${n}, expected ${kills}`);
  if (!seen.has("boss")) throw new Error("no boss rep appeared");
  console.log(`    streak ${n}, types seen: ${[...seen].join(", ")}`);
  await shot("deathmatch-streak");
});

await test("project milestone passes", async () => {
  const p = content.projects[0];
  await go(`/projects/${p.id}`);
  await setEditor(p.milestones[0].solution);
  await check(/^Check milestone/);
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /Next milestone/ }).click();
  await page.getByText(/Milestone 2:/).waitFor();
  await shot("project");
});

await test("a step that reads files from the working folder passes (c-files 2)", async () => {
  await go(L("c-files", 2));
  const step = content.modules.find((m) => m.id === "c-files").steps[1];
  await setEditor(step.solution);
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
});

await test("command-line arguments and exit codes are graded (c-program challenge)", async () => {
  const steps = content.modules.find((m) => m.id === "c-program").steps;
  const at = steps.findIndex((s) => s.id === "c-program-6");
  await go(L("c-program", at + 1));
  const step = steps[at];
  await setEditor(step.solution.replace("return status;", "return 0;"));
  await check();
  await page.getByText(/expects exit code 1/).first().waitFor({ timeout: 5000 });
  await setEditor(step.solution);
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
});

await test("pro track pages render, and the starter pack downloads", async () => {
  await go("/pro");
  await page.getByText("Set up once").waitFor();
  const cmd = await page.locator(".copybox pre").innerText();
  if (!/curl -fsSL .*pro\/cpp-arena-pro\.tar\.gz \| tar -xz/.test(cmd)) throw new Error("unexpected import command: " + cmd);
  const res = await page.request.get(BASE + "pro/cpp-arena-pro.tar.gz");
  if (res.status() !== 200 || (await res.body()).length < 10000) throw new Error("starter pack missing: HTTP " + res.status());
  await page.locator(".project-card").first().click();
  await page.getByRole("heading", { name: "Compilers, linking and CMake" }).waitFor();
  await page.getByText("From source to program").waitFor();
  await page.locator(".pro-done input").check();
  await page.waitForTimeout(500); // progress is saved to localStorage after a short debounce
  await go("/pro");
  await page.getByText("1/12 projects passing").waitFor();
  await shot("pro");
});

await test("pro pages fit a phone screen (no sideways scrolling)", async () => {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const hash of ["/pro", "/pro/toolchain", "/pro/performance", L("c-types", 1), "/visualize/list-push", "/visualize/class-object", "/topics/c-pointers", "/topics/bitwise-operators", "/daily", "/placement", "/certificate", "/profile"]) {
    await phone.goto(BASE + hash.replace(/^\//, ""));
    await phone.waitForSelector("#main h1", { timeout: 10000 });
    await phone.waitForTimeout(300);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`${hash} is ${overflow}px wider than the screen`);
  }
  await phone.close();
});

await test("mobile layout renders the step page", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go(L("c-hello", 3));
  await page.locator(".cm-content").waitFor();
  await shot("mobile-step");
  await go("/deathmatch");
  await shot("mobile-lobby");
  await page.setViewportSize({ width: 1360, height: 900 });
});

await test("playground: runs C and C++ with input, shows errors and crashes, and share links carry the code", async () => {
  await go("/playground");
  await page.getByRole("heading", { name: "Playground", level: 1 }).waitFor();
  await page.getByLabel("C (C17)").check();
  await setEditor('#include <stdio.h>\nint main(void) {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) printf("sum %d\\n", a + b);\n    return 0;\n}\n');
  await page.getByLabel(/^Input/).fill("20 22");
  await page.getByRole("button", { name: /^▶ Run/ }).click();
  await page.locator(".playground .console", { hasText: "sum 42" }).waitFor({ timeout: 60000 });
  await page.getByLabel("C++ (C++20)").check();
  await setEditor('#include <iostream>\nint main() { std::cout << "x" << y; }\n');
  await page.getByRole("button", { name: /^▶ Run/ }).click();
  await page.locator(".playground .banner", { hasText: "It didn't compile" }).waitFor({ timeout: 60000 });
  await setEditor('#include <stdexcept>\nint main() { throw std::logic_error("oops"); }\n');
  await page.getByRole("button", { name: /^▶ Run/ }).click();
  await page.getByText(/terminate called after throwing an instance of 'std::logic_error'/).first().waitFor({ timeout: 60000 });
  // Share, then open the link in a fresh browser: the program and input come along.
  await setEditor('#include <iostream>\n#include <string>\nint main() { std::string w; std::cin >> w; std::cout << "shared " << w << "\\n"; }\n');
  await page.getByLabel(/^Input/).fill("hello");
  await page.getByRole("button", { name: "Share" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  if (!/\/playground#code=/.test(link)) throw new Error("unexpected share link " + link);
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const pg = await ctx.newPage();
  await pg.goto(link.replace(/^https?:\/\/[^/]+\//, BASE));
  await pg.getByLabel(/^Input/).and(pg.locator("textarea")).waitFor();
  await pg.waitForFunction(() => document.querySelector("#pg-stdin")?.value === "hello", null, { timeout: 10000 });
  if (!(await pg.getByLabel("C++ (C++20)").isChecked())) throw new Error("shared link lost the language");
  await pg.getByRole("button", { name: /^▶ Run/ }).click();
  await pg.locator(".playground .console", { hasText: "shared hello" }).waitFor({ timeout: 240000 });
  await ctx.close();
});

await test("mobile data: the compiler downloads only after asking, then stays saved", async () => {
  // A fresh browser (nothing cached) that reports mobile data, like Chrome on Android does.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { type: "cellular", effectiveType: "4g", saveData: false, addEventListener() {} } }));
  const pg = await ctx.newPage();
  const wasm = [];
  pg.on("request", (r) => /\/toolchain\/.+\.(wasm|tar|pch)(\.gz)?$/.test(r.url()) && wasm.push(r.url()));
  await pg.goto(BASE + L("c-hello", 1).slice(1));
  await pg.getByText("You're on mobile data.").waitFor();
  await pg.waitForTimeout(1500);
  if (wasm.length) throw new Error("the compiler started downloading without asking: " + wasm[0]);
  await pg.getByRole("button", { name: "Download compiler" }).click();
  await pg.getByText("Compiler ready").first().waitFor({ timeout: 240000 });
  if (!wasm.length) throw new Error("the Download button didn't fetch the compiler");
  // Browsers that can unpack gzip download the compressed copies (about a third of the size).
  if (wasm.some((u) => !u.endsWith(".gz"))) throw new Error("fetched an uncompressed toolchain file: " + wasm.find((u) => !u.endsWith(".gz")));
  // Saved in the browser now, so the next lesson loads it without asking (and without new downloads).
  wasm.length = 0;
  await pg.goto(BASE + L("c-hello", 2).slice(1));
  await pg.getByText("Compiler ready").first().waitFor({ timeout: 60000 });
  if (await pg.getByText("You're on mobile data.").count()) throw new Error("asked again although the compiler is saved");
  await ctx.close();
});

await test("progress persisted in localStorage", async () => {
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("cpp-arena-v1")));
  if (!s.steps["c-hello-1"]?.done) throw new Error("step 1 not saved as done");
});


// ---------------------------------------------------------------- new features
/** Answer whatever rep is showing correctly. */
async function answerRep(pg, drillList = content.drills) {
  const rep = pg.locator(".rep").first();
  await rep.waitFor({ timeout: 15000 });
  const id = await rep.getAttribute("data-drill");
  const d = drillList.find((x) => x.id === id) ?? content.drills.find((x) => x.id === id);
  if (!d) throw new Error("unknown drill id " + id);
  if (d.type === "predict") {
    await pg.locator(".answer-input").fill(d.answer.replace(/\n/g, " "));
    await pg.keyboard.press("Enter");
  } else if (d.type === "fill") {
    await pg.locator(".rep input.blank").fill(d.answer);
    await pg.keyboard.press("Enter");
  } else if (d.type === "compiles") {
    await pg.getByRole("button", { name: d.answer === "yes" ? /^Compiles/ : /^Compile error/ }).click();
  } else if (d.type === "bug") {
    await pg.locator(".bugline").nth(+d.answer - 1).click();
  } else if (d.type === "choice") {
    await pg.locator(`.choice[data-choice="${+d.answer - 1}"]`).click();
  } else throw new Error("can't answer " + d.type);
  return d;
}

await test("theme: the toggle switches to light and the choice is remembered", async () => {
  await go("/");
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  const after = before === "dark" ? "light" : "dark";
  await page.getByRole("button", { name: `Switch to ${after} theme` }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== after) throw new Error("theme did not change");
  await page.waitForTimeout(400);
  await go("/learn");
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== after) throw new Error("theme not remembered");
  await go("/profile");
  await page.getByLabel("Larger").check();
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  if (size < 19) throw new Error("text size did not grow: " + size);
  await page.getByLabel("Default").check();
  await page.getByLabel("Match my device").check();
  await page.waitForTimeout(400);
});

await test("symbol bar types into the editor and into blanks on a phone", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const ph = await ctx.newPage();
  await ph.goto(BASE + L("c-hello", 3).slice(1));
  await ph.locator(".cm-content").click();
  await ph.keyboard.press("Control+End");
  await ph.getByRole("button", { name: "braces" }).tap();
  await ph.getByRole("button", { name: "semicolon" }).tap();
  const text = await ph.locator(".cm-content").innerText();
  if (!text.includes("{;}")) throw new Error("editor text doesn't end with {;}: " + JSON.stringify(text.slice(-20)));
  await ph.goto(BASE + L("c-hello", 1).slice(1));
  await ph.locator("input.blank").first().fill("printf");
  await ph.getByRole("button", { name: "parentheses" }).tap();
  const v = await ph.locator("input.blank").first().inputValue();
  if (v !== "printf()") throw new Error("blank holds " + v);
  await ctx.close();
});

await test("report a problem opens a pre-filled GitHub issue", async () => {
  await go(L("c-pointers", 2));
  const link = page.getByRole("link", { name: /Report a problem/ }).first();
  await link.hover();
  const href = await link.getAttribute("href");
  const u = new URL(href);
  if (!/github\.com\/.+\/issues\/new$/.test(u.origin + u.pathname)) throw new Error("not an issue link: " + href);
  if (!u.searchParams.get("body").includes("c-pointers-2") || !u.searchParams.get("title").includes("Lesson step")) throw new Error("issue is not pre-filled");
});

await test("placement quiz: all right skips every tested module", async () => {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "placement");
  await pg.getByRole("button", { name: "Start the quiz" }).click();
  for (let i = 0; i < content.placement.length; i++) {
    await pg.getByRole("heading", { name: `Question ${i + 1} of ${content.placement.length}` }).waitFor();
    await answerRep(pg, content.placement);
  }
  await pg.getByRole("heading", { name: "Your starting point" }).waitFor();
  const last = content.modules.findIndex((m) => m.id === content.placement.at(-1).module);
  await pg.getByText(`You got ${content.placement.length} of ${content.placement.length}`).waitFor();
  await pg.getByRole("button", { name: /^Skip \d+ modules/ }).click();
  await pg.getByRole("link", { name: `Go to ${content.modules[last + 1].title}` }).click();
  await pg.waitForURL(new RegExp(`${L(content.modules[last + 1].id, 1)}$`));
  await pg.waitForTimeout(300);
  const placed = await pg.evaluate(() => JSON.parse(localStorage.getItem("cpp-arena-v1")).placed.length);
  if (placed !== last + 1) throw new Error(`placed ${placed} modules, expected ${last + 1}`);
  await pg.goto(BASE + "learn");
  await pg.getByText("skipped by placement").first().waitFor();
  await ctx.close();
});

await test("daily challenge: answer it, see the streak, and it stays done", async () => {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "daily");
  await answerRep(pg);
  await pg.getByText("Solved", { exact: true }).waitFor();
  await pg.locator(".stat-n", { hasText: "1" }).waitFor();
  await pg.waitForTimeout(300);
  await pg.reload();
  await pg.getByText("Solved", { exact: true }).waitFor();
  await ctx.close();
});

await test("interview prep: open to everyone, all question types answer correctly", async () => {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "deathmatch");
  await pg.getByRole("button", { name: "Try interview prep" }).click();
  const types = new Set();
  for (let k = 0; k < 14; k++) {
    await pg.locator(".rep-topic", { hasText: "Interview prep" }).waitFor();
    types.add((await answerRep(pg)).type);
    if (await pg.locator(".death").count()) throw new Error("a correct answer was marked wrong");
    await pg.waitForTimeout(80);
  }
  if (!types.has("choice")) throw new Error("no pick-one questions appeared: " + [...types]);
  const streak = await pg.locator(".hud-n").innerText();
  if (+streak !== 14) throw new Error("streak is " + streak);
  await ctx.close();
});

await test("visualizer: steps through a linked list with arrows and keyboard control", async () => {
  await go(L("c-lists", 2));
  await page.getByRole("link", { name: /Watch it run/ }).first().click();
  await page.getByRole("heading", { name: /Building a linked list/ }).waitFor();
  await page.locator(".vframe").first().waitFor();
  for (let i = 0; i < 20; i++) await page.getByRole("button", { name: "Next step" }).click();
  await page.locator(".viz-count", { hasText: "Step 21 of" }).waitFor();
  const arrows = await page.locator(".varrows path").count();
  const blocks = await page.locator(".vblock").count();
  if (arrows < 3 || blocks < 2) throw new Error(`expected arrows and heap blocks, got ${arrows} arrows, ${blocks} blocks`);
  await page.getByText(/points to heap block/).first().waitFor();
  await page.getByRole("button", { name: "Next step" }).focus();
  await page.keyboard.press("End");
  const last = await page.locator(".viz-count").innerText();
  const [, a, b] = last.match(/Step (\d+) of (\d+)/);
  if (a !== b) throw new Error("End key did not go to the last step: " + last);
  await page.getByText("sum = 6").first().waitFor();
  await shot("visualizer");
});

await test("topic pages render with their tested example output", async () => {
  await go("/topics");
  await page.getByRole("link", { name: "Pointers in C explained" }).click();
  await page.getByRole("heading", { name: "Pointers in C explained", level: 1 }).waitFor();
  const t = content.topics.find((x) => x.slug === "c-pointers");
  await page.locator("pre.console", { hasText: t.output.trim() }).waitFor();
  await page.getByRole("link", { name: /Lesson: Pointers/ }).waitFor();
});

await test("sync: a transfer link moves progress to a fresh browser", async () => {
  await go("/profile");
  await page.getByRole("button", { name: "Make a transfer link" }).click();
  const link = await page.getByRole("textbox", { name: "Transfer link" }).inputValue();
  if (!link.includes("/profile#transfer=")) throw new Error("bad link " + link);
  await page.locator(".qr svg").waitFor();
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const pg = await ctx.newPage();
  await pg.goto(link);
  await pg.getByRole("button", { name: "Merge into this device" }).click();
  await pg.getByText(/Merged/).waitFor();
  await pg.waitForTimeout(300);
  const done = await pg.evaluate(() => JSON.parse(localStorage.getItem("cpp-arena-v1")).steps["c-hello-1"]?.done);
  if (!done) throw new Error("progress did not arrive");
  await ctx.close();
});

await test("certificate: appears when every step is done and its share link opens", async () => {
  const ctx = await browser.newContext({ serviceWorkers: "block", permissions: ["clipboard-read", "clipboard-write"] });
  const steps = Object.fromEntries(content.modules.flatMap((m) => m.steps.map((s) => [s.id, { done: true, hintsUsed: 0, clean: true, doneAt: Date.UTC(2026, 8, 1) }])));
  await ctx.addInitScript((st) => {
    if (!localStorage.getItem("cpp-arena-v1")) localStorage.setItem("cpp-arena-v1", JSON.stringify({ version: 1, steps: st, projects: {}, drills: {}, settings: { certName: "Ada Lovelace" } }));
  }, steps);
  const pg = await ctx.newPage();
  await pg.goto(BASE + "certificate");
  await pg.locator(".cert-name", { hasText: "Ada Lovelace" }).waitFor();
  await pg.getByRole("button", { name: "Print or save as PDF" }).waitFor();
  const download = pg.waitForEvent("download");
  await pg.getByRole("button", { name: /Share image/ }).click();
  const file = await download;
  if (file.suggestedFilename() !== "cpparena-certificate-course.png") throw new Error("share image is " + file.suggestedFilename());
  const size = fs.statSync(await file.path()).size;
  if (size < 10000) throw new Error("share image is only " + size + " bytes");
  await pg.getByRole("button", { name: "Copy link" }).click();
  const url = await pg.evaluate(() => navigator.clipboard.readText());
  if (!url.includes("/certificate#view=")) throw new Error("bad share link " + url);
  const viewer = await browser.newContext({ serviceWorkers: "block" });
  const vp = await viewer.newPage();
  await vp.goto(url);
  await vp.locator(".cert-name", { hasText: "Ada Lovelace" }).waitFor();
  await vp.getByText(/can't be independently verified/).waitFor();
  await viewer.close();
  await ctx.close();
});

await test("offline: after one visit, lessons open and programs run without a connection", async () => {
  // A fresh browser with the service worker on, and a single visit (no reload), like a learner's first.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "playground");
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.getByLabel("C (C17)").check();
  await pg.getByRole("button", { name: /^▶ Run/ }).click();
  await pg.locator(".playground .console", { hasText: "Hello, Ada!" }).waitFor({ timeout: 240000 });
  await ctx.setOffline(true);
  // Pages this browser never opened: the saved app shows them.
  await pg.goto(BASE + L("c-hello", 1).slice(1));
  await pg.getByRole("heading", { name: "Your first program" }).waitFor();
  await pg.goto(BASE + "topics/recursion");
  await pg.getByRole("heading", { name: "Recursion explained", level: 1 }).waitFor();
  // The saved compiler starts without the network too.
  await pg.goto(BASE + "playground");
  await pg.getByRole("button", { name: /^▶ Run/ }).click();
  await pg.locator(".playground .console", { hasText: "Hello, Ada!" }).waitFor({ timeout: 120000 });
  await ctx.close();
});

// ---------------------------------------------------------------- accessibility
// axe-core checks WCAG 2.2 A/AA rules (plus best practices) on every kind of page,
// including interactive states: results shown, a drill in progress, the death screen.
// The site follows the device's light or dark setting; these checks run in dark, and a later one forces light.
const a11yCtx = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: "block", colorScheme: "dark" });
await a11yCtx.addInitScript(() => {
  if (!localStorage.getItem("cpp-arena-v1"))
    localStorage.setItem("cpp-arena-v1", JSON.stringify({ version: 1, steps: {}, projects: {}, drills: {}, settings: { sound: false, unlockAll: true, topics: null, boss: false, keys: true } }));
});
const ap = await a11yCtx.newPage();
async function axe(label) {
  const r = await new AxeBuilder({ page: ap }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  if (r.violations.length) {
    throw new Error(
      `${label}: ` +
        r.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}x) at ${v.nodes[0].target.join(" ")}: ${v.nodes[0].failureSummary?.split("\n")[1] ?? ""}`).join("\n"),
    );
  }
}
const apGo = async (route) => {
  await ap.goto(BASE + route.replace(/^\//, ""));
  await ap.locator("#main h1, #main .hero h1").first().waitFor({ timeout: 15000 });
};

await test("accessibility: every page type passes axe (WCAG 2.2 AA)", async () => {
  const routes = ["/", "/learn", L("c-hello", 1), L("c-memory", 7), L("c-files", 2), "/deathmatch", "/projects", "/projects/calculator", "/pro", "/pro/toolchain", "/pro/kvstore", "/profile", "/no-such-page", "/topics", "/topics/c-pointers", "/visualize", "/visualize/list-push", "/daily", "/placement", "/certificate"];
  const problems = [];
  for (const r of routes) {
    await apGo(r);
    await ap.waitForTimeout(300);
    try {
      await axe(r);
    } catch (e) {
      problems.push(e.message);
    }
  }
  if (problems.length) throw new Error(problems.join("\n"));
});

await test("accessibility: results, compile errors and hints pass axe", async () => {
  await apGo(L("c-hello", 2));
  await ap.locator("input.blank").first().fill("wrong");
  await ap.getByRole("button", { name: /^Check/ }).click();
  await ap.locator(".t-fail").first().waitFor({ timeout: 240000 });
  await ap.getByRole("button", { name: /Hint/ }).click();
  await axe("failed fill step");
  const status = await ap.locator('[role="status"]').first().textContent();
  if (!/tests? failed/.test(status ?? "")) throw new Error("results were not announced: " + status);
  await apGo(L("c-hello", 5));
  await ap.getByRole("button", { name: /^Check/ }).click();
  await ap.locator(".banner", { hasText: "It didn't compile" }).waitFor({ timeout: 60000 });
  await axe("compile error");
});

await test("accessibility: deathmatch reps and the death screen pass axe", async () => {
  await apGo("/deathmatch");
  await axe("lobby");
  await ap.getByRole("button", { name: /^Casual/ }).click();
  const seen = new Set();
  for (let k = 0; k < 30 && seen.size < 4; k++) {
    await ap.locator(".rep, .death").first().waitFor({ timeout: 10000 });
    if (await ap.locator(".death").count()) {
      await ap.waitForTimeout(400);
      await axe("review screen");
      await ap.getByRole("button", { name: /Continue|Respawn/ }).click();
      continue;
    }
    const type = (await ap.locator(".rep").getAttribute("class")).match(/rep-(\w+)/)[1];
    if (!seen.has(type)) {
      seen.add(type);
      await ap.waitForTimeout(400); // let the rep's fade-in finish so contrast is measured at full opacity
      await axe("rep " + type);
    }
    if (type === "compiles") await ap.getByRole("button", { name: /Compiles/ }).click();
    else if (type === "predict") {
      await ap.getByRole("textbox", { name: /What does it print/ }).fill("x");
      await ap.keyboard.press("Enter");
    } else if (type === "fill") {
      await ap.locator("input.blank").fill("zzz");
      await ap.keyboard.press("Enter");
    } else if (type === "bug") await ap.getByRole("button", { name: /^Line \d+:/ }).first().click();
    else if (type === "choice") await ap.locator(".rep .choice").first().click();
    else break;
    await ap.waitForTimeout(150);
  }
  if (seen.size < 3) throw new Error("only saw rep types: " + [...seen].join(", "));
});

await test("phone width: pages fit the screen and pass axe", async () => {
  // At 360px wide, tables and code blocks scroll inside the page, never the page itself,
  // and whatever scrolls must be reachable with the keyboard.
  const phone = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: "dark" });
  await phone.addInitScript(() => {
    if (!localStorage.getItem("cpp-arena-v1"))
      localStorage.setItem("cpp-arena-v1", JSON.stringify({ version: 1, steps: {}, projects: {}, drills: {}, settings: { sound: false, unlockAll: true, topics: null, boss: false, keys: true } }));
  });
  const pp = await phone.newPage();
  const routes = ["/", "/learn", L("c-pointers", 5), L("cpp-basics", 7), L("dsa-dp", 6), "/deathmatch", "/projects/calculator", "/pro/performance", "/topics/std-map", "/visualize/list-push", "/profile", "/next", "/topics/memory-ordering", "/playground"];
  const problems = [];
  for (const r of routes) {
    await pp.goto(BASE + r.replace(/^\//, ""));
    const h1 = pp.locator("#main h1").first();
    await h1.waitFor({ timeout: 15000 });
    if (!(await h1.textContent())?.trim()) problems.push(`${r}: empty h1`);
    await pp.waitForTimeout(300);
    const extra = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (extra > 1) problems.push(`${r}: page scrolls sideways by ${extra}px`);
    const res = await new AxeBuilder({ page: pp }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    for (const v of res.violations) problems.push(`${r}: ${v.id} (${v.nodes.length}x) at ${v.nodes[0].target.join(" ")}`);
  }
  await phone.close();
  if (problems.length) throw new Error(problems.join("\n"));
});


await test("accessibility: the light theme and new pages pass axe", async () => {
  await ap.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cpp-arena-v1"));
    s.settings.theme = "light";
    localStorage.setItem("cpp-arena-v1", JSON.stringify(s));
  });
  const problems = [];
  for (const r of ["/", "/learn", L("c-lists", 2), "/deathmatch", "/profile", "/topics/c-pointers", "/visualize/list-push", "/daily", "/placement", "/certificate"]) {
    await apGo(r);
    await ap.waitForTimeout(400);
    if ((await ap.evaluate(() => document.documentElement.dataset.theme)) !== "light") problems.push(r + ": not in the light theme");
    try {
      await axe("light " + r);
    } catch (e) {
      problems.push(e.message);
    }
  }
  await apGo(L("c-hello", 2));
  await ap.locator("input.blank").first().fill("wrong");
  await ap.getByRole("button", { name: /^Check/ }).click();
  await ap.locator(".t-fail").first().waitFor({ timeout: 240000 });
  await ap.waitForTimeout(400);
  try {
    await axe("light failed step");
  } catch (e) {
    problems.push(e.message);
  }
  await apGo("/visualize/virtual-dispatch");
  for (let i = 0; i < 4; i++) await ap.getByRole("button", { name: "Next step" }).click();
  try {
    await axe("light visualizer mid-run");
  } catch (e) {
    problems.push(e.message);
  }
  await apGo("/deathmatch");
  await ap.getByRole("button", { name: /^Interview prep/ }).click();
  await ap.locator(".rep").waitFor();
  await ap.waitForTimeout(400);
  try {
    await axe("light interview rep");
  } catch (e) {
    problems.push(e.message);
  }
  await ap.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cpp-arena-v1"));
    s.settings.theme = "dark";
    localStorage.setItem("cpp-arena-v1", JSON.stringify(s));
  });
  if (problems.length) throw new Error(problems.join("\n"));
});

await test("keyboard: skip link, focus moves to the new page, editor can be left", async () => {
  await apGo("/learn");
  await ap.keyboard.press("Tab");
  const first = await ap.evaluate(() => document.activeElement?.textContent?.trim());
  if (first !== "Skip to content") throw new Error("first Tab stop is " + first);
  await ap.keyboard.press("Enter");
  const inMain = await ap.evaluate(() => !!document.activeElement?.closest("#main") || document.activeElement?.id === "main");
  if (!inMain) throw new Error("skip link did not move focus to the content");
  await ap.getByRole("link", { name: "Projects" }).first().click();
  await ap.getByRole("heading", { name: "Projects", level: 1 }).waitFor();
  const focused = await ap.evaluate(() => document.activeElement?.tagName + ":" + document.activeElement?.textContent);
  if (!/^H1:Projects/.test(focused)) throw new Error("after navigation focus is on " + focused);
  const title = await ap.title();
  if (!/^Projects \| C\/C\+\+ Arena/.test(title)) throw new Error("page title is " + title);
  await apGo(L("c-hello", 3));
  await ap.locator(".cm-content").click();
  await ap.keyboard.press("Escape");
  await ap.keyboard.press("Tab");
  const left = await ap.evaluate(() => !document.activeElement?.closest(".cm-editor"));
  if (!left) throw new Error("Escape then Tab did not leave the code editor");
});

// ---------------------------------------------------------------- SEO
await test("SEO: real URLs, per-page metadata, sitemap and old hash links", async () => {
  const get = async (p) => (await page.request.get(BASE + p)).text();
  const step = await get(L("c-pointers", 2).slice(1) + "/");
  for (const [re, what] of [
    [/<title>Change the caller's variable · Pointers \(C\) \| C\/C\+\+ Arena<\/title>/, "title"],
    [/<meta name="description" content="Remember from the functions module: C passes arguments by value/, "description"],
    [new RegExp(`<link rel="canonical" href="https://[^"]+${L("c-pointers", 2)}/"`), "canonical"],
    [/<meta property="og:image"/, "og:image"],
    [/"@type":"LearningResource"/, "structured data"],
    [/<h1>Change the caller's variable<\/h1>/, "pre-rendered content"],
  ])
    if (!re.test(step)) throw new Error("step page is missing its " + what);
  const home = await get("");
  if (!/"@type":"Course"/.test(home)) throw new Error("home page has no Course structured data");
  const sitemap = await get("sitemap.xml");
  const urls = (sitemap.match(/<loc>/g) ?? []).length;
  if (urls < 380) throw new Error("sitemap has only " + urls + " URLs");
  for (const p of ["/topics/c-pointers/", "/visualize/list-push/", "/daily/", "/placement/", "/next/", "/playground/"]) if (!sitemap.includes(p)) throw new Error("sitemap is missing " + p);
  const topicHtml = await get("topics/c-pointers/");
  if (!/"@type":"TechArticle"/.test(topicHtml) || !/<h1>Pointers in C explained<\/h1>/.test(topicHtml)) throw new Error("topic page is not pre-rendered");
  const manifest = await page.request.get(BASE + "manifest.webmanifest");
  if (manifest.status() !== 200 || !(await manifest.json()).icons?.length) throw new Error("web app manifest missing");
  if (/profile/.test(sitemap)) throw new Error("the private profile page is in the sitemap");
  const titles = new Set();
  for (const m of content.modules.slice(0, 6)) titles.add((await get(L(m.id, 1).slice(1) + "/")).match(/<title>(.*?)<\/title>/)[1]);
  if (titles.size !== 6) throw new Error("pages share titles");
  // Old links: hash routing (#/learn/c-hello/2) and numbered steps both land on the step's permanent address.
  await page.goto(BASE + "#/learn/c-hello/2");
  await page.waitForURL(new RegExp(`${L("c-hello", 2)}$`));
  await page.getByRole("heading", { name: "Printing your own text" }).waitFor();
  // Step 6 of cpp-generic was its challenge before new steps were inserted; the old number still opens it.
  const challenge = content.modules.find((m) => m.id === "cpp-generic").steps.find((st) => st.id === "cpp-generic-6");
  const forward = await get("learn/cpp-generic/6/");
  if (!forward.includes(`/learn/cpp-generic/${challenge.slug}/`) || !/http-equiv="refresh"/.test(forward)) throw new Error("old numbered address doesn't forward to the same lesson");
  if (/\/learn\/[a-z0-9-]+\/\d+\//.test(sitemap)) throw new Error("the sitemap lists numbered step addresses");
  await page.goto(BASE + "learn/cpp-generic/6/#hints");
  await page.waitForURL(new RegExp(`/learn/cpp-generic/${challenge.slug}/?#hints$`));
  await page.getByRole("heading", { name: challenge.title, level: 1 }).waitFor();
  await page.goto(BASE + "learn/c-hello/2");
  await page.waitForURL(new RegExp(`${L("c-hello", 2)}/?$`));
  const res = await page.request.get(BASE + "no-such-page");
  if (res.status() !== 404) throw new Error("unknown pages should return 404, got " + res.status());
  await page.goto(BASE + "no-such-page");
  await page.getByRole("heading", { name: "Page not found" }).waitFor();
});
await a11yCtx.close();

const realErrors = errors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 404/.test(e));
if (realErrors.length) {
  console.log("\nBrowser errors:\n  " + realErrors.join("\n  "));
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} e2e failure(s)` : "\nall e2e checks passed");
process.exit(failures ? 1 : 0);
