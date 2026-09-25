import { useEffect, useMemo, useRef, useState } from "react";
import type { Drill } from "../content/types";
import { getState } from "../state/store";
import { checkAnswer, TYPE_LABEL, topicTitle } from "./engine";
import { CodeView, highlight } from "../components/highlight";
import FillCode from "../components/FillCode";
import CodeEditor from "../components/CodeEditor";
import Results from "../components/Results";
import Markdown, { InlineMd } from "../components/Markdown";
import SymbolBar from "../components/SymbolBar";
import ReportLink from "../components/ReportLink";
import { grade, type GradeResult } from "../grader/grade";

// ------------------------------------------------------------------ one rep
export function Rep({ drill, onAnswer }: { drill: Drill; onAnswer: (given: string, ok: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const typed = drill.type === "predict" || drill.type === "fill" || drill.type === "boss";
  return (
    <div className={"rep rep-" + drill.type} data-drill={drill.id} ref={box}>
      <div className="rep-head">
        <span className={"rep-type type-" + drill.type}>{TYPE_LABEL[drill.type]}</span>
        <span className={"lang-tag lang-" + drill.lang}>{drill.lang === "c" ? "C" : "C++"}</span>
        <span className="rep-topic">{topicTitle(drill.topic)}</span>
      </div>
      {drill.type !== "boss" && (
        <p className="rep-prompt">
          <InlineMd text={drill.prompt} />
        </p>
      )}
      {drill.type === "predict" && <PredictRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "fill" && <FillRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "bug" && <BugRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "compiles" && <CompilesRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "boss" && <BossRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "choice" && <ChoiceRep drill={drill} onAnswer={onAnswer} />}
      {typed && <SymbolBar container={box} />}
    </div>
  );
}

function PredictRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const [v, setV] = useState("");
  const submit = () => v.trim() && onAnswer(v, checkAnswer(drill, v));
  return (
    <>
      <CodeView code={drill.display} />
      <form
        className="rep-answer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="answer-input"
          autoFocus
          placeholder="Type the exact output (Enter to fire)"
          aria-label="What does it print? Type the exact output"
          value={v}
          onChange={(e) => setV(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
        <button className="btn btn-primary">Fire ↵</button>
      </form>
      <div className="muted small">Line breaks and spaces are flexible: "1 2 3" matches three lines of 1, 2, 3.</div>
    </>
  );
}

function FillRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const [v, setV] = useState<string[]>([""]);
  const submit = () => v[0].trim() && onAnswer(v[0], checkAnswer(drill, v[0]));
  return (
    <>
      <FillCode template={drill.display} values={v} onChange={setV} onSubmit={submit} autoFocus />
      {drill.output && (
        <div className="rep-output">
          <span className="lbl">should print</span>
          <pre tabIndex={0} className="console tiny">{drill.output}</pre>
        </div>
      )}
      <div className="rep-answer">
        <button className="btn btn-primary" onClick={submit}>
          Fire ↵
        </button>
      </div>
    </>
  );
}

function ChoiceRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const choices = drill.choices ?? [];
  // Shuffle once per showing, so the right answer isn't always in the same place.
  const order = useMemo(() => {
    const o = choices.map((_, i) => i);
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
  }, [drill.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // `k` is the position on screen; answers are recorded by the original choice number.
  const pick = (k: number) => onAnswer(String(order[k] + 1), checkAnswer(drill, String(order[k] + 1)));
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (getState().settings.keys === false) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const n = "abcd".indexOf(e.key.toLowerCase());
      const k = n >= 0 ? n : parseInt(e.key, 10) - 1;
      if (k >= 0 && k < choices.length) pick(k);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <>
      {drill.display && <CodeView code={drill.display} />}
      <div className="choices">
        {order.map((ci, k) => (
          <button key={ci} className="choice" data-choice={ci} onClick={() => pick(k)}>
            <span className="choice-key" aria-hidden="true">
              {"ABCD"[k]}
            </span>
            <span>
              <InlineMd text={choices[ci]} />
            </span>
          </button>
        ))}
      </div>
      <div className="muted small">Tap an answer, or press A to D.</div>
    </>
  );
}

function BugRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const lines = drill.display.split("\n");
  const pickable = lines.map((l) => l.trim() !== "" && !/^\/\/ inside main:$/.test(l.trim()) && !/^[{}]\s*;?$/.test(l.trim()));
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (getState().settings.keys === false) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && n <= lines.length && pickable[n - 1]) onAnswer(String(n), checkAnswer(drill, String(n)));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <div className="buglines">
      {lines.map((l, i) =>
        pickable[i] ? (
          <button key={i} className="bugline" aria-label={`Line ${i + 1}: ${l.trim()}`} onClick={() => onAnswer(String(i + 1), checkAnswer(drill, String(i + 1)))}>
            <span className="ln">{i + 1}</span>
            <code>{highlight(l)}</code>
          </button>
        ) : (
          <div key={i} className="bugline bugline-off">
            <span className="ln">{i + 1}</span>
            <code>{highlight(l)}</code>
          </div>
        ),
      )}
      <div className="muted small">Click the line, or press its number key.</div>
    </div>
  );
}

function CompilesRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (getState().settings.keys === false) return;
      if (e.key === "y" || e.key === "Y") onAnswer("yes", checkAnswer(drill, "yes"));
      if (e.key === "n" || e.key === "N") onAnswer("no", checkAnswer(drill, "no"));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <>
      <CodeView code={drill.display} />
      <div className="yn">
        <button className="btn btn-yes" onClick={() => onAnswer("yes", checkAnswer(drill, "yes"))}>
          Compiles (Y)
        </button>
        <button className="btn btn-no" onClick={() => onAnswer("no", checkAnswer(drill, "no"))}>
          Compile error (N)
        </button>
      </div>
      <div className="muted small">Standard headers are already included. Warnings don't count as errors.</div>
    </>
  );
}

function BossRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const ex = drill.exercise!;
  const [code, setCode] = useState(ex.seed);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [shots, setShots] = useState(3);
  const busyRef = useRef(false);
  const fire = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await grade(ex, code);
      setResult(r);
      if (r.status === "pass") onAnswer("pass", true);
      else if (r.status !== "internal-error") {
        const left = shots - 1;
        setShots(left);
        if (left <= 0) onAnswer(code, false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="boss-banner">☠ BOSS REP · {shots} shot{shots === 1 ? "" : "s"} left</div>
      <Markdown text={drill.prompt} />
      <CodeEditor value={code} onChange={setCode} onRun={fire} diagnostics={result?.diagnostics} minHeight="180px" />
      <div className="actions">
        <button className="btn btn-primary" onClick={fire} disabled={busy}>
          {busy ? "Compiling…" : "Fire  ⌃↵"}
        </button>
        <button className="btn btn-ghost" onClick={() => onAnswer("(gave up)", false)}>
          Give up
        </button>
      </div>
      {result && result.status !== "pass" && <Results result={result} attempt={3 - shots} />}
    </>
  );
}

// ------------------------------------------------------------------ death / review
export function Death({ drill, given, title, sub, children }: { drill: Drill; given: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="death">
      <h2 className="death-title">{title}</h2>
      <div className="death-sub">{sub}</div>
      <div className="death-card">
        <div className="rep-head">
          <span className={"rep-type type-" + drill.type}>{TYPE_LABEL[drill.type]}</span>
          <span className="rep-topic">{topicTitle(drill.topic)}</span>
        </div>
        {drill.type === "boss" ? (
          <>
            <div className="lbl">a solution</div>
            <CodeView code={drill.exercise!.solution} />
          </>
        ) : drill.type === "bug" ? (
          <>
            <CodeView code={drill.display.split("\n").map((l, i) => (String(i + 1) === drill.answer ? l + "   // <- bug" : l)).join("\n")} />
            <div className="answer-cmp">
              You picked line <b>{given}</b>. The bug is on line <b>{drill.answer}</b>. Fix: <code>{drill.fix}</code>
            </div>
          </>
        ) : drill.type === "choice" ? (
          <>
            {drill.display && <CodeView code={drill.display} />}
            <div className="answer-cmp">
              <div>
                <span className="lbl">you said</span> <InlineMd text={drill.choices?.[parseInt(given, 10) - 1] ?? "(nothing)"} />
              </div>
              <div>
                <span className="lbl">answer</span> <InlineMd text={drill.choices?.[parseInt(drill.answer, 10) - 1] ?? ""} />
              </div>
            </div>
          </>
        ) : (
          <>
            {drill.type === "fill" ? (
              <FillCode template={drill.display} values={[drill.answer]} onChange={() => {}} disabled />
            ) : (
              <CodeView code={drill.display} />
            )}
            <div className="answer-cmp">
              <div>
                <span className="lbl">you said</span> <code>{given || "(nothing)"}</code>
              </div>
              <div>
                <span className="lbl">answer</span>{" "}
                <code className="good">{drill.type === "compiles" ? (drill.answer === "yes" ? "compiles" : "compile error") : drill.answer}</code>
              </div>
            </div>
          </>
        )}
        {drill.why && (
          <div className="why">
            <Markdown text={drill.why} />
          </div>
        )}
        <p className="report-row">
          <ReportLink info={() => ({ kind: "Drill", title: `${topicTitle(drill.topic)}: ${TYPE_LABEL[drill.type]}`, id: drill.id, code: drill.display, result: `I answered: ${given}` })} />
        </p>
      </div>
      <div className="death-actions">{children}</div>
    </div>
  );
}
