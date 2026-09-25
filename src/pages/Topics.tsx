import { Link, useParams } from "react-router-dom";
import { moduleById, topicBySlug, topics } from "../content";
import { visualById } from "../content/visuals";
import Markdown from "../components/Markdown";
import { CodeView } from "../components/highlight";
import { useTitle } from "../lib/title";

const GROUPS: [string, (t: (typeof topics)[number]) => boolean][] = [
  ["C", (t) => t.lang === "c"],
  ["C++", (t) => t.lang === "cpp" && !t.modules.some((m) => m.startsWith("dsa-"))],
  ["Data structures and algorithms", (t) => t.modules.some((m) => m.startsWith("dsa-"))],
];

export function TopicIndex() {
  useTitle("C and C++ topics explained");
  return (
    <div>
      <div className="page-head">
        <h1>C and C++ topics</h1>
        <p className="muted">Short explanations of the core ideas, each with a tested example and a link to the lesson where you practice it.</p>
      </div>
      {GROUPS.map(([name, test]) => (
        <section key={name} className="phase">
          <h2 className="phase-title">{name}</h2>
          <ul className="topic-list">
            {topics.filter(test).map((t) => (
              <li key={t.slug}>
                <Link to={`/topics/${t.slug}`}>{t.title}</Link>
                <span className="muted small"> · {t.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TopicPage() {
  const { slug = "" } = useParams();
  const t = topicBySlug.get(slug);
  useTitle(t ? t.title : "Topic not found");
  if (!t) {
    return (
      <div className="page-head">
        <h1>Topic not found</h1>
        <Link to="/topics">See all topics</Link>
      </div>
    );
  }
  const visual = t.visual ? visualById.get(t.visual) : undefined;
  const related = topics.filter((x) => x.slug !== t.slug && x.modules.some((m) => t.modules.includes(m))).slice(0, 4);
  return (
    <article className="topic-page narrow">
      <div className="crumbs">
        <Link to="/topics">Topics</Link> <span>›</span> <span>{t.lang === "c" ? "C" : "C++"}</span>
      </div>
      <h1>{t.title}</h1>
      <p className="lead">{t.description}</p>
      <Markdown text={t.body} />
      <h2 className="h3">Example</h2>
      <CodeView code={t.example} />
      {t.stdin && (
        <>
          <div className="lbl">input</div>
          <pre className="console" tabIndex={0}>
            {t.stdin}
          </pre>
        </>
      )}
      <div className="lbl">output</div>
      <pre className="console" tabIndex={0}>
        {t.output}
      </pre>
      {visual && (
        <Link to={`/visualize/${visual.id}`} className="watch-card">
          <span className="watch-icon" aria-hidden="true">
            ▶
          </span>
          <span>
            <b>Watch it run:</b> {visual.title}
          </span>
        </Link>
      )}
      {t.modules.length > 0 && (
        <section className="card topic-practice">
          <h2 className="h3">Practice it</h2>
          <ul>
            {t.modules.map((m) => (
              <li key={m}>
                <Link to={`/learn/${m}/1`}>Lesson: {moduleById.get(m)?.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {related.length > 0 && (
        <nav aria-label="Related topics" className="topic-related">
          <h2 className="h3">Related</h2>
          <ul>
            {related.map((x) => (
              <li key={x.slug}>
                <Link to={`/topics/${x.slug}`}>{x.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
