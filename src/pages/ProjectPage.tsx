import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { projectById, moduleById } from "../content";
import { getState, patchProject, useStore } from "../state/store";
import Markdown from "../components/Markdown";
import Workbench from "../components/Workbench";
import { useTitle } from "../lib/title";

export default function ProjectPage() {
  const { projectId = "" } = useParams();
  const p = projectById.get(projectId);
  useTitle(p ? `${p.title} (project)` : "Project not found");
  const prog = useStore((s) => s.projects[projectId]);
  const completed = prog?.completed ?? [];
  const firstOpen = p ? Math.min(completed.length, p.milestones.length - 1) : 0;
  const [cur, setCur] = useState(prog?.milestone ?? firstOpen);
  const [hints, setHints] = useState<Record<number, number>>({});
  const [passed, setPassed] = useState(false);
  useEffect(() => setPassed(false), [cur]);

  if (!p) {
    return (
      <div className="page-head">
        <h1>Project not found</h1>
        <Link to="/projects">All projects</Link>
      </div>
    );
  }
  const ms = p.milestones[cur];
  const unlockedUpTo = completed.length; // can open milestones 0..completed.length
  const allDone = completed.length >= p.milestones.length;

  const go = (i: number) => {
    setCur(i);
    patchProject(p.id, { milestone: i });
  };

  return (
    <div className="step-page">
      <div className="crumbs">
        <Link to="/projects">Projects</Link> <span>›</span> <span>{p.title}</span>
      </div>
      <div className="step-grid">
        <aside className="step-text">
          <div className="step-count">
            {p.level} · {p.lang === "c" ? "C" : "C++"}
            {p.after && <> · best after {moduleById.get(p.after)?.title}</>}
          </div>
          <h1>{p.title}</h1>
          <p className="muted">{p.summary}</p>
          <ol className="milestones">
            {p.milestones.map((m, i) => {
              const done = completed.includes(i);
              const locked = i > unlockedUpTo;
              return (
                <li key={i} className={(i === cur ? "cur " : "") + (done ? "done " : "") + (locked ? "locked" : "")}>
                  <button disabled={locked} onClick={() => go(i)}>
                    <span className="step-check">{done ? "✓" : locked ? "🔒" : i + 1}</span>
                    {m.title}
                  </button>
                </li>
              );
            })}
          </ol>
          <hr />
          <h2 className="ms-title">
            Milestone {cur + 1}: {ms.title}
          </h2>
          <Markdown text={ms.text} />
        </aside>
        <section className="step-work">
          {allDone && !passed && <div className="banner banner-pass">🏆 Project complete. Keep polishing, or start another one.</div>}
          {passed && (
            <div className="banner banner-pass big">
              <span>✓ Milestone {cur + 1} done</span>
              {cur + 1 < p.milestones.length ? (
                <button className="btn btn-primary" onClick={() => go(cur + 1)} autoFocus>
                  Next milestone →
                </button>
              ) : (
                <Link className="btn btn-primary" to="/projects">
                  🏆 Project shipped
                </Link>
              )}
            </div>
          )}
          <Workbench
            key={p.id + ":" + cur}
            ex={ms}
            initialCode={prog?.code || ms.seed}
            hintsUsed={hints[cur] ?? 0}
            onHint={(n) => setHints({ ...hints, [cur]: n })}
            onSave={(code) => patchProject(p.id, { code })}
            onPass={() => {
              const c = getState().projects[p.id]?.completed ?? [];
              if (!c.includes(cur)) patchProject(p.id, { completed: [...c, cur].sort((a, b) => a - b) });
              setPassed(true);
            }}
            checkLabel="Check milestone"
          />
        </section>
      </div>
    </div>
  );
}
