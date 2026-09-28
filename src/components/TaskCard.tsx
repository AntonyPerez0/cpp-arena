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
  // The expected output gets its own highlighted box, so drop a copy of it from the task text.
  const text = shown ? withoutExample(withoutBlock(task, shown.expect), shown.stdin ?? "", shown.expect) : task;
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
      <Markdown text={text} className="task-body" />
      {ex.kind === "fill" && <p className="task-note">Type your answers into the highlighted blanks in the code below.</p>}
      {shown && (
        <div className="task-expect">
          {shown.args?.length ? (
            <>
              <div className="lbl">Command-line arguments</div>
              <pre className="console tiny">{shown.args.join(" ")}</pre>
            </>
          ) : null}
          <div className={"task-io" + (shown.stdin ? " two" : "")}>
            {shown.stdin ? (
              <div>
                <div className="lbl">Input</div>
                <pre className="console tiny" tabIndex={0}>
                  {shown.stdin}
                </pre>
              </div>
            ) : null}
            <div>
              <div className="lbl">Expected output</div>
              <pre className="console task-output" tabIndex={0}>
                {shown.expect}
              </pre>
            </div>
          </div>
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

const norm = (s: string) => s.replace(/[ \t]+$/gm, "").trim();

/** The task text without a fenced block that only repeats `expect`; a ":" that introduced it becomes ".". */
function withoutBlock(task: string, expect: string): string {
  const out = task.replace(/(:?)\s*\n^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, (m, colon: string, body: string) =>
    norm(body) === norm(expect) ? (colon ? "." : "") : m,
  );
  return out === task ? task : out.trimEnd() + "\n";
}

const flat = (s: string) => s.replace(/\s+/g, " ").trim();

/** Drop an "Input `a` prints `b`." sentence when the boxes below show that same input and output. */
function withoutExample(task: string, stdin: string, expect: string): string {
  const out = task.replace(/\s*Input:? ((?:`[^`\n]*`\s*(?:\/\s*)?)+)prints:? `([^`\n]*)`\.?/g, (m, input: string, output: string) => {
    const parts = [...input.matchAll(/`([^`]*)`/g)].map((x) => x[1]).join(" ");
    return flat(parts) === flat(stdin) && flat(output) === flat(expect) ? "" : m;
  });
  return out === task ? task : out.trimEnd().replace(/:$/, ".") + "\n";
}
