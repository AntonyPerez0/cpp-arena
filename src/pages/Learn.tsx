import { useState } from "react";
import { Link } from "react-router-dom";
import { phases, drillsByTopic } from "../content";
import { useStore } from "../state/store";
import { moduleProgress, nextStep } from "../state/derived";

export default function Learn() {
  const s = useStore((x) => x);
  const next = nextStep(s);
  const [open, setOpen] = useState<string | null>(next?.module.id ?? null);

  return (
    <div className="learn">
      <div className="page-head">
        <h1>Curriculum</h1>
        <p className="muted">C first, because it makes memory and pointers concrete. Then C++, where RAII and the standard library solve the problems you felt in C.</p>
      </div>
      {phases.map((ph) => (
        <section key={ph.name} className="phase">
          <h2 className="phase-title">{ph.name}</h2>
          <div className="modules">
            {ph.modules.map((m) => {
              const p = moduleProgress(s, m.id);
              const isOpen = open === m.id;
              const complete = p.done === p.total && p.total > 0;
              return (
                <div key={m.id} className={"module" + (complete ? " module-done" : "") + (isOpen ? " module-open" : "")}>
                  <button className="module-head" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}>
                    <span className={"lang-tag lang-" + m.lang}>{m.lang === "c" ? "C" : "C++"}</span>
                    <span className="module-title">{m.title}</span>
                    <span className="module-count">
                      {p.done}/{p.total}
                    </span>
                    <span className="bar module-bar">
                      <span style={{ width: `${(p.done / Math.max(p.total, 1)) * 100}%` }} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="module-body">
                      <p className="muted">{m.summary}</p>
                      <ol className="steplist">
                        {m.steps.map((st, i) => {
                          const sp = s.steps[st.id];
                          return (
                            <li key={st.id} className={sp?.done ? "done" : ""}>
                              <Link to={`/learn/${m.id}/${i + 1}`}>
                                <span className="step-check">{sp?.done ? "✓" : i + 1}</span>
                                <span className="step-title">{st.title}</span>
                                <span className={"kind-tag kind-" + st.kind}>{st.kind === "fill" ? "fill in" : st.mode === "harness" ? "write function" : "write code"}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                      <div className="muted small">
                        {drillsByTopic.get(m.id) ?? 0} Deathmatch drills unlock when you finish your first step here.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
