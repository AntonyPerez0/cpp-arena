// Load the browsercc toolchain in Node (used by verify-wasm.mjs).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import Clang from "browsercc/dist/clang.js";
import LLD from "browsercc/dist/lld.js";
import { Toolchain } from "../src/compiler/core.js";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("browsercc/dist/clang.wasm"));

// The sysroot and precompiled header are the site's own (scripts/copy-toolchain.mjs builds them
// from browsercc's plus the exception-enabled C++ libraries), so verification uses exactly what
// the browser downloads.
const site = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../public/toolchain");

export async function loadNodeToolchain() {
  if (!fs.existsSync(path.join(site, "stdc++.h.pch"))) throw new Error("public/toolchain is missing: run `node scripts/copy-toolchain.mjs` (npm install does)");
  const read = (f) => fs.readFileSync(path.join(dist, f));
  const readSite = (f) => fs.readFileSync(path.join(site, f));
  const [clangModule, lldModule] = await Promise.all([
    WebAssembly.compile(read("clang.wasm")),
    WebAssembly.compile(read("lld.wasm")),
  ]);
  const sysroot = readSite("sysroot.tar");
  const pch = readSite("stdc++.h.pch");
  return new Toolchain({
    Clang,
    LLD,
    clangModule,
    lldModule,
    sysroot: sysroot.buffer.slice(sysroot.byteOffset, sysroot.byteOffset + sysroot.byteLength),
    pch: pch.buffer.slice(pch.byteOffset, pch.byteOffset + pch.byteLength),
  });
}
