import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "../content/types";
import { grade, runOnly, type GradeResult } from "../grader/grade";
import { fillTemplate, parseTemplate } from "../grader/assemble.js";
import CodeEditor from "./CodeEditor";
import FillCode from "./FillCode";
import Results, { DiagnosticList } from "./Results";
import Markdown from "./Markdown";
import { CodeView } from "./highlight";
import { useCompilerStatus } from "./CompilerBadge";
import { ensureCompiler } from "../compiler/client";
import SymbolBar from "./SymbolBar";
import ReportLink from "./ReportLink";
import type { ReportInfo } from "../lib/site";

type Props = {
  ex: Exercise;
  initialCode?: string;
  initialBlanks?: string[];
  hintsUsed: number;
  onHint: (n: number) => void;
  onSave: (code: string, blanks: string[]) => void;
  onPass: (info: { hintsUsed: number; sawSolution: boolean }) => void;
  onRevealSolution?: () => void;
  checkLabel?: string;
  /** What to put in a "Report a problem" issue (the code and last result are added automatically). */
  report?: Omit<ReportInfo, "code" | "result">;
};

/** A short summary of a result for screen readers (the visible results panel has the details). */
function announce(r: GradeResult): string {
  if (r.status === "pass") return "All tests passed.";
  if (r.status === "compile-error") return "It didn't compile. The errors are listed below the editor.";
  if (r.status === "internal-error") return "The compiler hit an internal error. Try again.";
  const failed = r.tests.filter((t) => !t.pass).length;
  const rules = r.ruleProblems.length ? ` ${r.ruleProblems.length} rule${r.ruleProblems.length > 1 ? "s" : ""} not met.` : "";
  return `${failed} of ${r.tests.length} tests failed.${rules} Details are below the editor.`;
}

export default function Workbench({ ex, initialCode, initialBlanks, hintsUsed, onHint, onSave, onPass, onRevealSolution, checkLabel = "Check", report }: Props) {
  const isFill = ex.kind === "fill";
  const blankCount = isFill ? parseTemplate(ex.seed).blanks.length : 0;
  const [code, setCode] = useState(initialCode ?? ex.seed);
  const [blanks, setBlanks] = useState<string[]>(initialBlanks ?? Array(blankCount).fill(""));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [sawSolution, setSawSolution] = useState(false);
  const [stdin, setStdin] = useState(ex.tests[0]?.stdin ?? "");
  const [freeRun, setFreeRun] = useState<Awaited<ReturnType<typeof runOnly>> | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const compiler = useCompilerStatus();
  const busyRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureCompiler({ warmCpp: ex.lang === "cpp" });
  }, [ex.lang]);

  const source = isFill ? fillTemplate(ex.seed, blanks) : code;

  const check = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFreeRun(null);
    try {
      const r = await grade(ex, source);
      setResult(r);
      setAttempts((a) => a + 1);
      if (r.status === "pass") onPass({ hintsUsed, sawSolution });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [ex, source, onPass, hintsUsed, sawSolution]);

  const runFree = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      setFreeRun(await runOnly(ex.lang, source, stdin, { files: ex.tests[0]?.files, args: ex.tests[0]?.args }));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    if (!confirm("Reset this exercise to its starting code?")) return;
    setCode(ex.seed);
    setBlanks(Array(blankCount).fill(""));
    setResult(null);
    onSave(ex.seed, Array(blankCount).fill(""));
  };

  const wrongBlanks =
    isFill && result && result.status !== "pass"
      ? parseTemplate(ex.seed).blanks.map((b: { accept: string[] }, i: number) => !b.accept.some((a: string) => a.replace(/\s+/g, "") === (blanks[i] ?? "").replace(/\s+/g, "")))
      : [];

  const canRevealSolution = hintsUsed >= ex.hints.length || attempts >= 3;
  const waiting = compiler.state !== "ready";

  return (
    <div className="workbench" ref={boxRef}>
      {isFill ? (
        <FillCode
          template={ex.seed}
          values={blanks}
          wrong={wrongBlanks}
          autoFocus
          onChange={(v) => {
            setBlanks(v);
            onSave(code, v);
          }}
          onSubmit={check}
        />
      ) : (
        <CodeEditor
          value={code}
          onChange={(v) => {
            setCode(v);
            onSave(v, blanks);
          }}
          onRun={check}
          diagnostics={result?.diagnostics}
        />
      )}
      <SymbolBar container={boxRef} />

      <div className="actions">
        <button className="btn btn-primary" onClick={check} disabled={busy} aria-keyshortcuts="Control+Enter Meta+Enter">
          {busy ? (
            waiting ? "Waiting for compiler…" : "Compiling…"
          ) : (
            <>
              {checkLabel} <kbd aria-hidden="true">⌃↵</kbd>
            </>
          )}
        </button>
        {ex.mode === "stdout" && !isFill && (
          <button className="btn" onClick={() => setShowConsole(!showConsole)}>
            {showConsole ? "Hide console" : "Run with my input"}
          </button>
        )}
        <button className="btn btn-ghost" onClick={reset}>
          Reset
        </button>
      </div>

      {showConsole && (
        <div className="freerun">
          <label className="lbl" htmlFor="stdin">
            stdin (what the program reads)
          </label>
          <textarea id="stdin" className="stdin" rows={3} value={stdin} onChange={(e) => setStdin(e.target.value)} spellCheck={false} />
          {(!!ex.tests[0]?.files || !!ex.tests[0]?.args?.length) && (
            <p className="muted small">
              {ex.tests[0]?.files && <>Files in the working folder: {Object.keys(ex.tests[0].files).join(", ")}. </>}
              {ex.tests[0]?.args?.length ? <>Command-line arguments: {ex.tests[0].args.join(" ")}</> : null}
            </p>
          )}
          <button className="btn" onClick={runFree} disabled={busy}>
            ▶ Run
          </button>
          {freeRun && (
            <div className="results">
              {!freeRun.compiled ? (
                <DiagnosticList diagnostics={freeRun.diagnostics} raw={freeRun.rawDiagnostics} />
              ) : (
                <>
                  <pre tabIndex={0} className="console">{(freeRun.run?.stdout ?? "") + (freeRun.run?.stderr ? "\n" + freeRun.run.stderr : "") || "(no output)"}</pre>
                  {freeRun.note && <div className="t-note">{freeRun.note}</div>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {busy ? "Checking your code." : result ? announce(result) : ""}
      </p>
      {result && <Results result={result} attempt={attempts} />}

      <div className="hints">
        {ex.hints.slice(0, hintsUsed).map((h, i) => (
          <div key={i} className="hint">
            <span className="hint-n">Hint {i + 1}</span>
            <Markdown text={h} />
          </div>
        ))}
        <div className="hint-actions">
          {hintsUsed < ex.hints.length && (
            <button className={"btn btn-hint" + (attempts >= 2 && result?.status !== "pass" ? " pulse" : "")} onClick={() => onHint(hintsUsed + 1)}>
              <span aria-hidden="true">💡</span> Hint ({hintsUsed + 1}/{ex.hints.length})
            </button>
          )}
          {canRevealSolution && !showSolution && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowSolution(true);
                setSawSolution(true);
                onRevealSolution?.();
              }}
            >
              Show solution
            </button>
          )}
        </div>
        {report && (
          <p className="report-row">
            <ReportLink info={() => ({ ...report, code: source, result: result ? announce(result) : undefined })} />
          </p>
        )}
        {showSolution && (
          <div className="solution">
            <div className="lbl">reference solution (type it in yourself; that is the rep)</div>
            <CodeView code={ex.solution} />
            {isFill && (
              <button className="btn" onClick={() => setBlanks(parseTemplate(ex.seed).blanks.map((b: { answer: string }) => b.answer))}>
                Fill the blanks for me
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
