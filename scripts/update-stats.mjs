// Keeps the running visit total the home page shows. Cloudflare Web Analytics only keeps
// recent data, so the total lives in a small JSON file (on the `stats` branch, written by
// .github/workflows/stats.yml), and each run adds the whole UTC days since the last one.
//
// Usage: node scripts/update-stats.mjs stats.json
// Env: CF_API_TOKEN (Account Analytics: Read), CF_ACCOUNT_ID, and CF_BEACON_TOKEN (to find
// the site) or CF_SITE_TAG.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** How far back a first run (or a run after a long gap) looks. */
export const LOOKBACK_DAYS = 30;

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

/** The whole UTC days, oldest first, that the total doesn't include yet (up to yesterday). */
export function missingDays(stats, now) {
  const today = Date.parse(iso(now));
  let from = stats?.through ? Date.parse(stats.through) + DAY : today - LOOKBACK_DAYS * DAY;
  from = Math.max(from, today - LOOKBACK_DAYS * DAY);
  const days = [];
  for (let t = from; t < today; t += DAY) days.push(iso(t));
  return days;
}

/** Adds one day's numbers. `since` is the first day that had any visits. */
export function addDay(stats, day, visits, pageViews) {
  const s = { visits: 0, pageViews: 0, since: null, through: null, ...stats };
  s.visits += visits;
  s.pageViews += pageViews;
  if (!s.since && visits > 0) s.since = day;
  s.through = day;
  return s;
}

async function cloudflare(path, token, body) {
  const res = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new Error(`Cloudflare ${path} answered HTTP ${res.status}: ${JSON.stringify(json?.errors ?? json)}`);
  return json;
}

/** The Web Analytics site tag: given directly, or found from the beacon token. */
async function siteTag(env) {
  if (env.CF_SITE_TAG) return env.CF_SITE_TAG.trim();
  const json = await cloudflare(`/accounts/${env.CF_ACCOUNT_ID}/rum/site_info/list?per_page=100`, env.CF_API_TOKEN);
  const site = (json.result ?? []).find((s) => s.site_token === env.CF_BEACON_TOKEN?.trim());
  if (!site) throw new Error("No Web Analytics site in this account uses CF_BEACON_TOKEN. Check the token, or set CF_SITE_TAG.");
  return site.site_tag;
}

const QUERY = `query Day($account: string!, $site: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $start, datetime_lt: $end }) {
        count
        sum { visits }
      }
    }
  }
}`;

async function dayTotals(env, site, day) {
  const start = day + "T00:00:00Z";
  const end = iso(Date.parse(day) + DAY) + "T00:00:00Z";
  const json = await cloudflare("/graphql", env.CF_API_TOKEN, { query: QUERY, variables: { account: env.CF_ACCOUNT_ID, site, start, end } });
  if (json.errors?.length) throw new Error("Cloudflare GraphQL: " + json.errors.map((e) => e.message).join("; "));
  const row = json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0];
  return { visits: row?.sum?.visits ?? 0, pageViews: row?.count ?? 0 };
}

/** Adds the missing days to the total in `file` (created on the first run). */
export async function update(file, env, now = Date.now()) {
  for (const k of ["CF_API_TOKEN", "CF_ACCOUNT_ID"]) if (!env[k]) throw new Error(`${k} is not set`);
  let stats = null;
  try {
    stats = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    /* first run */
  }
  const days = missingDays(stats, now);
  if (!days.length) return console.log("stats: already up to date through " + stats.through);
  const site = await siteTag(env);
  for (const day of days) {
    const t = await dayTotals(env, site, day);
    stats = addDay(stats, day, t.visits, t.pageViews);
    console.log(`stats: ${day}: ${t.visits} visits, ${t.pageViews} page views`);
  }
  stats.updated = new Date(now).toISOString();
  fs.writeFileSync(file, JSON.stringify(stats, null, 2) + "\n");
  console.log(`stats: ${stats.visits} visits since ${stats.since ?? "(none yet)"}, through ${stats.through}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error("usage: node scripts/update-stats.mjs stats.json");
  update(process.argv[2], process.env).catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  });
}
