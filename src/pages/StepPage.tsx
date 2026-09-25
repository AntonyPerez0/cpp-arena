import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { moduleById, drillsByTopic } from "../content";
import { getState, patchStep, useStore } from "../state/store";
import Markdown from "../components/Markdown";
import Workbench from "../components/Workbench";
import { useTitle } from "../lib/title";
import { visualsForStep } from "../content/visuals";
import ShareButton from "../components/ShareButton";

export default function StepPage() {
  const { moduleId = "", stepNo = "1" } = useParams();
  const nav = useNavigate();
  const m = moduleById.get(moduleId);
  const idx = Math.max(0, parseInt(stepNo, 10) - 1);
  const step = m?.steps[idx];
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
      const wasUnlocked = m.steps.some((st) => getState().steps[st.id]?.done);
      const first = !getState().steps[step.id]?.done;
      patchStep(step.id, { done: true, doneAt: first ? Date.now() : getState().steps[step.id]?.doneAt, clean: first ? hintsUsed === 0 && !sawSolution : getState().steps[step.id]?.clean });
      const moduleDone = m.steps.every((st) => st.id === step.id || getState().steps[st.id]?.done);
      if (!wasUnlocked && (drillsByTopic.get(m.id) ?? 0) > 0) setJustPassed(`New Deathmatch topic unlocked: ${m.title}`);
      else if (moduleDone && first) {
        setJustPassed(`Module complete: ${m.title}`);
        setFinishedModule(true);
      }
      else setJustPassed("Step complete");
    },
    [step, m],
  );

  if (!m || !step) {
    return (
      <div className="page-head">
        <h1>Step not found</h1>
        <Link to="/learn">Back to the curriculum</Link>
      </div>
    );
  }

  const prev = idx > 0 ? `/learn/${m.id}/${idx}` : null;
  const next = idx + 1 < m.steps.length ? `/learn/${m.id}/${idx + 2}` : null;
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
                to={`/learn/${m.id}/${i + 1}`}
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
            report={{ kind: "Lesson step", title: `${m.title}: ${step.title}`, id: step.id, path: `/learn/${m.id}/${idx + 1}` }}
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
