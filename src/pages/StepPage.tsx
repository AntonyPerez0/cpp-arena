import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Play } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { moduleById, drills, findStep, stepPath } from "../content";
import { getState, patchPart, patchStep, useStore, type StepProgress } from "../state/store";
import Markdown from "../components/Markdown";
import Workbench from "../components/Workbench";
import TaskCard from "../components/TaskCard";
import type { Challenge, Step } from "../content/types";
import { useTitle } from "../lib/title";
import { visualsForStep } from "../content/visuals";
import ShareButton from "../components/ShareButton";

/** The step's challenges: its own exercise first, then its extra ones. */
function challengesOf(step: Step): Challenge[] {
  return [step, ...(step.more ?? [])];
}

/** Whether challenge k passed. Before steps had several challenges, `done` meant the only one passed. */
function challengeDone(p: StepProgress | undefined, k: number): boolean {
  if (!p) return false;
  return k === 0 ? !!(p.firstDone || p.done) : !!p.parts?.[k]?.done;
}

export default function StepPage() {
  const { moduleId = "", stepKey = "" } = useParams();
  const nav = useNavigate();
  const { hash } = useLocation();
  const m = moduleById.get(moduleId);
  const found = m ? findStep(m, stepKey) : null;
  const step = found?.step;
  const idx = m && step ? m.steps.indexOf(step) : 0;
  const progress = useStore((s) => (step ? s.steps[step.id] : undefined));
  const challenges = useMemo(() => (step ? challengesOf(step) : []), [step]);
  const firstOpen = () => {
    const p = step ? getState().steps[step.id] : undefined;
    const k = challenges.findIndex((_, i) => !challengeDone(p, i));
    return k < 0 ? 0 : k;
  };
  const [cur, setCur] = useState(firstOpen);
  const [justPassed, setJustPassed] = useState<string | null>(null);
  const [nextChallenge, setNextChallenge] = useState<number | null>(null);
  const [finishedModule, setFinishedModule] = useState(false);
  useTitle(m && step ? `${step.title} · ${m.title}` : "Step not found");
  useEffect(() => {
    setJustPassed(null);
    setNextChallenge(null);
    setFinishedModule(false);
    setCur(firstOpen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  const goChallenge = (k: number) => {
    setCur(k);
    setJustPassed(null);
    setNextChallenge(null);
    // Move focus to the new task so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => document.getElementById("task-h")?.focus());
  };

  const onPass = useCallback(
    (k: number, { hintsUsed, sawSolution }: { hintsUsed: number; sawSolution: boolean }) => {
      if (!step || !m) return;
      if (k === 0) patchStep(step.id, { firstDone: true });
      else patchPart(step.id, k, { done: true });
      const now = getState().steps[step.id];
      const open = challenges.findIndex((_, i) => !challengeDone(now, i));
      if (open >= 0 && !now?.done) {
        // More challenges to go before the step counts as done.
        const after = challenges.findIndex((_, i) => i > k && !challengeDone(now, i));
        const nextK = after >= 0 ? after : open;
        setJustPassed(`Challenge ${k + 1} of ${challenges.length} complete`);
        setNextChallenge(nextK);
        return;
      }
      if (now?.done) {
        // Already finished (for example before this step had extra challenges): just practice.
        const after = challenges.findIndex((_, i) => i > k && !challengeDone(now, i));
        setJustPassed(after >= 0 ? `Challenge ${k + 1} of ${challenges.length} complete` : "All challenges complete");
        setNextChallenge(after >= 0 ? after : null);
        return;
      }
      const first = !getState().steps[step.id]?.done;
      // Drills this step teaches that the learner hasn't met yet join Deathmatch now.
      const newDrills = first && !getState().settings.unlockAll ? drills.filter((d) => d.step === step.id && !getState().drills[d.id] && !getState().placed.includes(d.topic)).length : 0;
      // Clean means no hints on any of the step's challenges and no peeking at the last one's solution.
      const sp = getState().steps[step.id];
      const cleanFirst = hintsUsed === 0 && !sawSolution && (sp?.hintsUsed ?? 0) === 0 && Object.values(sp?.parts ?? {}).every((p) => p.hintsUsed === 0);
      patchStep(step.id, { done: true, doneAt: first ? Date.now() : getState().steps[step.id]?.doneAt, clean: first ? cleanFirst : getState().steps[step.id]?.clean });
      const moduleDone = m.steps.every((st) => st.id === step.id || getState().steps[st.id]?.done);
      if (moduleDone && first) {
        setJustPassed(`Module complete: ${m.title}`);
        setFinishedModule(true);
      }
      else if (newDrills > 0) setJustPassed(`Step complete: ${newDrills} new Deathmatch drill${newDrills === 1 ? "" : "s"} unlocked`);
      else setJustPassed("Step complete");
    },
    [step, m, challenges],
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
        <Link to="/learn">Learn</Link> <ChevronRight className="icon" aria-hidden="true" /> <span>{m.phase}</span> <ChevronRight className="icon" aria-hidden="true" /> <span>{m.title}</span>
      </div>
      <div className="step-grid">
        <aside className="step-text">
          <div className="step-count">
            Step {idx + 1} of {m.steps.length}
            {done && (
              <span className="done-chip">
                <Check className="icon" aria-hidden="true" /> done
              </span>
            )}
          </div>
          <h1>{step.title}</h1>
          <Markdown text={step.text} top={2} />
          {visualsForStep(step.id).map((v) => (
            <Link key={v.id} to={`/visualize/${v.id}`} className="watch-card">
              <span className="watch-icon" aria-hidden="true">
                <Play className="icon" />
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
              <span>
                <Check className="icon" aria-hidden="true" /> {justPassed}
              </span>
              {finishedModule && (
                <ShareButton
                  card={{ kicker: "Module complete", title: m.title, lines: [`${m.steps.length} ${m.lang === "c" ? "C" : "C++"} exercises, compiled and passing`], file: `cpparena-${m.id}.png` }}
                  text={`I just finished "${m.title}" on C/C++ Arena.`}
                />
              )}
              {nextChallenge != null ? (
                <button className="btn btn-primary" onClick={() => goChallenge(nextChallenge)} autoFocus>
                  Next challenge <ArrowRight className="icon" aria-hidden="true" />
                </button>
              ) : next ? (
                <button className="btn btn-primary" onClick={() => { setJustPassed(null); nav(next); }} autoFocus>
                  Next step <ArrowRight className="icon" aria-hidden="true" />
                </button>
              ) : (
                <Link className="btn btn-primary" to="/learn">
                  Back to curriculum
                </Link>
              )}
            </div>
          )}
          {challenges.length > 1 && (
            <nav className="challenges" aria-label="Challenges in this step">
              {challenges.map((_, i) => {
                const ok = challengeDone(progress, i);
                return (
                  <button
                    key={i}
                    className={"challenge-tab" + (i === cur ? " challenge-cur" : "") + (ok ? " challenge-done" : "")}
                    aria-current={i === cur ? "step" : undefined}
                    onClick={() => goChallenge(i)}
                  >
                    {ok ? <Check className="icon" aria-hidden="true" /> : <span className="challenge-n" aria-hidden="true">{i + 1}</span>}
                    Challenge {i + 1}
                    {ok && <span className="visually-hidden"> (done)</span>}
                  </button>
                );
              })}
            </nav>
          )}
          <TaskCard ex={challenges[cur]} task={challenges[cur].task} index={cur} total={challenges.length} />
          {cur === 0 ? (
            <Workbench
              key={step.id}
              ex={step}
              initialCode={progress?.code}
              initialBlanks={progress?.blanks}
              hintsUsed={progress?.hintsUsed ?? 0}
              onHint={(n) => patchStep(step.id, { hintsUsed: n })}
              onSave={(code, blanks) => patchStep(step.id, { code, blanks })}
              onPass={(info) => onPass(0, info)}
              report={{ kind: "Lesson step", title: `${m.title}: ${step.title}`, id: step.id, path: stepPath(m, step) }}
            />
          ) : (
            <Workbench
              key={`${step.id}#${cur}`}
              ex={challenges[cur]}
              initialCode={progress?.parts?.[cur]?.code}
              initialBlanks={progress?.parts?.[cur]?.blanks}
              hintsUsed={progress?.parts?.[cur]?.hintsUsed ?? 0}
              onHint={(n) => patchPart(step.id, cur, { hintsUsed: n })}
              onSave={(code, blanks) => patchPart(step.id, cur, { code, blanks })}
              onPass={(info) => onPass(cur, info)}
              report={{ kind: "Lesson step", title: `${m.title}: ${step.title} (challenge ${cur + 1})`, id: `${step.id}#${cur + 1}`, path: stepPath(m, step) }}
            />
          )}
          <div className="step-nav">
            {prev ? (
              <Link className="btn btn-ghost" to={prev} onClick={() => setJustPassed(null)}>
                <ArrowLeft className="icon" aria-hidden="true" /> Previous
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link className="btn btn-ghost" to={next} onClick={() => setJustPassed(null)}>
                {done ? "Next" : "Skip"} <ArrowRight className="icon" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
