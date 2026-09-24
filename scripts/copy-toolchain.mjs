// Copies the browsercc toolchain out of node_modules into public/toolchain so
// Vite serves it same-origin and the Pages build ships it. The files are
// large (~113 MB total) and are gitignored; they are recreated on every install.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let dist;
try {
  dist = path.dirname(require.resolve("browsercc/dist/clang.wasm"));
} catch {
  console.warn("[copy-toolchain] browsercc not installed yet, skipping");
  process.exit(0);
}
const version = JSON.parse(fs.readFileSync(path.join(dist, "..", "package.json"), "utf8")).version;
const out = path.resolve("public/toolchain");
fs.mkdirSync(out, { recursive: true });
const files = ["clang.wasm", "lld.wasm", "sysroot.tar", "stdc++.h.pch"];
const manifest = { version, files: {} };
for (const f of files) {
  const src = path.join(dist, f);
  const dst = path.join(out, f);
  const size = fs.statSync(src).size;
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== size) fs.copyFileSync(src, dst);
  manifest.files[f] = size;
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[copy-toolchain] browsercc ${version} -> public/toolchain`);
