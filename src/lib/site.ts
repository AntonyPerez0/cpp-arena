// Where the project lives. Reports and the footer link here.
export const REPO = "AntonyPerez0/cpp-arena";
export const REPO_URL = `https://github.com/${REPO}`;
export const SITE_URL = "https://cpparena.com";

export type ReportInfo = {
  /** What the learner was on, for example "Lesson step" or "Deathmatch drill". */
  kind: string;
  /** Short name for the issue title. */
  title: string;
  /** Stable id (step id, drill id, project and milestone). */
  id: string;
  /** Page address, if there is one. */
  path?: string;
  code?: string;
  /** Latest result, for example "2 of 3 tests failed". */
  result?: string;
};

/** A link that opens a pre-filled GitHub issue. Long code is cut so the address stays within browser limits. */
export function reportUrl(r: ReportInfo): string {
  const code = r.code ? (r.code.length > 3500 ? r.code.slice(0, 3500) + "\n/* ...cut... */" : r.code) : "";
  const body = [
    `**${r.kind}:** ${r.title}`,
    `**ID:** \`${r.id}\``,
    r.path ? `**Page:** ${SITE_URL}${r.path}` : "",
    "",
    "**What went wrong?**",
    "<!-- For example: the hint is confusing, my correct answer was marked wrong, a typo, the explanation is unclear. -->",
    "",
    "",
    r.result ? `**Last result:** ${r.result}` : "",
    code ? "**My code:**\n```" + "\n" + code + "\n```" : "",
    "",
    `<sub>Browser: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}</sub>`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  const q = new URLSearchParams({ title: `[${r.kind}] ${r.title}`, body, labels: "content" });
  return `${REPO_URL}/issues/new?${q.toString()}`;
}
