import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarCheck,
  Check,
  CircleCheck,
  Code2,
  Cpu,
  Crosshair,
  Eye,
  GraduationCap,
  Hammer,
  TerminalSquare,
} from "lucide-react";
import { useDownloadMegabytes } from "../components/MobileDataCard";
import { useStore } from "../state/store";
import { nextStep, rankFor, totals, dailyStreak, localDay } from "../state/derived";
import { drills, modules, projects, pro, placement, phases, stepPath, topics } from "../content";
import CompilerBadge from "../components/CompilerBadge";
import { highlight } from "../components/highlight";
import { useTitle } from "../lib/title";

const DEMO = `#include <stdio.h>

void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main(void) {
    int x = 3, y = 7;
    swap(&x, &y);
    printf("%d %d\\n", x, y);
    return 0;
}`;

/** A still picture of the lesson workspace: code on top, the checked result below. */
function ProductShot() {
  return (
    <figure className="shot" aria-label="Example: a C exercise that passes its tests">
      <div className="shot-bar">
        <span className="shot-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="shot-tab">swap.c</span>
        <span className="shot-lang lang-tag lang-c">C17</span>
      </div>
      <pre className="shot-code">
        <code>{highlight(DEMO, "demo")}</code>
      </pre>
      <div className="shot-result">
        <div className="shot-pass">
          <CircleCheck className="icon" aria-hidden="true" /> All tests passed
        </div>
        <ul>
          <li>
            <Check className="icon ic-good" aria-hidden="true" /> prints <code>7 3</code>
          </li>
          <li>
            <Check className="icon ic-good" aria-hidden="true" /> no warnings with <code>-Wall -Wextra</code>
          </li>
        </ul>
        <div className="shot-foot">Compiled by Clang 20 in your browser</div>
      </div>
    </figure>
  );
}

function Feature({ icon, title, children, to, span }: { icon: ReactNode; title: string; children: ReactNode; to: string; span?: "wide" | "wide-md" }) {
  return (
    <Link to={to} className={span ? `feature feature-${span}` : "feature"}>
      <span className="feature-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      <span className="feature-more">
        Explore <ArrowRight className="icon" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function Home() {
  useTitle(null);
  const s = useStore((x) => x);
  const t = totals(s);
  const mb = useDownloadMegabytes();
  const next = nextStep(s);
  const r = rankFor(s.dm.best.deathmatch);
  const streak = dailyStreak(s.dm.days);
  const projDone = projects.filter((p) => (s.projects[p.id]?.completed.length ?? 0) >= p.milestones.length).length;
  const started = t.done > 0 || s.dm.kills > 0 || s.placed.length > 0;
  const interview = drills.filter((d) => d.id.startsWith("interview")).length;
  const startTo = next ? stepPath(next.module, next.step) : "/deathmatch";
  const startLabel = !next ? "All lessons done. Go get reps" : t.done === 0 ? "Start learning free" : `Continue: ${next.step.title}`;

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <Cpu className="icon" aria-hidden="true" /> A real compiler in your browser
            </p>
            <h1>
              Learn C and C++ by <span className="hero-accent">writing real code</span>.
            </h1>
            <p className="hero-lead">
              Every exercise you write is compiled by a real Clang compiler running inside your browser. Work through lessons from <code>printf</code> to C++20,
              drill the fundamentals in endless Deathmatch reps, and ship projects milestone by milestone.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-brand btn-lg" to={startTo}>
                {startLabel} <ArrowRight className="icon" aria-hidden="true" />
              </Link>
              <Link className="btn btn-lg" to="/playground">
                <TerminalSquare className="icon" aria-hidden="true" /> Open the playground
              </Link>
            </div>
            <ul className="hero-points">
              <li>
                <Check className="icon" aria-hidden="true" /> Free and open source
              </li>
              <li>
                <Check className="icon" aria-hidden="true" /> No account needed
              </li>
              <li>
                <Check className="icon" aria-hidden="true" /> Works offline
              </li>
            </ul>
            {t.done === 0 && s.placed.length === 0 && (
              <p className="small muted hero-note">
                Already know some C or C++? <Link to="/placement">Take the 5-minute placement quiz</Link> and skip what you know.
              </p>
            )}
          </div>
          <div className="hero-visual">
            <ProductShot />
          </div>
        </div>
      </section>

      <section className="facts" aria-label="The course in numbers">
        <div className="container facts-grid">
          {(
            [
              [modules.length, "modules"],
              [t.total, "lessons"],
              [drills.length, "practice drills"],
              [projects.length, "guided projects"],
              [pro.length, "Pro Track projects"],
              [topics.length, "topic guides"],
            ] as [number, string][]
          ).map(([n, label]) => (
            <div key={label} className="fact">
              <div className="fact-n">{n}</div>
              <div className="fact-l">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {started && (
        <section className="section section-tight" aria-labelledby="progress-h">
          <div className="container">
            <div className="section-head section-head-row">
              <div>
                <p className="eyebrow">Your progress</p>
                <h2 id="progress-h">Welcome back</h2>
              </div>
              {next && (
                <Link className="btn btn-primary" to={startTo}>
                  Continue: {next.step.title} <ArrowRight className="icon" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="stat-row">
              <div className="stat">
                <div className="stat-n">
                  {t.done}
                  <span className="muted">/{t.total}</span>
                </div>
                <div className="stat-l">lesson steps</div>
                <div className="bar" aria-hidden="true">
                  <div style={{ width: `${(t.done / Math.max(t.total, 1)) * 100}%` }} />
                </div>
              </div>
              <div className="stat">
                <div className="stat-n">{s.dm.best.deathmatch}</div>
                <div className="stat-l">best deathmatch streak</div>
                <div className="rank-chip">{r.rank.name}</div>
              </div>
              <div className="stat">
                <div className="stat-n">{s.dm.kills}</div>
                <div className="stat-l">total reps landed</div>
                <div className="muted small">{streak > 0 ? `${streak}-day streak` : "20 reps in a day starts a streak"}</div>
              </div>
              <div className="stat">
                <div className="stat-n">
                  {projDone}
                  <span className="muted">/{projects.length}</span>
                </div>
                <div className="stat-l">projects shipped</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="how-h">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-h">Read a little, write a lot, get real feedback</h2>
            <p className="section-lead">Each lesson is one idea and one exercise. You learn by typing code that has to compile and pass tests, not by watching.</p>
          </div>
          <ol className="how">
            <li>
              <span className="how-icon" aria-hidden="true">
                <BookOpen className="icon" />
              </span>
              <h3>Learn one idea</h3>
              <p>A short explanation with a worked example you can run. Early steps are fill-in-the-blank, later ones have you write most of the code.</p>
            </li>
            <li>
              <span className="how-icon" aria-hidden="true">
                <Code2 className="icon" />
              </span>
              <h3>Write the code</h3>
              <p>A real editor with syntax highlighting, hints you reveal one at a time, and a symbol bar for typing code on a phone.</p>
            </li>
            <li>
              <span className="how-icon" aria-hidden="true">
                <CircleCheck className="icon" />
              </span>
              <h3>Compile and check it</h3>
              <p>Clang compiles your program and tests check its output. Compiler errors come with an explanation in plain English.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="features-h">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Everything in one place</p>
            <h2 id="features-h">From your first printf to professional C++</h2>
          </div>
          <div className="features">
            <Feature span="wide" to="/learn" icon={<BookOpen className="icon" />} title={`${modules.length} modules, zero to C++20`}>
              C first, because it makes memory and pointers concrete. Then C++, the standard library, modern and professional C++, and data structures and
              algorithms, ending in a code-review capstone.
            </Feature>
            <Feature to="/deathmatch" icon={<Crosshair className="icon" />} title="Deathmatch drills">
              {drills.length} quick reps: predict the output, fill the token, spot the bug. Every 8th rep is a boss you compile for real.
            </Feature>
            <Feature to="/projects" icon={<Hammer className="icon" />} title={`${projects.length} guided projects`}>
              From a calculator and a text adventure to a memory allocator, an interpreter and your own vector&lt;T&gt;.
            </Feature>
            <Feature to="/visualize" icon={<Eye className="icon" />} title="Watch code run">
              Step through real programs and see the stack, the heap and every pointer drawn as an arrow.
            </Feature>
            <Feature to="/playground" icon={<TerminalSquare className="icon" />} title="Playground">
              Run any C or C++ program with input, and share it as a link.
            </Feature>
            <Feature to="/deathmatch" icon={<GraduationCap className="icon" />} title="Interview prep">
              {interview} classic interview questions on pointers, memory, virtual functions, move semantics and the STL.
            </Feature>
            <Feature to="/daily" icon={<CalendarCheck className="icon" />} title="Daily challenge">
              {localDay() in s.daily ? "Done for today. Come back tomorrow." : "One quick problem a day, the same for everyone. Keep your streak going."}
            </Feature>
            <Feature span="wide-md" to="/pro" icon={<Briefcase className="icon" />} title={`Pro Track: ${pro.length} projects on a real machine`}>
              CMake, Git and pull requests, gdb and sanitizers, unit tests, profiling, threads and sockets, graded by GitHub Actions in your own repository,
              like a team's CI.
            </Feature>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="curriculum-h">
        <div className="container">
          <div className="section-head section-head-row">
            <div>
              <p className="eyebrow">Curriculum</p>
              <h2 id="curriculum-h">A path, not a pile of tutorials</h2>
              <p className="section-lead">
                {t.total} lessons in {phases.length} stages, in the order that makes each idea easy. Drills unlock as you finish the lessons that teach them.
              </p>
            </div>
            <Link className="btn" to="/learn">
              See the full curriculum <ArrowRight className="icon" aria-hidden="true" />
            </Link>
          </div>
          <ol className="tracks">
            {phases.map((ph, i) => (
              <li key={ph.name}>
                <Link to="/learn" className="track">
                  <span className="track-n" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="track-body">
                    <span className="track-name">{ph.name}</span>
                    <span className="track-meta">
                      {ph.modules.length} {ph.modules.length === 1 ? "module" : "modules"} · {ph.modules.reduce((a, m) => a + m.steps.length, 0)} lessons
                    </span>
                  </span>
                  <span className={`lang-tag ${ph.modules[0].lang === "c" ? "lang-c" : "lang-cpp"}`}>{ph.modules[0].lang === "c" ? "C" : "C++"}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="faq-h">
        <div className="container faq-wrap">
          <div className="section-head">
            <p className="eyebrow">Questions</p>
            <h2 id="faq-h">Frequently asked questions</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Is it really free?</summary>
              <p>Yes. Every lesson, drill and project, and the whole Pro Track, is free. The site is open source, and the code is on GitHub.</p>
            </details>
            <details>
              <summary>Do I need to install anything?</summary>
              <p>
                No. The first time you run code, your browser downloads the Clang compiler once
                {mb ? ` (about ${mb.c} MB, or ${mb.cpp} MB with the C++ extras)` : ""} and keeps it, so later visits load it from the cache. When your
                browser reports mobile data, it asks first.
              </p>
            </details>
            <details>
              <summary>Do I need an account?</summary>
              <p>
                No. Your progress is saved in your browser. To move it to another device, use a transfer link or a private GitHub Gist from <Link to="/profile">your
                profile</Link>.
              </p>
            </details>
            <details>
              <summary>Which compiler and language versions does it use?</summary>
              <p>
                Clang 20 compiled to WebAssembly. C code is compiled as C17 and C++ as C++20, with warnings on (<code>-Wall -Wextra</code>), and C++ exceptions work.
              </p>
            </details>
            <details>
              <summary>Can I learn on my phone, or without a connection?</summary>
              <p>Yes. Every page fits a phone screen, and a symbol bar puts code characters one tap away. After one visit, the site and a downloaded compiler also work offline.</p>
            </details>
            <details>
              <summary>I already know some C or C++. Where should I start?</summary>
              <p>
                Take the <Link to="/placement">placement quiz</Link>: {placement.length} quick questions that mark the modules you already know, so you can skip them.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="cta-band" aria-labelledby="cta-h">
        <div className="container cta-inner">
          <h2 id="cta-h">Write your first C program today.</h2>
          <p>No download, no account. Just open a lesson and start typing.</p>
          <div className="hero-actions cta-actions">
            <Link className="btn btn-brand btn-lg" to={startTo}>
              {startLabel} <ArrowRight className="icon" aria-hidden="true" />
            </Link>
          </div>
          <div className="cta-compiler">
            <CompilerBadge />
            <span className="muted small">
              The compiler downloads once ({mb ? `about ${mb.c} MB, ${mb.cpp} MB with the C++ extras` : "the whole Clang/LLVM toolchain"}), then loads from your browser's
              cache.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
