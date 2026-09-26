import { useCallback, useEffect, useRef, useState } from "react";
import CodeEditor from "../components/CodeEditor";
import SymbolBar from "../components/SymbolBar";
import { DiagnosticList } from "../components/Results";
import MobileDataCard, { useCompilerAutoload } from "../components/MobileDataCard";
import { useCompilerStatus } from "../components/CompilerBadge";
import { runOnly } from "../grader/grade";
import { packText, unpackText } from "../lib/pack";
import { useTitle } from "../lib/title";

type Lang = "c" | "cpp";
type Saved = { lang: Lang; c: string; cpp: string; stdin: string };

const EXAMPLES: Record<Lang, string> = {
  c: `#include <stdio.h>

int main(void) {
    char name[64];
    printf("What's your name? ");
    if (scanf("%63s", name) == 1) printf("\\nHello, %s!\\n", name);
    return 0;
}
`,
  cpp: `#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> words{"compiled", "in", "your", "browser"};
    for (const auto& w : words) std::cout << w << ' ';
    std::cout << '\\n';
}
`,
};
const KEY = "cpp-arena-playground";

function load(): Saved {
  const fresh: Saved = { lang: "cpp", c: EXAMPLES.c, cpp: EXAMPLES.cpp, stdin: "Ada" };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return s && (s.lang === "c" || s.lang === "cpp") ? { ...fresh, ...s } : fresh;
  } catch {
    return fresh;
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or full: the code just isn't remembered */
  }
}

type Result = Awaited<ReturnType<typeof runOnly>>;

export default function Playground() {
  useTitle("Playground: run C and C++ in your browser");
  const [state, setState] = useState<Saved>(load);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const busyRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const compiler = useCompilerStatus();
  const askData = useCompilerAutoload(state.lang);
  const code = state[state.lang];

  const update = (patch: Partial<Saved>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      save(next);
      return next;
    });

  // A shared link carries the program in the address: #code=<packed JSON>.
  useEffect(() => {
    const m = /^#code=(.+)$/.exec(location.hash);
    if (!m) return;
    unpackText(m[1])
      .then((json) => {
        const p = JSON.parse(json);
        if (p.lang !== "c" && p.lang !== "cpp") return;
        update({ lang: p.lang, [p.lang]: String(p.code ?? ""), stdin: String(p.stdin ?? "") });
        setResult(null);
        setStatus("Loaded the shared program.");
      })
      .catch(() => setStatus("That share link is damaged, so the program couldn't be loaded."));
  }, []);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatus("Running your program.");
    try {
      const r = await runOnly(state.lang, state[state.lang], state.stdin);
      setResult(r);
      setStatus(r.internalError ? "The compiler couldn't run." : !r.compiled ? "It didn't compile." : r.note ? "The program stopped with a problem." : "The program finished.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [state]);

  const share = async () => {
    const url = `${location.origin}${import.meta.env.BASE_URL}playground#code=${await packText(JSON.stringify({ lang: state.lang, code, stdin: state.stdin }))}`;
    setShared(url);
    try {
      if (navigator.share) {
        await navigator.share({ title: "My program on C/C++ Arena", url });
        setStatus("Shared.");
        return;
      }
    } catch {
      /* cancelled, or not allowed: fall back to copying */
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied. Anyone who opens it sees this program.");
    } catch {
      setStatus("Copy the link below to share this program.");
    }
  };

  // A stable handler for the editor's Ctrl+Enter, so typing doesn't rebuild the editor's extensions.
  const runRef = useRef(run);
  runRef.current = run;
  const runFromEditor = useCallback(() => runRef.current(), []);

  const warnings = result?.compiled ? result.diagnostics.filter((d) => d.severity === "warning") : [];
  const out = result?.run ? result.run.stdout + (result.run.stderr ? (result.run.stdout && !result.run.stdout.endsWith("\n") ? "\n" : "") + result.run.stderr : "") : "";

  return (
    <div className="playground">
      <div className="page-head">
        <h1>Playground</h1>
        <p className="muted">
          Write any C or C++ program and run it here, compiled by real Clang in your browser. Your code stays in this browser; <b>Share</b> makes a link that carries it.
        </p>
      </div>

      {askData && <MobileDataCard lang={state.lang} what="Running your code" later="Or write your program now and run it on Wi-Fi. Pressing Run also starts the download." />}

      <fieldset className="radio-row">
        <legend>Language</legend>
        {(
          [
            ["c", "C (C17)"],
            ["cpp", "C++ (C++20)"],
          ] as [Lang, string][]
        ).map(([v, label]) => (
          <label key={v}>
            <input
              type="radio"
              name="pg-lang"
              value={v}
              checked={state.lang === v}
              onChange={() => {
                update({ lang: v });
                setResult(null);
              }}
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>

      <div className="workbench" ref={boxRef}>
        <CodeEditor
          key={state.lang}
          value={code}
          onChange={(v) => update({ [state.lang]: v } as Partial<Saved>)}
          onRun={runFromEditor}
          diagnostics={result?.diagnostics}
          minHeight="320px"
          label={`Your ${state.lang === "c" ? "C" : "C++"} program`}
        />
        <SymbolBar container={boxRef} />
        <label className="lbl" htmlFor="pg-stdin">
          Input (what the program reads with {state.lang === "c" ? "scanf" : "std::cin"})
        </label>
        <textarea id="pg-stdin" className="stdin" rows={3} value={state.stdin} onChange={(e) => update({ stdin: e.target.value })} spellCheck={false} />
        <div className="actions">
          <button className="btn btn-primary" onClick={run} disabled={busy} aria-keyshortcuts="Control+Enter Meta+Enter">
            {busy ? (compiler.state !== "ready" ? "Waiting for compiler…" : "Running…") : (
              <>
                ▶ Run <kbd aria-hidden="true">⌃↵</kbd>
              </>
            )}
          </button>
          <button className="btn" onClick={share}>
            Share
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (code === EXAMPLES[state.lang] || confirm("Replace your program with the example?")) {
                update({ [state.lang]: EXAMPLES[state.lang] } as Partial<Saved>);
                setResult(null);
              }
            }}
          >
            Example
          </button>
        </div>
        {shared && (
          <p className="small">
            <label className="lbl" htmlFor="pg-link">
              Share link
            </label>
            <input id="pg-link" className="share-link" readOnly value={shared} onFocus={(e) => e.currentTarget.select()} />
          </p>
        )}
        <p className="visually-hidden" role="status" aria-live="polite">
          {status}
        </p>
        {result && (
          <section className="results" aria-label="Result">
            {result.internalError ? (
              <div className="banner banner-fail">The in-browser compiler couldn't run: {result.internalError}. Try again, or reload the page.</div>
            ) : !result.compiled ? (
              <>
                <div className="banner banner-fail">✗ It didn't compile</div>
                <DiagnosticList diagnostics={result.diagnostics} raw={result.rawDiagnostics} />
              </>
            ) : (
              <>
                <h2 className="h3">Output</h2>
                <pre tabIndex={0} className="console">
                  {out || "(no output)"}
                </pre>
                {result.run?.truncated && <div className="t-note">Output was cut off after 64 KB.</div>}
                {result.note && <div className="t-note">{result.note}</div>}
                {warnings.length > 0 && (
                  <>
                    <h2 className="h3">Warnings</h2>
                    <DiagnosticList diagnostics={warnings} raw="" />
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
