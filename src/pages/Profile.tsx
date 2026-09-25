import { useState } from "react";
import SyncPanel, { IncomingTransfer } from "../components/SyncPanel";
import { modules } from "../content";
import { exportProgress, patchSettings, resetProgress, useStore, type Theme } from "../state/store";
import { TEXT_SIZES } from "../lib/appearance";
import ShareButton from "../components/ShareButton";
import { Link } from "react-router-dom";
import { RANKS, dailyStreak, moduleProgress, rankFor, topicStats, totals } from "../state/derived";
import { clearCompilerCache } from "../compiler/client";
import CompilerBadge from "../components/CompilerBadge";
import { useTitle } from "../lib/title";

export default function Profile() {
  useTitle("Your progress");
  const s = useStore((x) => x);
  const r = rankFor(s.dm.best.deathmatch);
  const t = totals(s);
  const ts = topicStats(s);
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
      <IncomingTransfer />
      <div className="cards3">
        <div className="card">
          <div className="card-kicker">Rank</div>
          <h2 className="h3">{r.rank.name}</h2>
          <p className="muted small">
            Based on your best Deathmatch (1 life) streak: {s.dm.best.deathmatch}.
            {r.next && ` Reach ${r.next.at} for ${r.next.name}.`}
          </p>
          <div className="ranks">
            {RANKS.map((x, i) => (
              <span key={x.name} className={"rank-pip" + (i <= r.index ? " on" : "")} title={`${x.name} (${x.at})`} />
            ))}
          </div>
          {s.dm.best.deathmatch > 0 && (
            <div className="actions">
              <ShareButton
                card={{ kicker: "Deathmatch rank", title: r.rank.name, lines: [`Best streak: ${s.dm.best.deathmatch}`, `${t.done} of ${t.total} lesson steps done`], file: "cpparena-rank.png" }}
                text={`I'm ${r.rank.name} on C/C++ Arena.`}
                label="Share rank"
              />
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-kicker">Lessons</div>
          <h2 className="h3">
            {t.done} / {t.total} steps
          </h2>
          <p className="muted small">{clean} solved clean (no hints, no solution peek).</p>
          <p className="small">
            <Link to="/certificate">Certificates</Link>
          </p>
        </div>
        <div className="card">
          <div className="card-kicker">Deathmatch</div>
          <h2 className="h3">{s.dm.kills} kills</h2>
          <p className="muted small">
            {s.dm.reps} reps · {s.dm.reps ? Math.round((s.dm.kills / s.dm.reps) * 100) : 0}% accuracy · {s.dm.bossKills} bosses · daily streak {dailyStreak(s.dm.days)}
          </p>
        </div>
      </div>

      <section className="card">
        <h2 className="h3">Topics</h2>
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
        <h2 className="h3">Appearance</h2>
        <fieldset className="radio-row">
          <legend>Theme</legend>
          {(
            [
              ["system", "Match my device"],
              ["dark", "Dark"],
              ["light", "Light"],
            ] as [Theme, string][]
          ).map(([v, label]) => (
            <label key={v}>
              <input type="radio" name="theme" value={v} checked={s.settings.theme === v} onChange={() => patchSettings({ theme: v })} /> {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="radio-row">
          <legend>Text size</legend>
          {TEXT_SIZES.map((t) => (
            <label key={t.value}>
              <input type="radio" name="textsize" value={t.value} checked={s.settings.textScale === t.value} onChange={() => patchSettings({ textScale: t.value })} /> {t.label}
            </label>
          ))}
        </fieldset>
      </section>

      <SyncPanel onFile={download} onMessage={setMsg} />
      <section className="card">
        <h2 className="h3">Start over</h2>
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
      </section>
      <p className="visually-hidden" role="status" aria-live="polite">
        {msg}
      </p>
      {msg && <div className="toast">{msg}</div>}

      <section className="card">
        <h2 className="h3">Compiler</h2>
        <p className="muted small">
          Clang 20 + LLD compiled to WebAssembly (the browsercc project). C compiles with <code>-std=c17 -O1 -Wall -Wextra</code>, C++ with <code>-std=c++20 -O2 -fno-exceptions -Wall -Wextra</code>
          and a precompiled standard-library header for speed. Programs run on a WASI runtime in a background thread with a 3 second time limit, each with
          its own private folder for files. Known limits: no exceptions and no threads (the Pro Track covers both on a real machine), and stdin is
          supplied up front rather than typed live.
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
