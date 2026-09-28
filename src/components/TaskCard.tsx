import { Check, Target } from "lucide-react";
import type { Exercise } from "../content/types";
import Markdown from "./Markdown";

const MAX_CHECKS = 8;

/**
 * What the exercise asks for, set apart from the lesson so it's obvious: the task, then the exact
 * output the program must print (with its input) or, for function exercises, what the tests check.
 */
export default function TaskCard({ ex, task, index, total }: { ex: Exercise; task: string; index: number; total: number }) {
  const shown = ex.mode === "stdout" ? ex.tests.find((t) => !t.hidden && t.expect) : undefined;
  const moreTests = ex.mode === "stdout" ? ex.tests.filter((t) => t !== shown).length : 0;
  const checks = ex.mode === "harness" ? ex.checkNames ?? [] : [];
  return (
    <section className="task-card" aria-labelledby="task-h">
      <div className="task-head">
        <h2 id="task-h" className="task-title" tabIndex={-1}>
          <Target className="icon" aria-hidden="true" /> Your task
        </h2>
        {total > 1 && (
          <span className="task-count">
            Challenge {index + 1} of {total}
          </span>
        )}
      </div>
      <Markdown text={task} className="task-body" />
      {ex.kind === "fill" && <p className="task-note">Type your answers into the highlighted blanks in the code below.</p>}
      {shown && (
        <div className="task-expect">
          {shown.args?.length ? (
            <>
              <div className="lbl">Command-line arguments</div>
              <pre className="console tiny">{shown.args.join(" ")}</pre>
            </>
          ) : null}
          {shown.stdin ? (
            <>
              <div className="lbl">Input</div>
              <pre className="console tiny" tabIndex={0}>
                {shown.stdin}
              </pre>
            </>
          ) : null}
          <div className="lbl">Expected output</div>
          <pre className="console task-output" tabIndex={0}>
            {shown.expect}
          </pre>
          {moreTests > 0 && (
            <p className="task-note">
              {moreTests} more {moreTests === 1 ? "test uses" : "tests use"} other input{shown.stdin ? "" : "s"}
              {ex.tests.some((t) => t.hidden) ? ", some of them hidden so the answer can't be hard-coded" : ""}.
            </p>
          )}
        </div>
      )}
      {checks.length > 0 && (
        <div className="task-checks">
          <div className="lbl">The tests check</div>
          <ul>
            {checks.slice(0, MAX_CHECKS).map((c, i) => (
              <li key={i}>
                <Check className="icon" aria-hidden="true" /> {c}
              </li>
            ))}
            {checks.length > MAX_CHECKS && <li className="muted">and {checks.length - MAX_CHECKS} more</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
