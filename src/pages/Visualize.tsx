import { Link, useParams } from "react-router-dom";
import { moduleById, modules, stepPath } from "../content";
import { visualById, visuals } from "../content/visuals";
import Visualizer from "../components/Visualizer";
import Markdown from "../components/Markdown";
import { useTitle } from "../lib/title";

export function VisualIndex() {
  useTitle("Watch C and C++ code run");
  const groups = modules.map((m) => ({ m, list: visuals.filter((v) => v.module === m.id) })).filter((g) => g.list.length);
  return (
    <div>
      <div className="page-head">
        <h1>Watch code run</h1>
        <p className="muted">
          Step through real programs one line at a time and see what happens in memory: variables on the stack, blocks on the heap, and an arrow for every
          pointer. Each recording comes from an actual run under a debugger.
        </p>
      </div>
      {groups.map(({ m, list }) => (
        <section key={m.id} className="phase">
          <h2 className="phase-title">
            {m.title} <span className={"lang-tag lang-" + m.lang}>{m.lang === "c" ? "C" : "C++"}</span>
          </h2>
          <div className="project-grid">
            {list.map((v) => (
              <Link key={v.id} to={`/visualize/${v.id}`} className="card card-link">
                <h3 className="h3">{v.title}</h3>
                <p>{v.summary}</p>
                <span className="muted small">{v.stepCount} steps</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function VisualPage() {
  const { id = "" } = useParams();
  const v = visualById.get(id);
  useTitle(v ? `${v.title} (watch it run)` : "Visualization not found");
  if (!v) {
    return (
      <div className="page-head">
        <h1>Visualization not found</h1>
        <Link to="/visualize">See all visualizations</Link>
      </div>
    );
  }
  const m = moduleById.get(v.module);
  const idx = visuals.indexOf(v);
  const prev = visuals[idx - 1];
  const next = visuals[idx + 1];
  const lessonStep = m?.steps.find((s) => s.id === v.steps[0]) ?? m?.steps[0];
  return (
    <div className="visual-page">
      <div className="crumbs">
        <Link to="/visualize">Watch code run</Link> <span>›</span> <span>{m?.title}</span>
      </div>
      <div className="page-head">
        <h1>
          {v.title} <span className={"lang-tag lang-" + v.lang}>{v.lang === "c" ? "C" : "C++"}</span>
        </h1>
        <Markdown text={v.text} />
        {m && (
          <p className="small">
            From the lesson: <Link to={stepPath(m, lessonStep!)}>{m.title}</Link>
          </p>
        )}
      </div>
      <Visualizer meta={v} />
      <nav className="step-nav" aria-label="More visualizations">
        {prev ? (
          <Link className="btn btn-ghost" to={`/visualize/${prev.id}`}>
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="btn btn-ghost" to={`/visualize/${next.id}`}>
            {next.title} →
          </Link>
        )}
      </nav>
    </div>
  );
}
