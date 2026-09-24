import { useState } from "react";
import type { GradeResult } from "../grader/grade";
import type { Diagnostic } from "../grader/friendly";
import { InlineMd } from "./Markdown";

export function DiagnosticList({ diagnostics, raw }: { diagnostics: Diagnostic[]; raw: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const errs = diagnostics.filter((d) => d.severity === "error");
  const shown = (errs.length ? errs : diagnostics.filter((d) => d.severity !== "note")).slice(0, 4);
  return (
    <div className="diags">
      {shown.map((d, i) => (
        <div key={i} className={"diag diag-" + d.severity}>
          <div className="diag-head">
            <span className="diag-sev">{d.severity}</span>
            {d.line > 0 && <span className="diag-line">{d.inTests ? "in the hidden test code" : `line ${d.line}`}</span>}
          </div>
          <code className="diag-msg">{d.message}</code>
          {d.friendly && (
            <p className="diag-friendly">
              <InlineMd text={d.friendly} />
            </p>
          )}
          {d.inTests && (
            <p className="diag-friendly">
              The error shows up in the test code, which usually means a function name, parameter list or return type doesn't match what the step asks for.
            </p>
          )}
        </div>
      ))}
      {raw && (
        <button className="linkish" onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? "Hide" : "Show"} full compiler output
        </button>
      )}
      {showRaw && <pre className="console small">{raw}</pre>}
    </div>
  );
}

function Visible({ s }: { s: string }) {
  if (s === "") return <em className="muted">(nothing)</em>;
  return <>{s}</>;
}

export default function Results({ result, attempt }: { result: GradeResult; attempt: number }) {
  const warnings = result.diagnostics.filter((d) => d.severity === "warning" && !d.inTests);
  return (
    <div className="results" key={attempt}>
      {result.status === "pass" && <div className="banner banner-pass">✓ All tests passed</div>}
      {result.status === "compile-error" && (
        <>
          <div className="banner banner-fail">✗ It didn't compile</div>
          <DiagnosticList diagnostics={result.diagnostics} raw={result.rawDiagnostics} />
        </>
      )}
      {result.status === "internal-error" && (
        <div className="banner banner-fail">
          The in-browser compiler hit an internal error: {result.rawDiagnostics}. Try again, or reload the page.
        </div>
      )}
      {result.ruleProblems.length > 0 && (
        <ul className="rules">
          {result.ruleProblems.map((p, i) => (
            <li key={i}>
              <InlineMd text={p} />
            </li>
          ))}
        </ul>
      )}
      {result.status !== "compile-error" && result.tests.length > 0 && (
        <ul className="tests">
          {result.tests.map((t, i) => (
            <li key={i} className={t.pass ? "t-pass" : "t-fail"}>
              <span className="t-icon">{t.pass ? "✓" : "✗"}</span>
              <div className="t-body">
                <div className="t-name">
                  {t.hidden ? "Hidden test" : t.name}
                  {!t.pass && t.hidden && <span className="muted"> (hidden so you can't hard-code the answer)</span>}
                </div>
                {!t.pass && !t.hidden && (
                  <div className="t-detail">
                    {t.stdin ? (
                      <div>
                        <span className="lbl">input</span>
                        <pre className="console tiny">{t.stdin.replace(/\n$/, "")}</pre>
                      </div>
                    ) : null}
                    {t.expected !== undefined && (
                      <div className="t-cmp">
                        <div>
                          <span className="lbl">expected</span>
                          <pre className="console tiny">
                            <Visible s={t.expected} />
                          </pre>
                        </div>
                        <div>
                          <span className="lbl">you printed / returned</span>
                          <pre className="console tiny">
                            <Visible s={t.got ?? ""} />
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!t.pass && t.note && <div className="t-note">{t.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && result.status !== "compile-error" && (
        <details className="warnings">
          <summary>
            {warnings.length} compiler warning{warnings.length > 1 ? "s" : ""} (not errors, but worth a look)
          </summary>
          <DiagnosticList diagnostics={warnings} raw="" />
        </details>
      )}
      {result.output && result.status !== "compile-error" && (
        <div>
          <span className="lbl">program output</span>
          <pre className="console">{result.output}</pre>
        </div>
      )}
      <div className="muted small">compiled in {(result.compileMs / 1000).toFixed(2)}s</div>
    </div>
  );
}
