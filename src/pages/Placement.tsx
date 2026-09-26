import { useState } from "react";
import { Link } from "react-router-dom";
import { firstStepPath, moduleById, modules, placement } from "../content";
import { update, useStore } from "../state/store";
import { Rep } from "../deathmatch/Reps";
import { useTitle } from "../lib/title";

type Answer = { ok: boolean; given: string };

/** Which module to start at, and which ones can be skipped, from the quiz answers. */
function placementResult(answers: Answer[]) {
  const firstWrong = answers.findIndex((a) => !a.ok);
  const order = modules.map((m) => m.id);
  const startIdx = firstWrong >= 0 ? order.indexOf(placement[firstWrong].module) : Math.min(order.length - 1, order.indexOf(placement[placement.length - 1].module) + 1);
  return { start: modules[startIdx], skip: order.slice(0, startIdx) };
}

export default function Placement() {
  useTitle("Placement quiz: where should you start?");
  const placed = useStore((s) => s.placed);
  const [phase, setPhase] = useState<"intro" | "quiz" | "done">("intro");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [applied, setApplied] = useState(false);
  const i = answers.length;

  if (phase === "intro") {
    return (
      <div className="narrow">
        <div className="page-head">
          <h1>Placement quiz</h1>
          <p>
            Already know some C or C++? Answer {placement.length} quick questions, from printing and loops up to smart pointers and algorithms. The first one
            you miss shows where to start, and you can skip the modules before it.
          </p>
          <p className="muted small">
            Take your time and don't guess: a wrong guess only means starting a bit earlier, while a lucky guess could skip something you need. There's no
            penalty either way, and you can take it again.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-lg" onClick={() => setPhase("quiz")}>
            Start the quiz
          </button>
          <Link className="btn btn-lg" to={firstStepPath("c-hello")}>
            I'm new: start from lesson 1
          </Link>
        </div>
        {placed.length > 0 && (
          <p className="small">
            You're currently skipping {placed.length} module{placed.length === 1 ? "" : "s"} from an earlier quiz.{" "}
            <button className="linkish" onClick={() => update((s) => ({ ...s, placed: [] }))}>
              Stop skipping them
            </button>
          </p>
        )}
      </div>
    );
  }

  if (phase === "quiz" && i < placement.length) {
    const q = placement[i];
    return (
      <div className="narrow">
        <h1 className="h2">
          Question {i + 1} of {placement.length}
        </h1>
        <div className="bar" aria-hidden="true">
          <div style={{ width: `${(i / placement.length) * 100}%` }} />
        </div>
        <p className="muted small">Topic: {moduleById.get(q.module)?.title}</p>
        <Rep
          key={q.id}
          drill={q}
          onAnswer={(given, ok) => {
            const next = [...answers, { ok, given }];
            setAnswers(next);
            if (next.length === placement.length) setPhase("done");
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={() => {
            const next = [...answers, { ok: false, given: "(skipped)" }];
            setAnswers(next);
            if (next.length === placement.length) setPhase("done");
          }}
        >
          I don't know this yet
        </button>
      </div>
    );
  }

  const r = placementResult(answers);
  const right = answers.filter((a) => a.ok).length;
  return (
    <div className="narrow">
      <div className="page-head">
        <h1>Your starting point</h1>
        <p>
          You got {right} of {placement.length}. Start at <b>{r.start.title}</b>
          {r.skip.length ? `, skipping the ${r.skip.length} module${r.skip.length === 1 ? "" : "s"} before it.` : "."}
        </p>
      </div>
      <ol className="placement-results">
        {placement.map((q, k) => (
          <li key={q.id} className={answers[k]?.ok ? "ok" : "miss"}>
            <span aria-hidden="true">{answers[k]?.ok ? "✓" : "✗"}</span> {moduleById.get(q.module)?.title}
            <span className="visually-hidden">{answers[k]?.ok ? ": right" : ": missed"}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        {r.skip.length > 0 && !applied ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              update((s) => ({ ...s, placed: [...new Set([...s.placed, ...r.skip])] }));
              setApplied(true);
            }}
          >
            Skip {r.skip.length} module{r.skip.length === 1 ? "" : "s"} and unlock their drills
          </button>
        ) : null}
        <Link className={"btn btn-lg" + (applied || !r.skip.length ? " btn-primary" : "")} to={firstStepPath(r.start.id)}>
          Go to {r.start.title}
        </Link>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setAnswers([]);
            setApplied(false);
            setPhase("quiz");
          }}
        >
          Retake
        </button>
      </div>
      {applied && <p role="status">Done. Skipped modules stay open on the Learn page if you want to review them, and their drills are now in Deathmatch.</p>}
    </div>
  );
}
