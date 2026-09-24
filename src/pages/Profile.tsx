import { useRef, useState } from "react";
import { modules } from "../content";
import { exportProgress, importProgress, resetProgress, useStore } from "../state/store";
import { RANKS, dailyStreak, moduleProgress, rankFor, topicStats, totals } from "../state/derived";
import { clearCompilerCache } from "../compiler/client";
import CompilerBadge from "../components/CompilerBadge";

export default function Profile() {
  const s = useStore((x) => x);
  const r = rankFor(s.dm.best.deathmatch);
  const t = totals(s);
  const ts = topicStats(s);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const clean = Object.values(s.steps).filter((x) => x.done && x.clean).length;

  const download = () => {
    const blob = new Blob([exportProgress()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cpp-arena-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const weakest = [...ts.entries()]
    .filter(([, v]) => v.right + v.wrong >= 3)
    .map(([k, v]) => ({ id: k, acc: v.right / (v.right + v.wrong), n: v.right + v.wrong }))
    .sort((a, b) => a.acc - b.acc);

  return (
    <div className="profile">
      <div className="page-head">
        <h1>Profile</h1>
      </div>
      <div className="cards3">
        <div className="card">
          <div className="card-kicker">Rank</div>
          <h3>{r.rank.name}</h3>
          <p className="muted small">
            Based on your best Deathmatch (1 life) streak: {s.dm.best.deathmatch}.
            {r.next && ` Reach ${r.next.at} for ${r.next.name}.`}
          </p>
          <div className="ranks">
            {RANKS.map((x, i) => (
              <span key={x.name} className={"rank-pip" + (i <= r.index ? " on" : "")} title={`${x.name} (${x.at})`} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-kicker">Lessons</div>
          <h3>
            {t.done} / {t.total} steps
          </h3>
          <p className="muted small">{clean} solved clean (no hints, no solution peek).</p>
        </div>
        <div className="card">
          <div className="card-kicker">Deathmatch</div>
          <h3>{s.dm.kills} kills</h3>
          <p className="muted small">
            {s.dm.reps} reps · {s.dm.reps ? Math.round((s.dm.kills / s.dm.reps) * 100) : 0}% accuracy · {s.dm.bossKills} bosses · daily streak {dailyStreak(s.dm.days)}
          </p>
        </div>
      </div>

      <section className="card">
        <h3>Topics</h3>
        {weakest.length > 0 && (
          <p>
            Weakest weapon right now: <b>{modules.find((m) => m.id === weakest[0].id)?.title}</b> ({Math.round(weakest[0].acc * 100)}% over {weakest[0].n} reps). Warm-up mode
            will keep feeding it to you.
          </p>
        )}
        <table className="runs">
          <thead>
            <tr>
              <th>Module</th>
              <th>Lessons</th>
              <th>Drill accuracy</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const p = moduleProgress(s, m.id);
              const d = ts.get(m.id);
              return (
                <tr key={m.id}>
                  <td>
                    <span className={"lang-tag lang-" + m.lang}>{m.lang === "c" ? "C" : "C++"}</span> {m.title}
                  </td>
                  <td>
                    {p.done}/{p.total}
                  </td>
                  <td>{d && d.right + d.wrong > 0 ? `${Math.round((d.right / (d.right + d.wrong)) * 100)}% (${d.right + d.wrong})` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Your data</h3>
        <p className="muted small">
          Progress is saved in this browser only. Export it to move to another device or keep a backup.
        </p>
        <div className="actions">
          <button className="btn" onClick={download}>
            Export progress
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import progress
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importProgress(await f.text());
                setMsg("Progress imported.");
              } catch (err: any) {
                setMsg("Import failed: " + err.message);
              }
            }}
          />
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm("Erase all progress in this browser? This can't be undone (export first if unsure).")) {
                resetProgress();
                setMsg("Progress reset.");
              }
            }}
          >
            Reset everything
          </button>
        </div>
        {msg && <p>{msg}</p>}
      </section>

      <section className="card">
        <h3>Compiler</h3>
        <p className="muted small">
          Clang 20 + LLD compiled to WebAssembly (the browsercc project). C compiles with <code>-std=c17</code>, C++ with <code>-std=c++20 -O2 -fno-exceptions</code>
          and a precompiled standard-library header for speed. Programs run on a WASI runtime in a background thread with a 3 second time limit. Known limits:
          no exceptions, no threads, and stdin is supplied up front rather than typed live.
        </p>
        <div className="actions">
          <CompilerBadge />
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await clearCompilerCache();
              setMsg("Compiler cache cleared. It will download again next time.");
            }}
          >
            Clear compiler cache
          </button>
        </div>
      </section>
    </div>
  );
}
