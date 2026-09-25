import { useMemo } from "react";
import { Link } from "react-router-dom";
import { drills } from "../content";
import type { Drill } from "../content/types";
import { update, useStore } from "../state/store";
import { dailyChallengeStreak, localDay } from "../state/derived";
import { recordRep, topicTitle } from "../deathmatch/engine";
import { Rep, Death } from "../deathmatch/Reps";
import { useTitle } from "../lib/title";

const pool = drills.filter((d) => d.type !== "boss").sort((a, b) => a.id.localeCompare(b.id));

/** Today's drill: the same for everyone on the same date. */
export function dailyDrill(day: string): Drill {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return pool[h % pool.length];
}

export default function Daily() {
  useTitle("Daily challenge");
  const day = localDay();
  const drill = useMemo(() => dailyDrill(day), [day]);
  const daily = useStore((s) => s.daily);
  const done = day in daily;
  const streak = dailyChallengeStreak(daily);
  const last14 = Array.from({ length: 14 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - k));
    const key = localDay(d);
    return { key, state: key in daily ? (daily[key] ? "right" : "wrong") : "none", label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) };
  });
  // The answer text is only kept for this visit; the result (right or wrong) is saved.
  const givenKey = `cpp-arena-daily-${day}`;
  let given = "";
  try {
    given = sessionStorage.getItem(givenKey) ?? "";
  } catch {
    /* ignore */
  }

  return (
    <div className="narrow">
      <div className="page-head">
        <h1>Daily challenge</h1>
        <p className="muted">
          One problem a day, the same for everyone. Answer it to keep your streak going. A new one appears at midnight.
        </p>
      </div>
      <div className="daily-head">
        <div className="stat">
          <div className="stat-n">{streak}</div>
          <div className="stat-l">day streak</div>
        </div>
        <ol className="daily-days" aria-label="The last 14 days">
          {last14.map((d) => (
            <li key={d.key} className={"dday dday-" + d.state} title={d.label}>
              <span className="visually-hidden">
                {d.label}: {d.state === "none" ? "not played" : d.state === "right" ? "solved" : "missed"}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {!done ? (
        <>
          <p className="muted small">Today's topic: {topicTitle(drill.topic)}</p>
          <Rep
            drill={drill}
            onAnswer={(g, ok) => {
              try {
                sessionStorage.setItem(givenKey, g);
              } catch {
                /* ignore */
              }
              recordRep(drill, ok);
              update((s) => ({ ...s, daily: { ...s.daily, [day]: ok } }));
            }}
          />
        </>
      ) : (
        <Death drill={drill} given={given || "(answered earlier)"} title={daily[day] ? "Solved" : "Not this time"} sub={daily[day] ? `Streak: ${streak} day${streak === 1 ? "" : "s"}. Come back tomorrow.` : "Your streak still counts. Read the explanation, then come back tomorrow."}>
          <Link className="btn btn-primary" to="/deathmatch">
            Keep going in Deathmatch
          </Link>
          <Link className="btn btn-ghost" to="/learn">
            Back to lessons
          </Link>
        </Death>
      )}
    </div>
  );
}
