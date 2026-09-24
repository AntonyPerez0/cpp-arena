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
const BASE_PATH = process.env.BASE_PATH ?? "/cpp-arena/";
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
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
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

console.log("e2e against", BASE);
await test("home renders", async () => {
  await go("/");
  await page.getByText("writing real code").waitFor();
  await shot("home");
});

await test("fill step passes with the right answer (downloads compiler)", async () => {
  await go("/learn/c-hello/1");
  const t0 = Date.now();
  await page.locator("input.blank").first().fill("printf");
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
  console.log(`    first compile incl. toolchain download: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.getByText(/Step complete|unlocked/).waitFor();
  await shot("step-pass");
});

await test("fill step fails with a wrong answer and shows expected vs got", async () => {
  await go("/learn/c-hello/2");
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
  await go("/learn/c-hello/5");
  await check();
  await page.locator(".banner", { hasText: "It didn't compile" }).waitFor({ timeout: 5000 });
  await page.getByText(/missing its semicolon/).first().waitFor();
  await page.getByRole("button", { name: /Hint \(1\// }).click();
  await page.locator(".hint").first().waitFor();
  await shot("compile-error");
});

await test("code step passes after writing the solution in the editor", async () => {
  await go("/learn/c-hello/3");
  const step = content.modules.find((m) => m.id === "c-hello").steps[2];
  await setEditor(step.solution);
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
});

await test("infinite loop is killed with a time-limit message", async () => {
  await go("/learn/c-hello/3");
  await setEditor('#include <stdio.h>\nint main(void) {\n    while (1) { }\n    return 0;\n}\n');
  const t0 = Date.now();
  await check();
  await page.getByText(/Time limit exceeded/).first().waitFor({ timeout: 8000 });
  console.log(`    killed after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
});

await test("crash (null pointer) reports a friendly runtime error", async () => {
  await go("/learn/c-hello/3");
  await setEditor('#include <stdio.h>\nint main(void) {\n    int *p = (int *)0x7fffffff;\n    printf("%d\\n", p[100000000]);\n    return 0;\n}\n');
  await check();
  await page.getByText(/Crash/).first().waitFor({ timeout: 8000 });
});

for (const m of content.modules.filter((m) => m.lang === "cpp").slice(0, 1)) {
  await test(`C++ step compiles with the precompiled STL header (${m.id})`, async () => {
    const i = m.steps.findIndex((s) => s.kind === "code");
    await go(`/learn/${m.id}/${i + 1}`);
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
      await go(`/learn/${m.id}/${hs + 1}`);
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
    const type = await page.locator(".rep").getAttribute("class");
    const topic = await page.locator(".rep-topic").first().textContent();
    if (/rep-compiles/.test(type)) await page.keyboard.press("y");
    else if (/rep-predict/.test(type)) {
      await page.locator(".answer-input").fill("definitely wrong answer");
      await page.keyboard.press("Enter");
    } else if (/rep-fill/.test(type)) {
      await page.locator("input.blank").fill("zzz");
      await page.keyboard.press("Enter");
    } else if (/rep-bug/.test(type)) await page.locator("button.bugline").first().click();
    else if (/rep-boss/.test(type)) await page.getByRole("button", { name: "Give up" }).click();
    answered++;
    void topic;
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
  await go("/learn/c-files/2");
  const step = content.modules.find((m) => m.id === "c-files").steps[1];
  await setEditor(step.solution);
  await check();
  await page.locator(".banner", { hasText: "All tests passed" }).waitFor({ timeout: 5000 });
});

await test("command-line arguments and exit codes are graded (c-program 6)", async () => {
  await go("/learn/c-program/6");
  const step = content.modules.find((m) => m.id === "c-program").steps[5];
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
  for (const hash of ["/pro", "/pro/toolchain", "/pro/performance", "/learn/c-types/1"]) {
    await phone.goto(BASE + hash.replace(/^\//, ""));
    await phone.waitForSelector(".page-head, .step-grid", { timeout: 10000 });
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`${hash} is ${overflow}px wider than the screen`);
  }
  await phone.close();
});

await test("mobile layout renders the step page", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/learn/c-hello/3");
  await page.locator(".cm-content").waitFor();
  await shot("mobile-step");
  await go("/deathmatch");
  await shot("mobile-lobby");
  await page.setViewportSize({ width: 1360, height: 900 });
});

await test("progress persisted in localStorage", async () => {
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("cpp-arena-v1")));
  if (!s.steps["c-hello-1"]?.done) throw new Error("step 1 not saved as done");
});

// ---------------------------------------------------------------- accessibility
// axe-core checks WCAG 2.2 A/AA rules (plus best practices) on every kind of page,
// including interactive states: results shown, a drill in progress, the death screen.
const a11yCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
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
  const routes = ["/", "/learn", "/learn/c-hello/1", "/learn/c-memory/7", "/learn/c-files/2", "/deathmatch", "/projects", "/projects/calculator", "/pro", "/pro/toolchain", "/pro/kvstore", "/profile", "/no-such-page"];
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
  await apGo("/learn/c-hello/2");
  await ap.locator("input.blank").first().fill("wrong");
  await ap.getByRole("button", { name: /^Check/ }).click();
  await ap.locator(".t-fail").first().waitFor({ timeout: 240000 });
  await ap.getByRole("button", { name: /Hint/ }).click();
  await axe("failed fill step");
  const status = await ap.locator('[role="status"]').first().textContent();
  if (!/tests? failed/.test(status ?? "")) throw new Error("results were not announced: " + status);
  await apGo("/learn/c-hello/5");
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
    else break;
    await ap.waitForTimeout(150);
  }
  if (seen.size < 3) throw new Error("only saw rep types: " + [...seen].join(", "));
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
  await apGo("/learn/c-hello/3");
  await ap.locator(".cm-content").click();
  await ap.keyboard.press("Escape");
  await ap.keyboard.press("Tab");
  const left = await ap.evaluate(() => !document.activeElement?.closest(".cm-editor"));
  if (!left) throw new Error("Escape then Tab did not leave the code editor");
});

// ---------------------------------------------------------------- SEO
await test("SEO: real URLs, per-page metadata, sitemap and old hash links", async () => {
  const get = async (p) => (await page.request.get(BASE + p)).text();
  const step = await get("learn/c-pointers/2/");
  for (const [re, what] of [
    [/<title>Change the caller's variable · Pointers \(C\) \| C\/C\+\+ Arena<\/title>/, "title"],
    [/<meta name="description" content="Remember that C passes arguments by value/, "description"],
    [/<link rel="canonical" href="https:\/\/[^"]+\/learn\/c-pointers\/2\/"/, "canonical"],
    [/<meta property="og:image"/, "og:image"],
    [/"@type":"LearningResource"/, "structured data"],
    [/<h1>Change the caller's variable<\/h1>/, "pre-rendered content"],
  ])
    if (!re.test(step)) throw new Error("step page is missing its " + what);
  const home = await get("");
  if (!/"@type":"Course"/.test(home)) throw new Error("home page has no Course structured data");
  const sitemap = await get("sitemap.xml");
  const urls = (sitemap.match(/<loc>/g) ?? []).length;
  if (urls < 300) throw new Error("sitemap has only " + urls + " URLs");
  if (/profile/.test(sitemap)) throw new Error("the private profile page is in the sitemap");
  const titles = new Set();
  for (const m of content.modules.slice(0, 6)) titles.add((await get(`learn/${m.id}/1/`)).match(/<title>(.*?)<\/title>/)[1]);
  if (titles.size !== 6) throw new Error("pages share titles");
  await page.goto(BASE + "#/learn/c-hello/2");
  await page.waitForURL(/\/learn\/c-hello\/2$/);
  await page.getByRole("heading", { name: "Printing your own text" }).waitFor();
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
