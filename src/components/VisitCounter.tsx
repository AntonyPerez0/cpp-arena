import { useEffect, useState } from "react";

type Stats = { visits: number };

/**
 * The site's total visits from Cloudflare Web Analytics, kept by .github/workflows/stats.yml.
 * The build only sets VITE_STATS_URL once that's set up; until then, and whenever the
 * total can't be loaded (offline, say), this shows nothing.
 */
export default function VisitCounter() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const url = import.meta.env.VITE_STATS_URL;
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (live && s && Number.isInteger(s.visits) && s.visits > 0) setStats(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!stats) return null;
  return (
    <p className="small muted visit-count">
      {stats.visits.toLocaleString("en-US")} {stats.visits === 1 ? "visit" : "visits"}
    </p>
  );
}
