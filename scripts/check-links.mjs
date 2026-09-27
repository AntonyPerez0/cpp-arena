// Checks every outside link the site shows or the Pro Track uses: lessons, topics, projects,
// the "Where to go next" page, the app itself and the Pro Track starter. Run weekly by
// .github/workflows/links.yml, which opens an issue listing anything broken.
//
// Usage: node scripts/check-links.mjs [--list] [--report report.md]
// Exit code: 0 all fine, 1 some links broken, 2 the checker itself failed.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SOURCES = [
  { dir: "content", ext: /\.ya?ml$/ },
  { dir: "src", ext: /\.(tsx?|js)$/, skip: ["generated"] },
  { dir: "pro-track/starter", ext: /\.(md|cmake|txt)$/ },
  { file: "scripts/prerender.mjs" },
  { file: "index.html" },
];
// Identifiers rather than pages, and addresses built at run time.
const IGNORE = [/\$\{/, /^https?:\/\/(localhost|127\.|example\.(com|org))/, /^https:\/\/api\.github\.com/, /^http:\/\/www\.sitemaps\.org\/schemas\//];

/** Every outside URL in the sources, with the files that use it. */
export function collect(root = ROOT) {
  const files = [];
  const walk = (dir, ext, skip = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.includes(e.name)) walk(f, ext, skip);
      } else if (ext.test(e.name) || e.name === "CMakeLists.txt") files.push(f);
    }
  };
  for (const s of SOURCES) {
    if (s.file) files.push(path.join(root, s.file));
    else walk(path.join(root, s.dir), s.ext, s.skip);
  }
  const urls = new Map();
  for (const f of files) {
    for (const m of fs.readFileSync(f, "utf8").matchAll(/https?:\/\/[^\s)"'<>`\]]+/g)) {
      const url = m[0].replace(/[.,;:!?]+$/, "");
      if (IGNORE.some((re) => re.test(url))) continue;
      if (!urls.has(url)) urls.set(url, new Set());
      urls.get(url).add(path.relative(root, f));
    }
  }
  return urls;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches one URL. "ok": it loads. "blocked": the site refuses automated checkers (401,
 * 403, 429), so it can't be judged. "broken": gone (404, 410, other 4xx), or still failing
 * (5xx, no answer, unknown host) after retries.
 */
export async function check(url, { tries = 3, timeoutMs = 20000, backoffMs = 3000 } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(backoffMs * i);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; cpp-arena-link-check; +https://github.com/AntonyPerez0/cpp-arena)", Accept: "text/html,*/*" },
      });
      await res.body?.cancel();
      if (res.ok) return { status: "ok", detail: String(res.status) };
      if ([401, 403, 429].includes(res.status)) return { status: "blocked", detail: `HTTP ${res.status}` };
      last = `HTTP ${res.status}`;
      if (res.status < 500) break; // 404 and friends won't change on a retry
    } catch (e) {
      last = e?.cause?.code ?? e?.name ?? String(e);
      if (last === "ENOTFOUND") break;
    }
  }
  return { status: "broken", detail: last };
}

/** Markdown for the issue: broken links first, then the ones that couldn't be checked. */
export function report(results) {
  const broken = results.filter((r) => r.status === "broken");
  const blocked = results.filter((r) => r.status === "blocked");
  const row = (r) => `- ${r.url} (${r.detail}), used in ${r.files.map((f) => "`" + f + "`").join(", ")}`;
  const out = [`The weekly link check found ${broken.length} broken outside link${broken.length === 1 ? "" : "s"} (of ${results.length} checked).`, "", ...broken.map(row)];
  if (blocked.length) out.push("", "These sites refused the automated check, so they may be fine:", "", ...blocked.map(row));
  out.push("", "Fix or replace them in the files listed; this issue closes itself once every link works (`.github/workflows/links.yml`).");
  return out.join("\n") + "\n";
}

async function main(args) {
  const urls = collect();
  if (args.includes("--list")) {
    for (const [u, files] of urls) console.log(u, "  <-", [...files].join(", "));
    return 0;
  }
  const list = [...urls];
  const results = [];
  // A few at a time, so no site sees a burst of requests.
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(list.slice(i, i + 4).map(async ([url, files]) => ({ url, files: [...files], ...(await check(url)) })));
    results.push(...batch);
  }
  for (const r of results) console.log(`${r.status.padEnd(7)} ${r.url} (${r.detail})`);
  const broken = results.filter((r) => r.status === "broken").length;
  const at = args.indexOf("--report");
  if (at >= 0 && broken) fs.writeFileSync(args[at + 1], report(results));
  console.log(`\n${results.length} links: ${broken} broken, ${results.filter((r) => r.status === "blocked").length} refused the check`);
  return broken ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e);
      process.exit(2);
    },
  );
}
