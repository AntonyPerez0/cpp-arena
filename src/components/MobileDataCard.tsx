import { useEffect, useState } from "react";
import { downloadMegabytes, ensureCompiler, mayAutoDownload } from "../compiler/client";
import { getState, patchSettings, useStore } from "../state/store";
import { useCompilerStatus } from "./CompilerBadge";

/** The compiler download's size in MB for C and C++, once the manifest has loaded. */
export function useDownloadMegabytes() {
  const [mb, setMb] = useState<{ c: number; cpp: number } | null>(null);
  useEffect(() => {
    let live = true;
    downloadMegabytes().then((x) => live && setMb(x));
    return () => {
      live = false;
    };
  }, []);
  return mb;
}

/**
 * Starts the compiler download right away, unless that would cost mobile data.
 * Returns true when the page should ask first (show <MobileDataCard>).
 */
export function useCompilerAutoload(lang: "c" | "cpp") {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    let live = true;
    mayAutoDownload(getState().settings.mobileData).then((ok) => {
      if (!live) return;
      if (ok) ensureCompiler({ warmCpp: lang === "cpp" });
      else setAsk(true);
    });
    return () => {
      live = false;
    };
  }, [lang]);
  return ask;
}

/** "You're on mobile data": offers the one-time compiler download instead of starting it. */
export default function MobileDataCard({ lang, what, later }: { lang: "c" | "cpp"; what: string; later: string }) {
  const compiler = useCompilerStatus();
  const allow = useStore((s) => s.settings.mobileData);
  const mb = useDownloadMegabytes();
  if (compiler.state !== "idle") return null;
  return (
    <div className="card data-card">
      <p>
        <b>You're on mobile data.</b> {what} needs the compiler, a one-time download{mb ? ` of about ${lang === "cpp" ? mb.cpp : mb.c} MB` : ""}. After that it's saved on
        this device.
      </p>
      <div className="actions">
        <button className="btn btn-primary" onClick={() => ensureCompiler({ warmCpp: lang === "cpp" })}>
          Download compiler
        </button>
        <label className="small">
          <input type="checkbox" checked={allow} onChange={(e) => patchSettings({ mobileData: e.target.checked })} /> Always download on mobile data
        </label>
      </div>
      <p className="muted small">{later}</p>
    </div>
  );
}
