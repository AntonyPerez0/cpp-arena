import { useSyncExternalStore } from "react";
import { ensureCompiler, getCompilerStatus, subscribeCompiler } from "../compiler/client";

export function useCompilerStatus() {
  return useSyncExternalStore(subscribeCompiler, getCompilerStatus, getCompilerStatus);
}

export default function CompilerBadge({ compact }: { compact?: boolean }) {
  const s = useCompilerStatus();
  if (s.state === "idle")
    return (
      <button className="pill pill-idle" onClick={() => ensureCompiler()} title="Download the in-browser C/C++ compiler (one time, about 95 MB)">
        ⚙ Load compiler
      </button>
    );
  if (s.state === "loading") {
    const pct = s.stage === "compile" ? 100 : Math.floor((s.loaded / Math.max(s.total, 1)) * 100);
    return (
      <span className="pill pill-loading" title="Downloading Clang (cached after the first time)">
        <span className="pill-bar" style={{ width: pct + "%" }} />
        <span className="pill-text">{s.stage === "compile" ? "Starting compiler…" : compact ? `${pct}%` : `Compiler ${pct}%`}</span>
      </span>
    );
  }
  if (s.state === "error")
    return (
      <button className="pill pill-error" onClick={() => ensureCompiler()} title={s.message}>
        ⚠ Compiler failed, retry
      </button>
    );
  return <span className="pill pill-ready" title="Clang 20 running in your browser (WebAssembly)">● Compiler ready</span>;
}
