import { Link } from "react-router-dom";
import { projects, moduleById } from "../content";
import { useStore } from "../state/store";

export default function Projects() {
  const s = useStore((x) => x);
  const levels = ["Beginner", "Intermediate", "Advanced"];
  return (
    <div className="projects">
      <div className="page-head">
        <h1>Projects</h1>
        <p className="muted">Bigger builds, one milestone at a time. Your code carries forward: each milestone adds a feature to the program you already wrote, and every milestone is checked by real tests.</p>
      </div>
      {levels.map((lvl) => {
        const list = projects.filter((p) => p.level === lvl);
        if (!list.length) return null;
        return (
          <section key={lvl}>
            <h2 className="phase-title">{lvl}</h2>
            <div className="project-grid">
              {list.map((p) => {
                const done = s.projects[p.id]?.completed.length ?? 0;
                const total = p.milestones.length;
                return (
                  <Link key={p.id} to={`/projects/${p.id}`} className={"card card-link project-card" + (done >= total ? " project-done" : "")}>
                    <div className="row-between">
                      <span className={"lang-tag lang-" + p.lang}>{p.lang === "c" ? "C" : "C++"}</span>
                      <span className="muted small">
                        {done}/{total} milestones
                      </span>
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.summary}</p>
                    {p.after && <div className="muted small">Best after: {moduleById.get(p.after)?.title}</div>}
                    <div className="bar">
                      <div style={{ width: `${(done / total) * 100}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
