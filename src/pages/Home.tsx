import { Link } from "react-router-dom";
import { useStore } from "../state/store";
import { nextStep, rankFor, totals, dailyStreak } from "../state/derived";
import { drills, modules, projects, pro } from "../content";
import CompilerBadge from "../components/CompilerBadge";

export default function Home() {
  const s = useStore((x) => x);
  const t = totals(s);
  const next = nextStep(s);
  const r = rankFor(s.dm.best.deathmatch);
  const streak = dailyStreak(s.dm.days);
  const projDone = projects.filter((p) => (s.projects[p.id]?.completed.length ?? 0) >= p.milestones.length).length;

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <h1>
            Learn C and C++ by <span className="accent">writing real code</span>.
          </h1>
          <p className="lead">
            Every answer is compiled by a real Clang compiler running inside your browser. Work through lessons from <code>printf</code> to C++20, drill
            the fundamentals in endless Deathmatch reps, and ship projects milestone by milestone.
          </p>
          <div className="hero-actions">
            {next ? (
              <Link className="btn btn-primary btn-lg" to={`/learn/${next.module.id}/${next.index + 1}`}>
                {t.done === 0 ? "Start from zero" : "Continue"}: {next.step.title}
              </Link>
            ) : (
              <Link className="btn btn-primary btn-lg" to="/deathmatch">
                All lessons done. Go get reps
              </Link>
            )}
            <Link className="btn btn-lg btn-dm" to="/deathmatch">
              ⌖ Deathmatch
            </Link>
          </div>
          <div className="hero-compiler">
            <CompilerBadge />
            <span className="muted small">The compiler downloads once (about 95 MB, the whole Clang/LLVM toolchain), then loads from your browser's cache.</span>
          </div>
        </div>
      </section>

      <section className="stat-row">
        <div className="stat">
          <div className="stat-n">
            {t.done}
            <span className="muted">/{t.total}</span>
          </div>
          <div className="stat-l">lesson steps</div>
          <div className="bar">
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
          <div className="muted small">{streak > 0 ? `🔥 ${streak}-day streak` : "20 reps in a day starts a streak"}</div>
        </div>
        <div className="stat">
          <div className="stat-n">
            {projDone}
            <span className="muted">/{projects.length}</span>
          </div>
          <div className="stat-l">projects shipped</div>
        </div>
      </section>

      <section className="cards3">
        <Link to="/learn" className="card card-link">
          <div className="card-kicker">Learn</div>
          <h3>{modules.length} modules, zero to C++20</h3>
          <p>
            Fill in the blanks when a concept is new, then write most of the code yourself. Hints unlock one at a time, and compiler errors come with a
            plain-English explanation.
          </p>
        </Link>
        <Link to="/deathmatch" className="card card-link card-dm">
          <div className="card-kicker">Deathmatch</div>
          <h3>Endless reps, one life</h3>
          <p>
            {drills.length} drills: predict the output, fill the token, spot the bug, will it compile. Every 8th rep is a boss rep you compile for real.
            Misses come back until you own them.
          </p>
        </Link>
        <Link to="/projects" className="card card-link">
          <div className="card-kicker">Projects</div>
          <h3>{projects.length} builds with milestones</h3>
          <p>From a calculator and a text adventure to a memory allocator, an expression interpreter and your own vector&lt;T&gt;.</p>
        </Link>
        <Link to="/pro" className="card card-link">
          <div className="card-kicker">Pro Track</div>
          <h3>{pro.length} projects on a real machine</h3>
          <p>
            CMake, Git and pull requests, gdb and sanitizers, unit tests, profiling, threads, sockets and two capstones, graded by GitHub Actions like a
            team's CI.
          </p>
        </Link>
      </section>
    </div>
  );
}
