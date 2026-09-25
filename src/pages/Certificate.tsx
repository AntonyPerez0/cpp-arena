import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allSteps, pro } from "../content";
import { patchSettings, useStore, type State } from "../state/store";
import { rankFor } from "../state/derived";
import ShareButton from "../components/ShareButton";
import { useTitle } from "../lib/title";

type Cert = { kind: "course" | "pro"; name: string; date: string; steps: number; clean: number; rank: string; repo?: string };

const TITLES = { course: "C and C++ Programming", pro: "Professional C and C++ (Pro Track)" };

function encode(c: Cert) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(c)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(s: string): Cert | null {
  try {
    const c = JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))) as Cert;
    return c && (c.kind === "course" || c.kind === "pro") && typeof c.name === "string" ? c : null;
  } catch {
    return null;
  }
}

function courseStatus(s: State) {
  const done = allSteps.filter(({ step }) => s.steps[step.id]?.done);
  const last = Math.max(0, ...done.map(({ step }) => s.steps[step.id]?.doneAt ?? 0));
  return { done: done.length, total: allSteps.length, clean: done.filter(({ step }) => s.steps[step.id]?.clean).length, last };
}

function CertCard({ c }: { c: Cert }) {
  const date = new Date(c.date + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="cert" role="img" aria-label={`Certificate: ${c.name} completed ${TITLES[c.kind]} on ${date}`}>
      <div className="cert-brand">C/C++ Arena</div>
      <div className="cert-kicker">Certificate of completion</div>
      <div className="cert-name">{c.name}</div>
      <div className="cert-line">has completed</div>
      <div className="cert-title">{TITLES[c.kind]}</div>
      {c.kind === "course" ? (
        <div className="cert-detail">
          {c.steps} compiled exercises across 44 modules, from pointers and memory to modern C++, data structures and algorithms · {c.clean} solved with no
          hints · Deathmatch rank: {c.rank}
        </div>
      ) : (
        <div className="cert-detail">
          12 projects built with CMake, Git, sanitizers, unit tests, profiling, threads and sockets, graded by GitHub Actions
          {c.repo ? ` · ${c.repo}` : ""}
        </div>
      )}
      <div className="cert-foot">
        <span>{date}</span>
        <span>cpparena.com</span>
      </div>
    </div>
  );
}

/** A certificate someone shared: /certificate#view=... */
function SharedCert({ c }: { c: Cert }) {
  return (
    <div className="narrow">
      <h1 className="visually-hidden">Shared certificate</h1>
      <CertCard c={c} />
      <p className="muted small cert-note">
        This certificate was created in the learner's own browser. C/C++ Arena has no accounts, so it can't be independently verified from this page.
        {c.kind === "pro" && c.repo ? " The Pro Track repository linked above shows each project's automated grading results in its GitHub Actions tab." : ""}
      </p>
      <p>
        <Link to="/">Learn C and C++ on C/C++ Arena</Link>
      </p>
    </div>
  );
}

export default function Certificate() {
  useTitle("Certificates");
  const s = useStore((x) => x);
  const [shared, setShared] = useState<Cert | null>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    const m = location.hash.match(/^#view=([\w-]+)$/);
    if (m) setShared(decode(m[1]));
  }, []);
  const course = courseStatus(s);
  const proDone = pro.filter((p) => s.pro[p.id]).length;
  const today = new Date().toISOString().slice(0, 10);
  const certs = useMemo(() => {
    const list: Cert[] = [];
    const name = s.settings.certName.trim();
    if (!name) return list;
    const rank = rankFor(s.dm.best.deathmatch).rank.name;
    if (course.done === course.total) list.push({ kind: "course", name, date: course.last ? new Date(course.last).toISOString().slice(0, 10) : today, steps: course.done, clean: course.clean, rank });
    if (proDone === pro.length && pro.length > 0) list.push({ kind: "pro", name, date: today, steps: course.done, clean: course.clean, rank, repo: s.settings.proRepo.trim() || undefined });
    return list;
  }, [s, course.done, course.total, course.last, course.clean, proDone, today]);

  if (shared) return <SharedCert c={shared} />;

  return (
    <div className="narrow">
      <div className="page-head">
        <h1>Certificates</h1>
        <p className="muted">Finish the course or the Pro Track and you can print a certificate, save it as a PDF, or share it.</p>
      </div>
      <section className="card">
        <h2 className="h3">Requirements</h2>
        <ul className="cert-reqs">
          <li className={course.done === course.total ? "ok" : ""}>
            <b>C and C++ Programming:</b> finish every lesson step ({course.done} of {course.total} done). Modules skipped by the placement quiz still need
            their steps finished.
          </li>
          <li className={proDone === pro.length ? "ok" : ""}>
            <b>Pro Track:</b> mark all {pro.length} projects as passing on their pages ({proDone} of {pro.length}).
          </li>
        </ul>
        <label className="lbl" htmlFor="cert-name">
          Name to print
        </label>
        <input id="cert-name" className="answer-input" value={s.settings.certName} onChange={(e) => patchSettings({ certName: e.target.value.slice(0, 60) })} placeholder="Your name" autoComplete="name" />
        <label className="lbl" htmlFor="cert-repo">
          Pro Track repository on GitHub (optional, shown on the Pro Track certificate)
        </label>
        <input id="cert-repo" className="answer-input" value={s.settings.proRepo} onChange={(e) => patchSettings({ proRepo: e.target.value.slice(0, 100) })} placeholder="github.com/you/cpp-arena-pro" />
      </section>
      {!s.settings.certName.trim() && (course.done === course.total || proDone === pro.length) && <p>Type your name above to see your certificate.</p>}
      {certs.map((c) => (
        <section key={c.kind} className="cert-wrap">
          <CertCard c={c} />
          <div className="actions no-print">
            <button className="btn btn-primary" onClick={() => window.print()}>
              Print or save as PDF
            </button>
            <ShareButton card={{ kicker: "Certificate of completion", title: TITLES[c.kind], lines: [c.name], file: `cpparena-certificate-${c.kind}.png` }} text={`I completed ${TITLES[c.kind]} on C/C++ Arena.`} label="Share image" />
            <button
              className="btn"
              onClick={async () => {
                const url = `${location.origin}${import.meta.env.BASE_URL}certificate#view=${encode(c)}`;
                await navigator.clipboard.writeText(url);
                setCopied(c.kind);
              }}
            >
              Copy link
            </button>
            <span role="status" className="small muted">
              {copied === c.kind ? "Link copied." : ""}
            </span>
          </div>
        </section>
      ))}
      {certs.length === 0 && course.done < course.total && (
        <p>
          <Link className="btn btn-primary" to="/learn">
            Keep learning
          </Link>
        </p>
      )}
    </div>
  );
}
