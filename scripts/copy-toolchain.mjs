// Puts the in-browser toolchain into public/toolchain so Vite serves it same-origin and
// the Pages build ships it. The files are large (~113 MB) and gitignored; they are
// recreated on every install.
//
// Clang and LLD come straight from browsercc. The sysroot does too, except that its
// C++ libraries are swapped for the ones in vendor/libcxx-eh, built with WebAssembly
// exception handling (scripts/build-eh-runtime.sh), plus libunwind and libarena.
// The precompiled standard-library header is then rebuilt to match, with the same
// Clang, because a PCH only loads with the exact flags it was built with.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let dist;
try {
  dist = path.dirname(require.resolve("browsercc/dist/clang.wasm"));
} catch {
  console.warn("[copy-toolchain] browsercc not installed yet, skipping");
  process.exit(0);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const VENDOR = path.join(ROOT, "vendor/libcxx-eh");
const { CPP_FLAGS_PCH, PCH_PATH, Toolchain } = await import("../src/compiler/core.js");
const version = JSON.parse(fs.readFileSync(path.join(dist, "..", "package.json"), "utf8")).version;
const out = path.join(ROOT, "public/toolchain");
fs.mkdirSync(out, { recursive: true });

for (const f of ["clang.wasm", "lld.wasm"]) {
  const src = path.join(dist, f);
  const dst = path.join(out, f);
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) fs.copyFileSync(src, dst);
}

// ---------------------------------------------------------------- sysroot
const LIB = "lib/wasm32-wasi/";
const replaced = { "libc++.a": null, "libc++abi.a": null };
const added = ["libunwind.a", "libarena.a"];
const vendored = (f) => fs.readFileSync(path.join(VENDOR, f));

/** Rewrites a ustar archive: swaps the contents of some members and appends new ones. */
function patchTar(buf) {
  const parts = [];
  let off = 0;
  let template = null;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString("latin1").replace(/\0.*$/s, "");
    const prefix = header.subarray(345, 500).toString("latin1").replace(/\0.*$/s, "");
    const full = prefix ? prefix + "/" + name : name;
    const size = parseInt(header.subarray(124, 136).toString("latin1").trim() || "0", 8);
    const data = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    const base = full.startsWith(LIB) ? full.slice(LIB.length) : null;
    if (base && base in replaced) {
      parts.push(member(header, full, vendored(base)));
      template = header;
    } else if (!(base && added.includes(base))) parts.push(Buffer.from(header), data, Buffer.alloc((512 - (size % 512)) % 512));
  }
  if (!template) throw new Error("sysroot.tar has no " + LIB + "libc++.a");
  for (const f of added) parts.push(member(template, LIB + f, vendored(f)));
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

/** A tar member for a short (under 100 bytes) path, with the other header fields copied from a template. */
function member(templateHeader, fullName, data) {
  const h = Buffer.from(templateHeader);
  if (Buffer.byteLength(fullName) >= 100) throw new Error("path too long for a simple tar header: " + fullName);
  h.fill(0, 0, 100);
  h.write(fullName, 0, "latin1");
  h.fill(0, 345, 500);
  h.write(data.length.toString(8).padStart(11, "0") + "\0", 124, "latin1");
  h.fill(0x20, 148, 156);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "latin1");
  return Buffer.concat([h, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

const sysroot = patchTar(fs.readFileSync(path.join(dist, "sysroot.tar")));
const clangWasm = fs.readFileSync(path.join(dist, "clang.wasm"));
const key = crypto.createHash("sha256").update(sysroot).update(clangWasm).update(JSON.stringify(CPP_FLAGS_PCH) + "no-pch-timestamp").digest("hex").slice(0, 12);
const sysrootOut = path.join(out, "sysroot.tar");
if (!fs.existsSync(sysrootOut) || !fs.readFileSync(sysrootOut).equals(sysroot)) fs.writeFileSync(sysrootOut, sysroot);

// ---------------------------------------------------------------- precompiled header
const pchOut = path.join(out, "stdc++.h.pch");
const stamp = path.join(out, "pch.key");
if (!fs.existsSync(pchOut) || !fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== key) {
  const t0 = Date.now();
  const { default: Clang } = await import("browsercc/dist/clang.js");
  const clangModule = await WebAssembly.compile(clangWasm);
  const tc = new Toolchain({ Clang, LLD: null, clangModule, lldModule: null, sysroot: sysroot.buffer.slice(sysroot.byteOffset, sysroot.byteOffset + sysroot.byteLength), pch: null });
  fs.writeFileSync(pchOut, await tc.buildPch(CPP_FLAGS_PCH));
  fs.writeFileSync(stamp, key);
  console.log(`[copy-toolchain] built the precompiled header in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ---------------------------------------------------------------- gzip copies
// About a third of the size; the compiler worker downloads these and unpacks them as they
// arrive (DecompressionStream), falling back to the full files in browsers without it.
// Served as plain .gz files, so this works whether or not the host compresses on its own.
const FILES = ["clang.wasm", "lld.wasm", "sysroot.tar", "stdc++.h.pch"];
const gzKeysFile = path.join(out, "gz.keys");
let gzKeys = {};
try {
  gzKeys = JSON.parse(fs.readFileSync(gzKeysFile, "utf8"));
} catch {
  /* first run */
}
for (const f of FILES) {
  const raw = fs.readFileSync(path.join(out, f));
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  if (gzKeys[f] === hash && fs.existsSync(path.join(out, f + ".gz"))) continue;
  const t0 = Date.now();
  fs.writeFileSync(path.join(out, f + ".gz"), zlib.gzipSync(raw, { level: 9 }));
  gzKeys[f] = hash;
  console.log(`[copy-toolchain] compressed ${f} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
fs.writeFileSync(gzKeysFile, JSON.stringify(gzKeys));

// The version names the browser's cache, so any change here makes browsers fetch the new files once.
const manifest = { version: `${version}+eh.${key}`, files: {}, gzip: {} };
for (const f of FILES) {
  manifest.files[f] = fs.statSync(path.join(out, f)).size;
  manifest.gzip[f] = fs.statSync(path.join(out, f + ".gz")).size;
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[copy-toolchain] browsercc ${version} with exception-enabled C++ libraries -> public/toolchain`);
