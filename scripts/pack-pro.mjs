// Packs pro-track/starter into dist/pro/cpp-arena-pro.tar.gz so learners can
// download the Pro Track starter straight from the deployed site.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(ROOT, "pro-track", "starter");
const outDir = path.join(ROOT, "dist", "pro");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "cpp-arena-pro.tar.gz");
execFileSync("tar", ["-czf", out, "--exclude=build", "--exclude=build-*", "--exclude=.cache", "-C", src, "."]);
console.log(`pro starter: ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
