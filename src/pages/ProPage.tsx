import { Link, useParams } from "react-router-dom";
import Markdown from "../components/Markdown";
import { pro, proById } from "../content";
import { setProDone, useStore } from "../state/store";

export default function ProPage() {
  const { projectId = "" } = useParams();
  const p = proById.get(projectId);
  const done = useStore((s) => !!s.pro[projectId]);
  if (!p) {
    return (
      <div className="page-head">
        <h1>Project not found</h1>
        <Link to="/pro">Back to the Pro Track</Link>
      </div>
    );
  }
  const i = pro.indexOf(p);
  const prev = pro[i - 1];
  const next = pro[i + 1];
  // The README's first line is its own "# NN · Title" heading; the page header already shows it.
  const body = p.readme.replace(/^# .*\n+/, "");
  return (
    <div className="pro-page">
      <div className="crumbs">
        <Link to="/pro">Pro Track</Link> <span>›</span> <span>Project {String(p.number).padStart(2, "0")}</span>
      </div>
      <div className="page-head">
        <h1>{p.title}</h1>
        <p className="muted">
          About {p.hours} hours · {p.skills.join(" · ")}
        </p>
        <p className="muted small">
          This lesson is also in your Pro Track repository at <code>projects/{p.dir}/README.md</code>. Grade it there with{" "}
          <code>bash tools/grade.sh {p.dir}</code>, or push and check the Actions tab.
        </p>
        <label className="pro-done">
          <input type="checkbox" checked={done} onChange={(e) => setProDone(p.id, e.target.checked)} /> My <b>{p.dir}</b> check is green on GitHub
        </label>
      </div>
      <Markdown className="lesson pro-readme" text={body} />
      <div className="row-between pro-nav">
        {prev ? <Link to={`/pro/${prev.id}`}>‹ {prev.title}</Link> : <Link to="/pro">‹ Pro Track</Link>}
        {next ? <Link to={`/pro/${next.id}`}>{next.title} ›</Link> : <span />}
      </div>
    </div>
  );
}
