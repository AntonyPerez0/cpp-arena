import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { drills, firstStepPath, moduleById, modules } from "../content";
import type { Drill } from "../content/types";
import { getState, patchSettings, useStore, type DmMode } from "../state/store";
import { dailyStreak, drillUnlocked, rankFor, unlockedTopics } from "../state/derived";
import { blip, callout, isDue, lives, pickNext, recordRep, recordRun, BOSS_EVERY, topicTitle, INTERVIEW } from "../deathmatch/engine";
import { Rep, Death } from "../deathmatch/Reps";
import { ensureCompiler, mayAutoDownload } from "../compiler/client";
import ShareButton from "../components/ShareButton";
import { useTitle } from "../lib/title";

type Phase = "lobby" | "playing" | "review" | "dead" | "cleared";
type Kill = { id: number; topic: string; type: Drill["type"]; ms: number; ok: boolean };

export default function Deathmatch() {
  useTitle("Deathmatch");
  const s = useStore((x) => x);
  const unlocked = unlockedTopics(s);
  const selected = (s.settings.topics ?? unlocked).filter((t) => unlocked.includes(t));
  const topics = selected.length ? selected : unlocked;
  // Only drills whose teaching step is done (see drillUnlocked); recomputed as progress changes.
  const topicPool = useMemo(
    () => drills.filter((d) => topics.includes(d.topic) && (s.settings.boss || d.type !== "boss") && drillUnlocked(s, d)),
    [topics.join(","), s.settings.boss, s.settings.unlockAll, s.steps, s.drills, s.placed],
  );
  const interviewPool = useMemo(() => drills.filter((d) => d.topic === INTERVIEW && (s.settings.boss || d.type !== "boss")), [s.settings.boss]);
  const dueCount = topicPool.filter((d) => isDue(s.drills[d.id])).length;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [mode, setMode] = useState<DmMode>("deathmatch");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [streak, setStreak] = useState(0);
  const [reps, setReps] = useState(0);
  const [kills, setKills] = useState(0);
  const [hp, setHp] = useState(1);
  const [feed, setFeed] = useState<Kill[]>([]);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const [shout, setShout] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [lastWrong, setLastWrong] = useState<{ drill: Drill; given: string } | null>(null);
  const [startBest, setStartBest] = useState(0);
  const recent = useRef<string[]>([]);
  const repStart = useRef(0);
  const feedId = useRef(0);

  const nextRep = useCallback(
    (repNo: number, m: DmMode) => {
      const d = pickNext(m === "interview" ? interviewPool : topicPool, getState(), recent.current, repNo, getState().settings.boss, m);
      if (!d) {
        setPhase("cleared");
        return;
      }
      recent.current = [...recent.current, d.id].slice(-30);
      setDrill(d);
      repStart.current = performance.now();
    },
    [topicPool, interviewPool],
  );

  const start = (m: DmMode) => {
    const p = m === "interview" ? interviewPool : topicPool;
    if (!p.length) return;
    if (m === "warmup" && dueCount === 0) return;
    // Boss reps compile for real: fetch the compiler in the background, unless that would cost mobile data
    // (then the first boss rep's Fire button starts the download).
    if (s.settings.boss && p.some((d) => d.type === "boss"))
      mayAutoDownload(s.settings.mobileData).then((ok) => ok && ensureCompiler({ warmCpp: p.some((d) => d.lang === "cpp") }));
    setMode(m);
    setStreak(0);
    setReps(0);
    setKills(0);
    setHp(lives(m));
    setFeed([]);
    setLastWrong(null);
    setStartBest(getState().dm.best[m]);
    recent.current = [];
    setPhase("playing");
    nextRep(0, m);
  };

  const endRun = (finalStreak: number, finalReps: number, finalKills: number) => {
    recordRun(mode, finalStreak, finalReps, finalKills);
  };

  const answer = (given: string, ok: boolean) => {
    if (!drill || phase !== "playing") return;
    const ms = performance.now() - repStart.current;
    recordRep(drill, ok);
    const r = reps + 1;
    setReps(r);
    setFeed((f) => [{ id: feedId.current++, topic: drill.topic, type: drill.type, ms, ok }, ...f].slice(0, 6));
    if (ok) {
      const st = streak + 1;
      const k = kills + 1;
      setStreak(st);
      setKills(k);
      const c = callout(st);
      if (getState().settings.sound) blip(c ? "streak" : drill.type === "boss" ? "boss" : "hit");
      setFlash("hit");
      setSaid(`Correct. Streak ${st}.${c ? " " + c : ""}`);
      if (c) {
        setShout(c);
        setTimeout(() => setShout(null), 1100);
      }
      setTimeout(() => setFlash(null), 220);
      nextRep(r, mode);
    } else {
      if (getState().settings.sound) blip("miss");
      setFlash("miss");
      setSaid(hp - 1 <= 0 ? "Wrong. Eliminated." : `Wrong. ${hp - 1} ${hp - 1 === 1 ? "life" : "lives"} left.`);
      setTimeout(() => setFlash(null), 300);
      setLastWrong({ drill, given });
      const left = hp - 1;
      setHp(left);
      if (left <= 0) {
        endRun(streak, r, kills);
        setPhase("dead");
      } else {
        setPhase("review");
        if (mode !== "warmup") setStreak(0);
      }
    }
  };

  const continueAfterReview = () => {
    setLastWrong(null);
    setPhase("playing");
    nextRep(reps, mode);
  };

  // Global hotkeys for lobby / death / review screens.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (tag === "BUTTON" && e.key === "Enter")) return;
      const letters = getState().settings.keys !== false;
      if (phase === "dead" && (e.key === "Enter" || (letters && (e.key === "r" || e.key === "R")))) {
        e.preventDefault();
        start(mode);
      } else if (phase === "dead" && e.key === "Escape") setPhase("lobby");
      else if (phase === "review" && e.key === "Enter") {
        e.preventDefault();
        continueAfterReview();
      } else if (phase === "cleared" && e.key === "Enter") setPhase("lobby");
      else if (phase === "playing" && e.key === "Escape") {
        endRun(streak, reps, kills);
        setPhase("lobby");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (phase === "lobby") return <Lobby pool={topicPool} interviewCount={interviewPool.length} unlocked={unlocked} selected={topics} dueCount={dueCount} onStart={start} />;

  const best = Math.max(startBest, mode === "warmup" ? kills : streak);
  return (
    <div className={"dm" + (flash ? " dm-flash-" + flash : "")}>
      <h1 className="visually-hidden">Deathmatch run</h1>
      <div className="hud">
        <div className="hud-streak">
          <div className="hud-n">{mode === "warmup" ? kills : streak}</div>
          <div className="hud-l">{mode === "warmup" ? "cleared" : "streak"}</div>
        </div>
        <div className="hud-mid">
          <div className="hud-mode">{mode === "deathmatch" ? "Deathmatch · 1 life" : mode === "casual" ? "Casual · 3 lives" : mode === "interview" ? "Interview prep · 3 lives" : "Warm-up · due reviews"}</div>
          <div className="hud-lives" role="img" aria-label={`${hp} ${hp === 1 ? "life" : "lives"} left`}>
            {Array.from({ length: lives(mode) }).map((_, i) => (
              <span key={i} className={i < hp ? "life" : "life life-lost"}>
                ♥
              </span>
            ))}
          </div>
          <div className="hud-sub">
            best {best} · reps {reps}
            {mode !== "warmup" && s.settings.boss && <> · boss in {BOSS_EVERY - 1 - (reps % BOSS_EVERY) || BOSS_EVERY}</>}
          </div>
        </div>
        <button
          className="btn btn-ghost hud-quit"
          onClick={() => {
            endRun(streak, reps, kills);
            setPhase("lobby");
          }}
        >
          Leave (Esc)
        </button>
      </div>
      {shout && (
        <div className="shout" aria-hidden="true">
          {shout}
        </div>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">
        {said}
      </p>
      <div className="dm-grid">
        <div className="dm-main">
          {phase === "playing" && drill && <Rep key={drill.id + ":" + reps} drill={drill} onAnswer={answer} />}
          {phase === "review" && lastWrong && (
            <Death drill={lastWrong.drill} given={lastWrong.given} title="Hit! Life lost" sub={`${hp} ${hp === 1 ? "life" : "lives"} left`}>
              <button className="btn btn-primary" onClick={continueAfterReview} autoFocus>
                Continue (Enter)
              </button>
            </Death>
          )}
          {phase === "dead" && lastWrong && (
            <Death
              drill={lastWrong.drill}
              given={lastWrong.given}
              title="ELIMINATED"
              sub={
                (mode === "warmup" ? `Cleared ${kills}` : `Streak ${streak}`) +
                (mode === "deathmatch" && streak > startBest ? " · NEW PERSONAL BEST" : "") +
                (mode === "deathmatch" && rankFor(streak).index > rankFor(startBest).index ? ` · Ranked up to ${rankFor(streak).rank.name}` : "")
              }
            >
              <button className="btn btn-primary" onClick={() => start(mode)} autoFocus>
                Respawn (Enter)
              </button>
              <button className="btn btn-ghost" onClick={() => setPhase("lobby")}>
                Lobby (Esc)
              </button>
              {mode === "deathmatch" && streak > startBest && streak > 0 && (
                <ShareButton
                  card={{ kicker: "New personal best", title: `${streak}-rep streak`, lines: [`Rank: ${rankFor(streak).rank.name}`, "C and C++ Deathmatch, one life"], file: "cpparena-streak.png" }}
                  text={`New Deathmatch best on C/C++ Arena: ${streak} in a row (${rankFor(streak).rank.name}).`}
                />
              )}
            </Death>
          )}
          {phase === "cleared" && (
            <div className="death cleared">
              <h2>Warm-up cleared</h2>
              <p>
                You cleared {kills} due review{kills === 1 ? "" : "s"}. Missed items come back sooner; nailed ones wait longer.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  endRun(streak, reps, kills);
                  setPhase("lobby");
                }}
                autoFocus
              >
                Back to lobby
              </button>
            </div>
          )}
        </div>
        <aside className="killfeed" aria-label="Kill feed">
          {feed.map((k) => (
            <div key={k.id} className={"kf " + (k.ok ? "kf-ok" : "kf-bad")}>
              <span className="kf-icon">{k.ok ? (k.type === "boss" ? "☠" : "⌖") : "✗"}</span>
              <span className="kf-topic">{topicTitle(k.topic)}</span>
              <span className="kf-time">{(k.ms / 1000).toFixed(1)}s</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ lobby
function Lobby({ pool, interviewCount, unlocked, selected, dueCount, onStart }: { pool: Drill[]; interviewCount: number; unlocked: string[]; selected: string[]; dueCount: number; onStart: (m: DmMode) => void }) {
  const s = useStore((x) => x);
  const r = rankFor(s.dm.best.deathmatch);
  const streakDays = dailyStreak(s.dm.days);
  const setTopics = (t: string[]) => patchSettings({ topics: t.length === unlocked.length ? null : t });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON" && (e.target as HTMLElement).tagName !== "INPUT") onStart("deathmatch");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="lobby">
      <div className="page-head">
        <h1>Deathmatch</h1>
        <p className="muted">Endless reps from everything you've unlocked. Quick reps check instantly; every {BOSS_EVERY}th rep is a boss rep you compile for real. Items you miss show up more often until you own them.</p>
      </div>
      <div className="lobby-grid">
        <div className="rank-card">
          <div className="rank-emblem" data-tier={Math.floor((r.index / 17) * 5)}>
            <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
              <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M32 6v14M32 44v14M6 32h14M44 32h14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="rank-name">{r.rank.name}</div>
            <div className="muted small">
              Best deathmatch streak: <b>{s.dm.best.deathmatch}</b>
              {r.next && <> · next rank at {r.next.at}</>}
            </div>
            <div className="muted small">
              {s.dm.kills} kills · {s.dm.bossKills} bosses · {streakDays > 0 ? `🔥 ${streakDays}-day streak` : "no daily streak yet"}
            </div>
          </div>
        </div>

        {unlocked.length === 0 ? (
          <div className="card">
            <h2 className="h3">No topics unlocked yet</h2>
            <p>
              Finish the first step of any lesson module to unlock its drills, or turn on <b>Unlock every topic</b> below if you already know some C/C++.
            </p>
            <div className="actions">
              <Link className="btn btn-primary" to={firstStepPath("c-hello")}>
                Start lesson 1
              </Link>
              {interviewCount > 0 && (
                <button className="btn" onClick={() => onStart("interview")}>
                  Try interview prep
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="modes">
            <button className="mode mode-dm" onClick={() => onStart("deathmatch")} disabled={!pool.length}>
              <div className="mode-name">Deathmatch</div>
              <div className="mode-desc">1 life. One miss ends the run. Counts toward your rank.</div>
              <div className="mode-best">best {s.dm.best.deathmatch} · Enter</div>
            </button>
            <button className="mode" onClick={() => onStart("casual")} disabled={!pool.length}>
              <div className="mode-name">Casual</div>
              <div className="mode-desc">3 lives. A miss resets your streak and shows the explanation.</div>
              <div className="mode-best">best {s.dm.best.casual}</div>
            </button>
            <button className="mode" onClick={() => onStart("warmup")} disabled={dueCount === 0}>
              <div className="mode-name">Warm-up</div>
              <div className="mode-desc">Spaced review: only drills that are due, weakest first. 3 lives.</div>
              <div className="mode-best">{dueCount} due now</div>
            </button>
            <button className="mode mode-iv" onClick={() => onStart("interview")} disabled={!interviewCount}>
              <div className="mode-name">Interview prep</div>
              <div className="mode-desc">{interviewCount} classic C and C++ interview questions. 3 lives. Open to everyone.</div>
              <div className="mode-best">best {s.dm.best.interview ?? 0}</div>
            </button>
          </div>
        )}
      </div>

      <section className="card">
        <div className="row-between">
          <h2 className="h3">Maps (topics)</h2>
          <div className="row">
            <button className="linkish" onClick={() => setTopics(unlocked)}>
              all
            </button>
            <button className="linkish" onClick={() => setTopics(unlocked.filter((t) => moduleById.get(t)?.lang === "c"))}>
              C only
            </button>
            <button className="linkish" onClick={() => setTopics(unlocked.filter((t) => moduleById.get(t)?.lang === "cpp"))}>
              C++ only
            </button>
          </div>
        </div>
        <div className="chips">
          {modules.map((m) => {
            const isUnlocked = unlocked.includes(m.id);
            const on = selected.includes(m.id);
            const all = drills.filter((d) => d.topic === m.id);
            const n = all.length;
            if (!n) return null;
            const open = all.filter((d) => drillUnlocked(s, d)).length;
            return (
              <button
                key={m.id}
                className={"chip" + (on ? " chip-on" : "") + (isUnlocked ? "" : " chip-locked")}
                disabled={!isUnlocked}
                title={!isUnlocked ? "Finish a step in this module to unlock its drills" : open < n ? `${open} of ${n} drills unlocked: each unlocks when you finish the step that teaches it` : `${n} drills`}
                onClick={() => {
                  const next = on ? selected.filter((t) => t !== m.id) : [...selected, m.id];
                  if (next.length) setTopics(next);
                }}
              >
                {isUnlocked ? "" : "🔒 "}
                {m.title} <span className="chip-n">{open < n ? `${open}/${n}` : n}</span>
              </button>
            );
          })}
        </div>
        <div className="muted small">{pool.length} drills in the rotation.</div>
        <div className="toggles">
          <label>
            <input type="checkbox" checked={s.settings.boss} onChange={(e) => patchSettings({ boss: e.target.checked })} /> Boss reps (compiled, every {BOSS_EVERY}th rep)
          </label>
          <label>
            <input type="checkbox" checked={s.settings.sound} onChange={(e) => patchSettings({ sound: e.target.checked })} /> Sound
          </label>
          <label>
            <input type="checkbox" checked={s.settings.unlockAll} onChange={(e) => patchSettings({ unlockAll: e.target.checked, topics: null })} /> Unlock every topic
          </label>
          <label>
            <input type="checkbox" checked={s.settings.keys !== false} onChange={(e) => patchSettings({ keys: e.target.checked })} /> Single-key shortcuts (Y/N, line numbers, R)
          </label>
        </div>
      </section>

      {s.dm.runs.length > 0 && (
        <section className="card">
          <h2 className="h3">Recent runs</h2>
          <table className="runs">
            <thead>
              <tr>
                <th>When</th>
                <th>Mode</th>
                <th>Streak</th>
                <th>Kills</th>
                <th>Reps</th>
              </tr>
            </thead>
            <tbody>
              {s.dm.runs.slice(0, 8).map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td>{r.mode}</td>
                  <td>{r.streak}</td>
                  <td>{r.kills}</td>
                  <td>{r.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

