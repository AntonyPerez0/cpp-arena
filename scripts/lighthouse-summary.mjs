// Prints a Markdown table of the Lighthouse CI results in lhci/ (median of each page's
// runs), for the GitHub job summary. Thresholds live in lighthouserc.json.
import fs from "node:fs";

const runs = JSON.parse(fs.readFileSync("lhci/manifest.json", "utf8"));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pages = new Map();
for (const r of runs) {
  const path = new URL(r.url).pathname;
  const report = JSON.parse(fs.readFileSync(r.jsonPath, "utf8"));
  const script = report.audits["resource-summary"].details.items.find((i) => i.resourceType === "script")?.transferSize ?? 0;
  if (!pages.has(path)) pages.set(path, []);
  pages.get(path).push({ ...r.summary, script });
}
const cats = ["performance", "accessibility", "best-practices", "seo"];
const lines = ["### Lighthouse (phone, median of " + Math.max(...[...pages.values()].map((r) => r.length)) + " runs)", "", "| Page | Performance | Accessibility | Best practices | SEO | Code (KB) |", "|---|---|---|---|---|---|"];
for (const [path, rs] of pages) {
  const score = (c) => Math.round(median(rs.map((r) => r[c])) * 100);
  lines.push(`| \`${path}\` | ${cats.map(score).join(" | ")} | ${Math.round(median(rs.map((r) => r.script)) / 1024)} |`);
}
lines.push("", "Fails below 80 performance, below 95 for the rest, or over 900 KB of code (lighthouserc.json).");
console.log(lines.join("\n"));
