/// <reference lib="webworker" />
// Persistent worker that owns the Clang + LLD toolchain.
// Downloads once (kept in Cache Storage), compiles the wasm modules once,
// then turns source code into runnable wasm on request.
// @ts-ignore - emscripten glue has no types
import Clang from "browsercc/dist/clang.js";
// @ts-ignore - emscripten glue has no types
import LLD from "browsercc/dist/lld.js";
import { Toolchain } from "./core.js";
import { CACHE_PREFIX, fetchManifest, type Manifest } from "./manifest";

const canGunzip = typeof DecompressionStream === "function";
/** The number of bytes actually downloaded for a file. */
const downloadSize = (f: string) => (canGunzip && manifest!.gzip?.[f]) || manifest!.files[f];

let toolchain: Toolchain | null = null;
let readyPromise: Promise<void> | null = null;
let pchPromise: Promise<void> | null = null;
let base = "";
let manifest: Manifest | null = null;
const progress: Record<string, number> = {};

function post(msg: unknown, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

function reportProgress(stage: string) {
  if (!manifest) return;
  const core = ["clang.wasm", "lld.wasm", "sysroot.tar"];
  const total = core.reduce((a, f) => a + downloadSize(f), 0);
  const loaded = core.reduce((a, f) => a + Math.min(progress[f] || 0, downloadSize(f)), 0);
  post({ type: "progress", loaded, total, stage });
}

async function fetchCached(file: string): Promise<ArrayBuffer> {
  const url = new URL(file, base).href;
  const cacheName = CACHE_PREFIX + (manifest?.version ?? "x");
  let cache: Cache | null = null;
  try {
    cache = await caches.open(cacheName);
    const hit = await cache.match(url);
    if (hit) {
      const buf = await hit.arrayBuffer();
      progress[file] = buf.byteLength;
      reportProgress("cache");
      return buf;
    }
  } catch {
    cache = null;
  }
  // The gzip copy is about a third of the size; the browser unpacks it as it arrives.
  const gz = canGunzip && !!manifest?.gzip?.[file];
  const res = await fetch(gz ? url + ".gz" : url).catch(() => null);
  if (!res) throw new Error("couldn't download the compiler (check your connection)");
  if (!res.ok || !res.body) throw new Error(`couldn't download ${file} (HTTP ${res.status})`);
  let got = 0;
  let body: ReadableStream<Uint8Array> = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        got += chunk.length;
        progress[file] = got;
        reportProgress("download");
        ctl.enqueue(chunk);
      },
    }),
  );
  if (gz) body = body.pipeThrough(new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>);
  const out = new Uint8Array(await new Response(body).arrayBuffer());
  if (cache) {
    try {
      await cache.put(url, new Response(out, { headers: { "Content-Type": "application/octet-stream" } }));
      // Drop caches from older toolchain versions.
      for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== cacheName) await caches.delete(k);
    } catch {
      /* quota exceeded or private mode: still works, just downloads next time */
    }
  }
  return out.buffer;
}

async function init() {
  const manifestUrl = new URL("manifest.json", base).href;
  manifest = await fetchManifest(manifestUrl);
  if (!manifest) throw new Error("couldn't download the compiler (check your connection)");
  reportProgress("download");
  const [clangBuf, lldBuf, sysroot] = await Promise.all([
    fetchCached("clang.wasm"),
    fetchCached("lld.wasm"),
    fetchCached("sysroot.tar"),
  ]);
  // With every file saved, keep the manifest beside them: without a connection it's how
  // the next visit finds this version (fetchManifest).
  try {
    await (await caches.open(CACHE_PREFIX + manifest.version)).put(manifestUrl, new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }));
  } catch {
    /* no Cache Storage: nothing was saved for offline use anyway */
  }
  post({ type: "progress", loaded: 1, total: 1, stage: "compile" });
  const [clangModule, lldModule] = await Promise.all([WebAssembly.compile(clangBuf), WebAssembly.compile(lldBuf)]);
  toolchain = new Toolchain({ Clang, LLD, clangModule, lldModule, sysroot, pch: null });
  post({ type: "ready" });
  // Warm the JIT with a tiny C compile so the first real compile is faster.
  try {
    await toolchain.compile({ source: "int main(void){return 0;}", lang: "c" });
  } catch {
    /* ignore */
  }
}

function ensurePch() {
  if (!pchPromise) {
    pchPromise = fetchCached("stdc++.h.pch").then((buf) => {
      toolchain!.setPch(buf);
      post({ type: "pch" });
    });
  }
  return pchPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "init") {
    base = msg.base;
    if (!readyPromise) {
      readyPromise = init().catch((err) => {
        readyPromise = null;
        post({ type: "error", message: String(err?.message ?? err) });
        throw err;
      });
      // The failure is reported above, and compile requests await readyPromise themselves;
      // without a handler here a failed download is also an unhandled rejection.
      readyPromise.catch(() => {});
    }
    if (msg.warmCpp) readyPromise.then(ensurePch).catch(() => {});
    return;
  }
  if (msg.type === "compile") {
    try {
      if (!readyPromise) throw new Error("the compiler hasn't started");
      await readyPromise;
      if (msg.lang === "cpp") {
        try {
          await ensurePch();
        } catch {
          /* compile without the precompiled header; slower but works */
        }
      }
      const r = await toolchain!.compile({ source: msg.source, lang: msg.lang });
      const transfer: Transferable[] = r.wasm ? [r.wasm.buffer] : [];
      post({ type: "compiled", id: msg.id, ok: r.ok, diagnostics: r.diagnostics, wasm: r.wasm, ms: r.ms }, transfer);
    } catch (err: any) {
      post({ type: "compiled", id: msg.id, ok: false, diagnostics: "", internal: String(err?.message ?? err), wasm: null, ms: 0 });
    }
  }
};
