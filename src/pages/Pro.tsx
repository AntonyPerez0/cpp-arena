import { useState } from "react";
import { Link } from "react-router-dom";
import { pro } from "../content";
import { useStore } from "../state/store";
import { useTitle } from "../lib/title";

export const STARTER_FILE = "pro/cpp-arena-pro.tar.gz";

export function starterUrl() {
  return new URL(import.meta.env.BASE_URL + STARTER_FILE, location.origin).href;
}

export function importCommand() {
  return `curl -fsSL ${starterUrl()} | tar -xz && bash tools/setup.sh && git add -A && git commit -m "Import the Pro Track starter" && git push`;
}

export function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div className="copybox">
      <pre tabIndex={0} className="console tiny">{text}</pre>
      <button className="btn" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function Pro() {
  useTitle("Pro Track");
  const s = useStore((x) => x);
  const done = pro.filter((p) => s.pro[p.id]).length;
  const hours = pro.reduce((n, p) => n + p.hours, 0);
  return (
    <div className="projects pro">
      <div className="page-head">
        <h1>Pro Track</h1>
        <p className="muted">
          The last step from learning C and C++ to working in them. {pro.length} projects (about {hours} hours) on a real Linux machine with the tools
          teams use every day: CMake, Git and pull requests, gdb and sanitizers, GoogleTest, clang-tidy, profilers, libraries, system calls, and two
          capstones. Every project is graded automatically by GitHub Actions each time you push.
        </p>
        <div className="muted small">
          {done}/{pro.length} projects passing
        </div>
        <div className="bar" aria-hidden="true">
          <div style={{ width: `${(done / Math.max(pro.length, 1)) * 100}%` }} />
        </div>
      </div>

      <section className="card pro-setup">
        <h2>Set up once</h2>
        <p className="muted small">
          You need a free GitHub account. GitHub Codespaces gives you a full Linux development environment in the browser (free monthly hours are
          included). Setup works from a phone, but plan to do the projects on a computer or tablet.
        </p>
        <ol className="pro-steps">
          <li>
            On GitHub, create a <b>new public repository</b> (for example <code>cpp-arena-pro</code>) and tick <b>Add a README file</b>. Public
            repositories get unlimited free Actions minutes, and it doubles as your portfolio.
          </li>
          <li>
            On the repository's page, tap <b>Code</b>, then the <b>Codespaces</b> tab, then <b>Create codespace on main</b>.
          </li>
          <li>
            When the editor opens, paste this into its <b>terminal</b> and press Enter. It downloads the starter, installs the tools and pushes
            everything to your repository:
            <CopyBox text={importCommand()} />
          </li>
          <li>
            Open <code>projects/01-toolchain/README.md</code> (the same lesson as the first project below) and start. After each push, the{" "}
            <b>Actions</b> tab on GitHub shows a green or red check for every project you've worked on.
          </li>
        </ol>
        <p className="muted small">
          Prefer your own Linux or macOS machine? <a href={starterUrl()}>Download the starter</a>, extract it into a new Git repository, run{" "}
          <code>bash tools/setup.sh</code> (Ubuntu/Debian), and push it to GitHub.
        </p>
      </section>

      <section>
        <h2 className="phase-title">Projects</h2>
        <div className="project-grid">
          {pro.map((p) => (
            <Link key={p.id} to={`/pro/${p.id}`} className={"card card-link project-card" + (s.pro[p.id] ? " project-done" : "")}>
              <div className="row-between">
                <span className="lang-tag">Project {String(p.number).padStart(2, "0")}</span>
                <span className="muted small">{s.pro[p.id] ? "✓ passing" : `about ${p.hours} h`}</span>
              </div>
              <h3>{p.title}</h3>
              <p>{p.summary}</p>
              <div className="muted small">{p.skills.join(" · ")}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
