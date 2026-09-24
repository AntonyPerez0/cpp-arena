/// <reference lib="webworker" />
// Short-lived worker that runs a compiled program against each stdin case.
// The main thread kills it if a case runs too long (infinite loops).
import { runWasi } from "./core.js";
import type { RunInput } from "./client";

self.onmessage = async (e: MessageEvent) => {
  const { wasm, inputs } = e.data as { wasm: Uint8Array; inputs: RunInput[] };
  let module: WebAssembly.Module;
  try {
    module = await WebAssembly.compile(wasm as Uint8Array<ArrayBuffer>);
  } catch (err: any) {
    (self as unknown as Worker).postMessage({ type: "fatal", message: String(err?.message ?? err) });
    return;
  }
  for (let i = 0; i < inputs.length; i++) {
    (self as unknown as Worker).postMessage({ type: "start", index: i });
    const t0 = performance.now();
    const r = runWasi(module, inputs[i]);
    (self as unknown as Worker).postMessage({ type: "result", index: i, ms: performance.now() - t0, ...r });
  }
  (self as unknown as Worker).postMessage({ type: "done" });
};
