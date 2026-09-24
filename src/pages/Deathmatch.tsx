import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { drills, moduleById, modules } from "../content";
import type { Drill } from "../content/types";
import { getState, patchSettings, useStore, type DmMode } from "../state/store";
import { dailyStreak, rankFor, unlockedTopics } from "../state/derived";
import { blip, callout, checkAnswer, isDue, lives, pickNext, recordRep, recordRun, TYPE_LABEL, BOSS_EVERY } from "../deathmatch/engine";
import { CodeView, highlight } from "../components/highlight";
import FillCode from "../components/FillCode";
import CodeEditor from "../components/CodeEditor";
import Results from "../components/Results";
import Markdown, { InlineMd } from "../components/Markdown";
import { grade, type GradeResult } from "../grader/grade";
import { ensureCompiler } from "../compiler/client";

type Phase = "lobby" | "playing" | "review" | "dead" | "cleared";
type Kill = { id: number; topic: string; type: Drill["type"]; ms: number; ok: boolean };

export default function Deathmatch() {
  const s = useStore((x) => x);
  const unlocked = unlockedTopics(s);
  const selected = (s.settings.topics ?? unlocked).filter((t) => unlocked.includes(t));
  const topics = selected.length ? selected : unlocked;
  const pool = useMemo(() => drills.filter((d) => topics.includes(d.topic) && (s.settings.boss || d.type !== "boss")), [topics.join(","), s.settings.boss]);
  const dueCount = pool.filter((d) => isDue(s.drills[d.id])).length;

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
  const [lastWrong, setLastWrong] = useState<{ drill: Drill; given: string } | null>(null);
  const [startBest, setStartBest] = useState(0);
  const recent = useRef<string[]>([]);
  const repStart = useRef(0);
  const feedId = useRef(0);

  const nextRep = useCallback(
    (repNo: number, m: DmMode) => {
      const d = pickNext(pool, getState(), recent.current, repNo, getState().settings.boss, m);
      if (!d) {
        setPhase("cleared");
        return;
      }
      recent.current = [...recent.current, d.id].slice(-30);
      setDrill(d);
      repStart.current = performance.now();
    },
    [pool],
  );

  const start = (m: DmMode) => {
    if (!pool.length) return;
    if (m === "warmup" && dueCount === 0) return;
    if (s.settings.boss && pool.some((d) => d.type === "boss")) ensureCompiler({ warmCpp: pool.some((d) => d.lang === "cpp") });
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
      if (c) {
        setShout(c);
        setTimeout(() => setShout(null), 1100);
      }
      setTimeout(() => setFlash(null), 220);
      nextRep(r, mode);
    } else {
      if (getState().settings.sound) blip("miss");
      setFlash("miss");
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
      if (phase === "dead" && (e.key === "Enter" || e.key === "r" || e.key === "R")) {
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

  if (phase === "lobby") return <Lobby pool={pool} unlocked={unlocked} selected={topics} dueCount={dueCount} onStart={start} />;

  const best = Math.max(startBest, mode === "warmup" ? kills : streak);
  return (
    <div className={"dm" + (flash ? " dm-flash-" + flash : "")}>
      <div className="hud">
        <div className="hud-streak">
          <div className="hud-n">{mode === "warmup" ? kills : streak}</div>
          <div className="hud-l">{mode === "warmup" ? "cleared" : "streak"}</div>
        </div>
        <div className="hud-mid">
          <div className="hud-mode">{mode === "deathmatch" ? "Deathmatch · 1 life" : mode === "casual" ? "Casual · 3 lives" : "Warm-up · due reviews"}</div>
          <div className="hud-lives" aria-label={`${hp} lives left`}>
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
      {shout && <div className="shout">{shout}</div>}
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
              <span className="kf-topic">{moduleById.get(k.topic)?.title ?? k.topic}</span>
              <span className="kf-time">{(k.ms / 1000).toFixed(1)}s</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ lobby
function Lobby({ pool, unlocked, selected, dueCount, onStart }: { pool: Drill[]; unlocked: string[]; selected: string[]; dueCount: number; onStart: (m: DmMode) => void }) {
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
            <h3>No topics unlocked yet</h3>
            <p>
              Finish the first step of any lesson module to unlock its drills, or turn on <b>Unlock every topic</b> below if you already know some C/C++.
            </p>
            <Link className="btn btn-primary" to="/learn/c-hello/1">
              Start lesson 1
            </Link>
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
          </div>
        )}
      </div>

      <section className="card">
        <div className="row-between">
          <h3>Maps (topics)</h3>
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
            const n = drills.filter((d) => d.topic === m.id).length;
            if (!n) return null;
            return (
              <button
                key={m.id}
                className={"chip" + (on ? " chip-on" : "") + (isUnlocked ? "" : " chip-locked")}
                disabled={!isUnlocked}
                title={isUnlocked ? `${n} drills` : "Finish a step in this module to unlock"}
                onClick={() => {
                  const next = on ? selected.filter((t) => t !== m.id) : [...selected, m.id];
                  if (next.length) setTopics(next);
                }}
              >
                {isUnlocked ? "" : "🔒 "}
                {m.title} <span className="chip-n">{n}</span>
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
        </div>
      </section>

      {s.dm.runs.length > 0 && (
        <section className="card">
          <h3>Recent runs</h3>
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

// ------------------------------------------------------------------ one rep
function Rep({ drill, onAnswer }: { drill: Drill; onAnswer: (given: string, ok: boolean) => void }) {
  const topic = moduleById.get(drill.topic);
  return (
    <div className={"rep rep-" + drill.type} data-drill={drill.id}>
      <div className="rep-head">
        <span className={"rep-type type-" + drill.type}>{TYPE_LABEL[drill.type]}</span>
        <span className={"lang-tag lang-" + drill.lang}>{drill.lang === "c" ? "C" : "C++"}</span>
        <span className="rep-topic">{topic?.title}</span>
      </div>
      {drill.type !== "boss" && (
        <p className="rep-prompt">
          <InlineMd text={drill.prompt} />
        </p>
      )}
      {drill.type === "predict" && <PredictRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "fill" && <FillRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "bug" && <BugRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "compiles" && <CompilesRep drill={drill} onAnswer={onAnswer} />}
      {drill.type === "boss" && <BossRep drill={drill} onAnswer={onAnswer} />}
    </div>
  );
}

function PredictRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const [v, setV] = useState("");
  const submit = () => v.trim() && onAnswer(v, checkAnswer(drill, v));
  return (
    <>
      <CodeView code={drill.display} />
      <form
        className="rep-answer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="answer-input"
          autoFocus
          placeholder="Type the exact output (Enter to fire)"
          value={v}
          onChange={(e) => setV(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
        <button className="btn btn-primary">Fire ↵</button>
      </form>
      <div className="muted small">Line breaks and spaces are flexible: "1 2 3" matches three lines of 1, 2, 3.</div>
    </>
  );
}

function FillRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const [v, setV] = useState<string[]>([""]);
  const submit = () => v[0].trim() && onAnswer(v[0], checkAnswer(drill, v[0]));
  return (
    <>
      <FillCode template={drill.display} values={v} onChange={setV} onSubmit={submit} autoFocus />
      {drill.output && (
        <div className="rep-output">
          <span className="lbl">should print</span>
          <pre className="console tiny">{drill.output}</pre>
        </div>
      )}
      <div className="rep-answer">
        <button className="btn btn-primary" onClick={submit}>
          Fire ↵
        </button>
      </div>
    </>
  );
}

function BugRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const lines = drill.display.split("\n");
  const pickable = lines.map((l) => l.trim() !== "" && !/^\/\/ inside main:$/.test(l.trim()) && !/^[{}]\s*;?$/.test(l.trim()));
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && n <= lines.length && pickable[n - 1]) onAnswer(String(n), checkAnswer(drill, String(n)));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <div className="buglines" role="list">
      {lines.map((l, i) =>
        pickable[i] ? (
          <button key={i} className="bugline" onClick={() => onAnswer(String(i + 1), checkAnswer(drill, String(i + 1)))}>
            <span className="ln">{i + 1}</span>
            <code>{highlight(l)}</code>
          </button>
        ) : (
          <div key={i} className="bugline bugline-off">
            <span className="ln">{i + 1}</span>
            <code>{highlight(l)}</code>
          </div>
        ),
      )}
      <div className="muted small">Click the line, or press its number key.</div>
    </div>
  );
}

function CompilesRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "y" || e.key === "Y") onAnswer("yes", checkAnswer(drill, "yes"));
      if (e.key === "n" || e.key === "N") onAnswer("no", checkAnswer(drill, "no"));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <>
      <CodeView code={drill.display} />
      <div className="yn">
        <button className="btn btn-yes" onClick={() => onAnswer("yes", checkAnswer(drill, "yes"))}>
          Compiles (Y)
        </button>
        <button className="btn btn-no" onClick={() => onAnswer("no", checkAnswer(drill, "no"))}>
          Compile error (N)
        </button>
      </div>
      <div className="muted small">Standard headers are already included. Warnings don't count as errors.</div>
    </>
  );
}

function BossRep({ drill, onAnswer }: { drill: Drill; onAnswer: (g: string, ok: boolean) => void }) {
  const ex = drill.exercise!;
  const [code, setCode] = useState(ex.seed);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [shots, setShots] = useState(3);
  const busyRef = useRef(false);
  const fire = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await grade(ex, code);
      setResult(r);
      if (r.status === "pass") onAnswer("pass", true);
      else if (r.status !== "internal-error") {
        const left = shots - 1;
        setShots(left);
        if (left <= 0) onAnswer(code, false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="boss-banner">☠ BOSS REP · {shots} shot{shots === 1 ? "" : "s"} left</div>
      <Markdown text={drill.prompt} />
      <CodeEditor value={code} onChange={setCode} onRun={fire} diagnostics={result?.diagnostics} minHeight="180px" />
      <div className="actions">
        <button className="btn btn-primary" onClick={fire} disabled={busy}>
          {busy ? "Compiling…" : "Fire  ⌃↵"}
        </button>
        <button className="btn btn-ghost" onClick={() => onAnswer("(gave up)", false)}>
          Give up
        </button>
      </div>
      {result && result.status !== "pass" && <Results result={result} attempt={3 - shots} />}
    </>
  );
}

// ------------------------------------------------------------------ death / review
function Death({ drill, given, title, sub, children }: { drill: Drill; given: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="death">
      <h2 className="death-title">{title}</h2>
      <div className="death-sub">{sub}</div>
      <div className="death-card">
        <div className="rep-head">
          <span className={"rep-type type-" + drill.type}>{TYPE_LABEL[drill.type]}</span>
          <span className="rep-topic">{moduleById.get(drill.topic)?.title}</span>
        </div>
        {drill.type === "boss" ? (
          <>
            <div className="lbl">a solution</div>
            <CodeView code={drill.exercise!.solution} />
          </>
        ) : drill.type === "bug" ? (
          <>
            <CodeView code={drill.display.split("\n").map((l, i) => (String(i + 1) === drill.answer ? l + "   // <- bug" : l)).join("\n")} />
            <div className="answer-cmp">
              You picked line <b>{given}</b>. The bug is on line <b>{drill.answer}</b>. Fix: <code>{drill.fix}</code>
            </div>
          </>
        ) : (
          <>
            {drill.type === "fill" ? (
              <FillCode template={drill.display} values={[drill.answer]} onChange={() => {}} disabled />
            ) : (
              <CodeView code={drill.display} />
            )}
            <div className="answer-cmp">
              <div>
                <span className="lbl">you said</span> <code>{given || "(nothing)"}</code>
              </div>
              <div>
                <span className="lbl">answer</span>{" "}
                <code className="good">{drill.type === "compiles" ? (drill.answer === "yes" ? "compiles" : "compile error") : drill.answer}</code>
              </div>
            </div>
          </>
        )}
        {drill.why && (
          <div className="why">
            <Markdown text={drill.why} />
          </div>
        )}
      </div>
      <div className="death-actions">{children}</div>
    </div>
  );
}
