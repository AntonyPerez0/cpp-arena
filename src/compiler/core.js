// Toolchain core shared by the browser worker and the Node verification script.
// Wraps browsercc's Clang/LLD Emscripten builds so the big wasm modules are
// compiled once and re-instantiated cheaply for every compile.
import { WASI, File, OpenFile, ConsoleStdout, PreopenDirectory, WASIProcExit } from "@bjorn3/browser_wasi_shim";

export const PCH_PATH = "/include/bits/stdc++.h.pch";

export const C_FLAGS = ["-std=c17", "-O1", "-Wall", "-Wextra", "-fdiagnostics-color=never"];
// The precompiled STL header only matches exactly these three flags.
export const CPP_FLAGS_PCH = ["-O2", "-std=c++20", "-fno-exceptions"];
export const CPP_FLAGS = [...CPP_FLAGS_PCH, "-Wall", "-Wextra", "-fdiagnostics-color=never"];

/** Split a tar archive into files. */
export function untar(buffer) {
  const data = new Uint8Array(buffer);
  const dec = new TextDecoder();
  const files = [];
  let off = 0;
  while (off + 512 <= data.length) {
    const header = data.subarray(off, off + 512);
    const name = dec.decode(header.subarray(0, 100)).replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(dec.decode(header.subarray(124, 136)).replace(/\0.*$/s, "").trim(), 8) || 0;
    const start = off + 512;
    if (!name.endsWith("/")) files.push({ name, content: data.slice(start, start + size) });
    off = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

function writeFiles(mod, files) {
  const made = new Set();
  for (const { name, content } of files) {
    const dir = name.split("/").slice(0, -1).join("/");
    if (dir && !made.has(dir)) {
      if (!mod.FS.analyzePath(dir).exists) mod.FS.mkdirTree(dir);
      made.add(dir);
    }
    mod.FS.writeFile(name, content);
  }
}

export class Toolchain {
  /**
   * @param {{Clang:any, LLD:any, clangModule:WebAssembly.Module, lldModule:WebAssembly.Module, sysroot:ArrayBuffer, pch?:ArrayBuffer|null}} o
   */
  constructor(o) {
    this.Clang = o.Clang;
    this.LLD = o.LLD;
    this.clangModule = o.clangModule;
    this.lldModule = o.lldModule;
    const all = untar(o.sysroot);
    // Clang only needs headers, the linker only needs libraries.
    this.headerFiles = all.filter((f) => f.name.startsWith("include/") || /^lib\/clang\/\d+\/include\//.test(f.name));
    this.libFiles = all.filter((f) => f.name.startsWith("lib/") && !/^lib\/clang\/\d+\/include\//.test(f.name));
    this.pch = o.pch ? new Uint8Array(o.pch) : null;
    this.invocations = new Map();
  }

  setPch(buf) {
    this.pch = buf ? new Uint8Array(buf) : null;
  }

  _instantiate(factory, module, program, sink) {
    return factory({
      thisProgram: program,
      print: (s) => sink.push(s),
      printErr: (s) => sink.push(s),
      instantiateWasm(imports, done) {
        WebAssembly.instantiate(module, imports).then((inst) => done(inst, module));
        return {};
      },
    });
  }

  async _invocation(fileName, flags) {
    const key = fileName + "\u0000" + flags.join(" ");
    const hit = this.invocations.get(key);
    if (hit) return hit;
    const lines = [];
    const driver = fileName.endsWith(".c") ? "clang" : "clang++";
    const clang = await this._instantiate(this.Clang, this.clangModule, driver, lines);
    clang.FS.writeFile(fileName, "");
    clang.FS.mkdirTree("/lib/wasm32-wasi");
    clang.FS.mkdirTree("/include/c++/v1");
    clang.FS.writeFile("/lib/wasm32-wasi/crt1-command.o", new Uint8Array(0));
    clang.FS.writeFile("/lib/wasm32-wasi/crt1-reactor.o", new Uint8Array(0));
    const code = clang.callMain([fileName, ...flags, "-###"]);
    if (code !== 0) throw new Error("Clang driver failed:\n" + lines.join("\n"));
    const all = lines.join("\n").split("\n");
    const pick = (needle) => {
      const line = all.find((l) => l.includes(needle));
      if (!line) throw new Error("Could not find " + needle + " in driver output");
      const args = line.match(/"([^"]*)"/g).map((s) => s.slice(1, -1)).slice(1);
      return { args, out: args[args.indexOf("-o") + 1] };
    };
    const inv = { cc1: pick("-cc1"), ld: pick("wasm-ld") };
    this.invocations.set(key, inv);
    return inv;
  }

  /**
   * Compile one translation unit and link it.
   * @param {{source:string, lang:'c'|'cpp'}} job
   * @returns {Promise<{ok:boolean, diagnostics:string, wasm:Uint8Array|null, ms:number}>}
   */
  async compile({ source, lang }) {
    const t0 = performance.now();
    const fileName = lang === "c" ? "main.c" : "main.cpp";
    let flags = lang === "c" ? C_FLAGS : CPP_FLAGS;
    const usePch = lang === "cpp" && this.pch;
    if (usePch) flags = [...flags, "-include-pch", PCH_PATH];
    const inv = await this._invocation(fileName, flags);
    const diag = [];
    const clang = await this._instantiate(this.Clang, this.clangModule, "clang++", diag);
    writeFiles(clang, this.headerFiles);
    if (usePch) writeFiles(clang, [{ name: PCH_PATH, content: this.pch }]);
    clang.FS.writeFile(fileName, source);
    let code;
    try {
      code = clang.callMain([...inv.cc1.args]);
    } catch (e) {
      diag.push("internal compiler error: " + (e && e.message ? e.message : String(e)));
      code = 1;
    }
    if (code !== 0) return { ok: false, diagnostics: diag.join("\n"), wasm: null, ms: performance.now() - t0 };
    const obj = clang.FS.readFile(inv.cc1.out);
    const lld = await this._instantiate(this.LLD, this.lldModule, "wasm-ld", diag);
    writeFiles(lld, this.libFiles);
    lld.FS.writeFile(inv.cc1.out, obj);
    try {
      code = lld.callMain([...inv.ld.args]);
    } catch (e) {
      diag.push("internal linker error: " + (e && e.message ? e.message : String(e)));
      code = 1;
    }
    if (code !== 0) return { ok: false, diagnostics: diag.join("\n"), wasm: null, ms: performance.now() - t0 };
    const wasm = lld.FS.readFile(inv.ld.out);
    return { ok: true, diagnostics: diag.join("\n"), wasm, ms: performance.now() - t0 };
  }
}

export const OUTPUT_LIMIT = 64 * 1024;

class OutputLimit extends Error {}

/**
 * Run a compiled WASI program synchronously.
 * `input` is either the stdin text or { stdin, files, args }. Every run gets
 * its own empty in-memory working directory, pre-filled with `files`
 * (name -> text), and `args` become argv[1..].
 * @param {WebAssembly.Module} module
 * @param {string | {stdin?: string, files?: Record<string,string>, args?: string[]}} input
 * @returns {{stdout:string, stderr:string, exitCode:number|null, crash:string|null, truncated:boolean}}
 */
export function runWasi(module, input) {
  const { stdin = "", files = {}, args = [] } = typeof input === "string" || input == null ? { stdin: input ?? "" } : input;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let stdout = "";
  let stderr = "";
  let total = 0;
  let truncated = false;
  const sink = (which) => (bytes) => {
    total += bytes.length;
    const text = dec.decode(bytes);
    if (which === 1) stdout += text;
    else stderr += text;
    if (total > OUTPUT_LIMIT) {
      truncated = true;
      throw new OutputLimit("output limit");
    }
  };
  const fds = [
    new OpenFile(new File(enc.encode(stdin || ""))),
    new ConsoleStdout(sink(1)),
    new ConsoleStdout(sink(2)),
    new PreopenDirectory(".", new Map(Object.entries(files).map(([name, text]) => [name, new File(enc.encode(text))]))),
  ];
  const wasi = new WASI(["main", ...args], [], fds, { debug: false });
  let exitCode = null;
  let crash = null;
  try {
    const inst = new WebAssembly.Instance(module, { wasi_snapshot_preview1: wasi.wasiImport });
    exitCode = wasi.start(inst);
  } catch (e) {
    if (e instanceof WASIProcExit) exitCode = e.code;
    else if (e instanceof OutputLimit) crash = "output-limit";
    else crash = e && e.message ? e.message : String(e);
  }
  return { stdout, stderr, exitCode, crash, truncated };
}
