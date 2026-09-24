// Load the browsercc toolchain in Node (used by verify-wasm.mjs).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import Clang from "browsercc/dist/clang.js";
import LLD from "browsercc/dist/lld.js";
import { Toolchain } from "../src/compiler/core.js";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("browsercc/dist/clang.wasm"));

export async function loadNodeToolchain() {
  const read = (f) => fs.readFileSync(path.join(dist, f));
  const [clangModule, lldModule] = await Promise.all([
    WebAssembly.compile(read("clang.wasm")),
    WebAssembly.compile(read("lld.wasm")),
  ]);
  const sysroot = read("sysroot.tar");
  const pch = read("stdc++.h.pch");
  return new Toolchain({
    Clang,
    LLD,
    clangModule,
    lldModule,
    sysroot: sysroot.buffer.slice(sysroot.byteOffset, sysroot.byteOffset + sysroot.byteLength),
    pch: pch.buffer.slice(pch.byteOffset, pch.byteOffset + pch.byteLength),
  });
}
