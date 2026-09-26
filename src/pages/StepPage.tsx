import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { moduleById, drills, findStep, stepPath } from "../content";
import { getState, patchStep, useStore } from "../state/store";
import Markdown from "../components/Markdown";
import Workbench from "../components/Workbench";
import { useTitle } from "../lib/title";
import { visualsForStep } from "../content/visuals";
import ShareButton from "../components/ShareButton";

export default function StepPage() {
  const { moduleId = "", stepKey = "" } = useParams();
  const nav = useNavigate();
  const { hash } = useLocation();
  const m = moduleById.get(moduleId);
  const found = m ? findStep(m, stepKey) : null;
  const step = found?.step;
  const idx = m && step ? m.steps.indexOf(step) : 0;
  const progress = useStore((s) => (step ? s.steps[step.id] : undefined));
  const [justPassed, setJustPassed] = useState<string | null>(null);
  const [finishedModule, setFinishedModule] = useState(false);
  useTitle(m && step ? `${step.title} · ${m.title}` : "Step not found");
  useEffect(() => {
    setJustPassed(null);
    setFinishedModule(false);
  }, [step?.id]);

  const onPass = useCallback(
    ({ hintsUsed, sawSolution }: { hintsUsed: number; sawSolution: boolean }) => {
      if (!step || !m) return;
      const first = !getState().steps[step.id]?.done;
      // Drills this step teaches that the learner hasn't met yet join Deathmatch now.
      const newDrills = first && !getState().settings.unlockAll ? drills.filter((d) => d.step === step.id && !getState().drills[d.id] && !getState().placed.includes(d.topic)).length : 0;
      patchStep(step.id, { done: true, doneAt: first ? Date.now() : getState().steps[step.id]?.doneAt, clean: first ? hintsUsed === 0 && !sawSolution : getState().steps[step.id]?.clean });
      const moduleDone = m.steps.every((st) => st.id === step.id || getState().steps[st.id]?.done);
      if (moduleDone && first) {
        setJustPassed(`Module complete: ${m.title}`);
        setFinishedModule(true);
      }
      else if (newDrills > 0) setJustPassed(`Step complete: ${newDrills} new Deathmatch drill${newDrills === 1 ? "" : "s"} unlocked`);
      else setJustPassed("Step complete");
    },
    [step, m],
  );

  // Old numbered addresses open the step they always did, at its permanent address.
  if (m && step && found?.numbered) return <Navigate to={stepPath(m, step) + hash} replace />;

  if (!m || !step) {
    return (
      <div className="page-head">
        <h1>Step not found</h1>
        <Link to="/learn">Back to the curriculum</Link>
      </div>
    );
  }

  const prev = idx > 0 ? stepPath(m, m.steps[idx - 1]) : null;
  const next = idx + 1 < m.steps.length ? stepPath(m, m.steps[idx + 1]) : null;
  const done = !!progress?.done;

  return (
    <div className="step-page" key={step.id}>
      <div className="crumbs">
        <Link to="/learn">Learn</Link> <span>›</span> <span>{m.phase}</span> <span>›</span> <span>{m.title}</span>
      </div>
      <div className="step-grid">
        <aside className="step-text">
          <div className="step-count">
            Step {idx + 1} of {m.steps.length}
            {done && <span className="done-chip">✓ done</span>}
          </div>
          <h1>{step.title}</h1>
          <Markdown text={step.text} top={2} />
          {visualsForStep(step.id).map((v) => (
            <Link key={v.id} to={`/visualize/${v.id}`} className="watch-card">
              <span className="watch-icon" aria-hidden="true">
                ▶
              </span>
              <span>
                <b>Watch it run:</b> {v.title}
                <span className="muted small"> · see the memory line by line</span>
              </span>
            </Link>
          ))}
          <div className="step-dots">
            {m.steps.map((st, i) => (
              <Link
                key={st.id}
                to={stepPath(m, st)}
                className={"dot" + (i === idx ? " dot-cur" : "") + (getState().steps[st.id]?.done ? " dot-done" : "")}
                title={st.title}
                aria-label={`Step ${i + 1}: ${st.title}`}
              />
            ))}
          </div>
        </aside>
        <section className="step-work">
          {justPassed && (
            <div className="banner banner-pass big">
              <span>✓ {justPassed}</span>
              {finishedModule && (
                <ShareButton
                  card={{ kicker: "Module complete", title: m.title, lines: [`${m.steps.length} ${m.lang === "c" ? "C" : "C++"} exercises, compiled and passing`], file: `cpparena-${m.id}.png` }}
                  text={`I just finished "${m.title}" on C/C++ Arena.`}
                />
              )}
              {next ? (
                <button className="btn btn-primary" onClick={() => { setJustPassed(null); nav(next); }} autoFocus>
                  Next step →
                </button>
              ) : (
                <Link className="btn btn-primary" to="/learn">
                  Back to curriculum
                </Link>
              )}
            </div>
          )}
          <Workbench
            key={step.id}
            ex={step}
            initialCode={progress?.code}
            initialBlanks={progress?.blanks}
            hintsUsed={progress?.hintsUsed ?? 0}
            onHint={(n) => patchStep(step.id, { hintsUsed: n })}
            onSave={(code, blanks) => patchStep(step.id, { code, blanks })}
            onPass={onPass}
            report={{ kind: "Lesson step", title: `${m.title}: ${step.title}`, id: step.id, path: stepPath(m, step) }}
          />
          <div className="step-nav">
            {prev ? (
              <Link className="btn btn-ghost" to={prev} onClick={() => setJustPassed(null)}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link className="btn btn-ghost" to={next} onClick={() => setJustPassed(null)}>
                {done ? "Next →" : "Skip →"}
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
